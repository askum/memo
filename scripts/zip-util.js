/**
 * UTF-8 Compliant Zip Writer using pure Node.js standard library (Zero npm dependencies)
 * Guarantees PKWARE Bit 11 (0x0800) is set for 100% reliable Unicode Korean filenames
 * on Windows Explorer (압축 풀기), macOS, and Linux.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[i] = c >>> 0;
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// Convert Date to MS-DOS date & time
function dosDateTime(date) {
  const d = date || new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2));
  const dateNum = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date: dateNum };
}

function createZipArchive(sourceDir, outZipPath, options = {}) {
  const excludeDirs = new Set(options.excludeDirs || ['.git', '.github', 'node_modules']);
  const excludeFiles = new Set(options.excludeFiles || ['.DS_Store', 'desktop-memo.zip', 'config.json']);

  const fileEntries = [];

  function walk(currentDir) {
    const list = fs.readdirSync(currentDir);
    for (const item of list) {
      if (item.startsWith('.DS_Store')) continue;
      const full = path.join(currentDir, item);
      const rel = path.relative(sourceDir, full).replace(/\\/g, '/');
      const stat = fs.statSync(full);

      if (stat.isDirectory()) {
        if (excludeDirs.has(item) || excludeDirs.has(rel)) continue;
        fileEntries.push({ name: rel + '/', isDir: true, mtime: stat.mtime, data: Buffer.alloc(0) });
        walk(full);
      } else {
        if (excludeFiles.has(item) || item.endsWith('.zip') || item.endsWith('.tmp')) continue;
        const data = fs.readFileSync(full);
        fileEntries.push({ name: rel, isDir: false, mtime: stat.mtime, data });
      }
    }
  }

  walk(sourceDir);

  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const entry of fileEntries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const { time, date } = dosDateTime(entry.mtime);

    let compressed = Buffer.alloc(0);
    let method = 0;
    let fileCrc = 0;
    let uncompressedSize = 0;
    let compressedSize = 0;

    if (!entry.isDir) {
      compressed = zlib.deflateRawSync(entry.data);
      // If compressed is larger than uncompressed, store uncompressed
      if (compressed.length >= entry.data.length) {
        compressed = entry.data;
        method = 0; // Stored
      } else {
        method = 8; // Deflated
      }
      uncompressedSize = entry.data.length;
      compressedSize = compressed.length;
      fileCrc = crc32(entry.data);
    }

    // Local file header (30 bytes + nameBuf.length)
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0); // Signature
    local.writeUInt16LE(20, 4);         // Version needed (2.0)
    local.writeUInt16LE(0x0800, 6);     // Bit 11 UTF-8 Language Encoding Flag!
    local.writeUInt16LE(method, 8);     // Compression method
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(fileCrc, 14);
    local.writeUInt32LE(compressedSize, 18);
    local.writeUInt32LE(uncompressedSize, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);         // Extra field length
    nameBuf.copy(local, 30);

    localHeaders.push(local);
    if (compressed.length > 0) {
      localHeaders.push(compressed);
    }

    // Central directory header (46 bytes + nameBuf.length)
    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0); // Signature
    central.writeUInt16LE(20, 4);         // Version made by
    central.writeUInt16LE(20, 6);         // Version needed
    central.writeUInt16LE(0x0800, 8);     // Bit 11 UTF-8 Language Encoding Flag!
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(fileCrc, 16);
    central.writeUInt32LE(compressedSize, 20);
    central.writeUInt32LE(uncompressedSize, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);         // Extra field length
    central.writeUInt16LE(0, 32);         // File comment length
    central.writeUInt16LE(0, 34);         // Disk number start
    central.writeUInt16LE(0, 36);         // Internal file attributes
    const externalAttr = entry.isDir ? 0x10 : 0x20; // 0x10 = directory
    central.writeUInt32LE(externalAttr, 38);
    central.writeUInt32LE(offset, 42);    // Relative offset of local header
    nameBuf.copy(central, 46);

    centralHeaders.push(central);
    offset += local.length + compressed.length;
  }

  const centralOffset = offset;
  const centralSize = centralHeaders.reduce((sum, b) => sum + b.length, 0);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);                 // Disk number
  eocd.writeUInt16LE(0, 6);                 // Start disk
  eocd.writeUInt16LE(fileEntries.length, 8); // Entries on this disk
  eocd.writeUInt16LE(fileEntries.length, 10);// Total entries
  eocd.writeUInt32LE(centralSize, 12);      // Size of central directory
  eocd.writeUInt32LE(centralOffset, 16);    // Offset of central directory
  eocd.writeUInt16LE(0, 20);                // Comment length

  const totalBuffer = Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
  fs.writeFileSync(outZipPath, totalBuffer);
  return totalBuffer.length;
}

module.exports = { createZipArchive };
