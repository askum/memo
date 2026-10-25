const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function buildWindowsExe(rootDir) {
  const iconPng = path.join(rootDir, 'public', 'favicon.png');
  const outIco = path.join(rootDir, 'public', 'favicon.ico');
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const version = pkg.version;
  const versionParts = version.split('.').map(Number);
  const versionComma = `${versionParts[0] || 1},${versionParts[1] || 0},${versionParts[2] || 0},0`;

  console.log('🔨 Windows DesktopMemo.exe 빌드 시작...');

  // 1. Generate multi-resolution .ico from public/favicon.png
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers = [];

  for (const s of sizes) {
    const tmpPng = `/tmp/memo_ico_${s}.png`;
    execSync(`sips -z ${s} ${s} "${iconPng}" --out "${tmpPng}"`, { stdio: 'ignore' });
    pngBuffers.push({ size: s, data: fs.readFileSync(tmpPng) });
    fs.unlinkSync(tmpPng);
  }

  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // ICO type (1 = icon)
  header.writeUInt16LE(count, 4);

  let offset = 6 + count * 16;
  const entries = [];

  for (const img of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1);
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.data.length, 8); // Image size
    entry.writeUInt32LE(offset, 12); // Offset
    entries.push(entry);
    offset += img.data.length;
  }

  const totalBuf = Buffer.concat([header, ...entries, ...pngBuffers.map(b => b.data)]);
  fs.writeFileSync(outIco, totalBuf);
  console.log(`✅ Windows 아이콘 생성 완료: ${outIco} (${totalBuf.length} bytes)`);

  // 2. Prepare resource script (.rc)
  const rcPath = '/tmp/DesktopMemo.rc';
  const rcContent = `
1 ICON "${outIco}"

1 VERSIONINFO
FILEVERSION ${versionComma}
PRODUCTVERSION ${versionComma}
FILEFLAGSMASK 0x3fL
FILEFLAGS 0x0L
FILEOS 0x40004L
FILETYPE 0x1L
FILESUBTYPE 0x0L
BEGIN
    BLOCK "StringFileInfo"
    BEGIN
        BLOCK "041204b0"
        BEGIN
            VALUE "CompanyName", "Desktop Memo"
            VALUE "FileDescription", "Desktop Memo - 초경량 로컬 폴더 기반 데스크톱 메모 프로그램"
            VALUE "FileVersion", "${version}"
            VALUE "InternalName", "DesktopMemo"
            VALUE "LegalCopyright", "Copyright (C) Desktop Memo"
            VALUE "OriginalFilename", "DesktopMemo.exe"
            VALUE "ProductName", "Desktop Memo"
            VALUE "ProductVersion", "${version}"
        END
    END
    BLOCK "VarFileInfo"
    BEGIN
        VALUE "Translation", 0x412, 1200
    END
END
`;
  fs.writeFileSync(rcPath, rcContent, 'utf8');

  // Compile resource
  const resPath = '/tmp/DesktopMemo.res';
  execSync(`x86_64-w64-mingw32-windres "${rcPath}" -O coff -o "${resPath}"`, { stdio: 'inherit' });

  // 3. Compile DesktopMemo.c
  const cSrcPath = path.join(__dirname, 'DesktopMemo.c');
  const outExe = path.join(rootDir, 'DesktopMemo.exe');
  execSync(`x86_64-w64-mingw32-gcc -O2 -mwindows "${cSrcPath}" "${resPath}" -o "${outExe}" -lws2_32 -s`, { stdio: 'inherit' });

  console.log(`🎉 DesktopMemo.exe 생성 완료: ${outExe}`);
  return outExe;
}

if (require.main === module) {
  const rootDir = path.resolve(__dirname, '..');
  buildWindowsExe(rootDir);
}

module.exports = { buildWindowsExe };
