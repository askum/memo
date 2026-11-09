/**
 * Desktop Memo Server - Pure Node.js Standard Library (Zero npm dependencies)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3333;
const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const DEFAULT_MEMOS_DIR = path.join(__dirname, 'memos');
let APP_VERSION = 'v1.0.1';
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
  APP_VERSION = 'v' + (pkg.version || '1.0.1');
} catch (e) {}

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DEFAULT_MEMOS_DIR)) fs.mkdirSync(DEFAULT_MEMOS_DIR, { recursive: true });

// Ensure initial welcome memo only if default memos folder is completely empty
try {
  const existingFiles = fs.readdirSync(DEFAULT_MEMOS_DIR).filter(f => !f.startsWith('.'));
  if (existingFiles.length === 0) {
    const welcomeFile = path.join(DEFAULT_MEMOS_DIR, '환영합니다.txt');
    fs.writeFileSync(welcomeFile, `📝 데스크톱 메모장에 오신 것을 환영합니다!\n\n이곳에 자유롭게 메모를 작성하세요.\n\n---\n\n📌 팁:\n- 상단의 [새 메모] 버튼이나 Cmd+N(Ctrl+N)으로 새 메모를 만들 수 있습니다.\n- [작업 폴더 변경] 버튼으로 컴퓨터의 원하는 폴더를 선택하여 메모할 수 있습니다.\n`, 'utf-8');
  }
} catch (e) {}

// Lifecycle & Auto-Shutdown Management
const serverStartTime = Date.now();
let hasClientConnected = false;
let shutdownTimeout = null;

// Initial connection watchdog: if no browser/client connects within 60 seconds of server launch, exit
const initialConnectionTimer = setInterval(() => {
  if (hasClientConnected) {
    clearInterval(initialConnectionTimer);
  } else if (Date.now() - serverStartTime > 60000) {
    console.log('[INFO] 브라우저 연결 없음 (60초 경과). 서버를 자동 종료합니다.');
    process.exit(0);
  }
}, 5000);

// Helper to resolve file path handling Unicode NFC/NFD, URL encoding, and relative fallbacks
function resolveFilePath(rawPath) {
  if (!rawPath) return null;
  let decoded = rawPath;
  try { decoded = decodeURIComponent(rawPath); } catch (e) {}

  const candidates = [
    rawPath,
    decoded,
    path.resolve(rawPath),
    path.resolve(decoded)
  ];

  try {
    const root = getConfig().rootFolder;
    if (root && fs.existsSync(root)) {
      candidates.push(path.join(root, rawPath));
      candidates.push(path.join(root, decoded));
      candidates.push(path.join(root, path.basename(rawPath)));
      candidates.push(path.join(root, path.basename(decoded)));
    }
  } catch (e) {}

  for (const c of candidates) {
    if (!c) continue;
    if (fs.existsSync(c)) return c;
    const nfc = c.normalize('NFC');
    if (fs.existsSync(nfc)) return nfc;
    const nfd = c.normalize('NFD');
    if (fs.existsSync(nfd)) return nfd;
  }

  // Deep recursive search in rootFolder as last fallback
  try {
    const root = getConfig().rootFolder;
    if (root && fs.existsSync(root)) {
      const baseName = path.basename(decoded || rawPath);
      const found = findFileInDir(root, baseName);
      if (found) return found;
    }
  } catch (e) {}

  return null;
}

// Config manager
function getConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (cfg.rootFolder && fs.existsSync(cfg.rootFolder)) {
        if (cfg.lastOpenedFile) {
          if (!fs.existsSync(cfg.lastOpenedFile)) {
            // Check if file exists inside rootFolder (e.g. folder was moved or path changed)
            const fallback = path.join(cfg.rootFolder, path.basename(cfg.lastOpenedFile));
            if (fs.existsSync(fallback)) {
              cfg.lastOpenedFile = fallback;
              saveConfig(cfg);
            } else {
              cfg.lastOpenedFile = '';
              saveConfig(cfg);
            }
          }
        }
        return cfg;
      }
    } catch (e) {}
  }
  return { rootFolder: DEFAULT_MEMOS_DIR, lastOpenedFile: '' };
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
}

// Copy a directory recursively
function copyDirRecursiveSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Robust rename with retry & fallback for Windows EPERM / EBUSY
async function safeRename(oldPath, newPath) {
  const isWindows = process.platform === 'win32';
  const retries = isWindows ? 8 : 3;
  const initialDelay = 80;

  for (let i = 0; i < retries; i++) {
    try {
      fs.renameSync(oldPath, newPath);
      return;
    } catch (err) {
      const isLockError = err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES';
      if (isLockError && i < retries - 1) {
        // Exponential backoff
        await new Promise(r => setTimeout(r, initialDelay * Math.pow(1.3, i)));
        continue;
      }

      // If it still fails with lock error, attempt copy & delete fallback
      if (isLockError && fs.existsSync(oldPath)) {
        try {
          const stat = fs.statSync(oldPath);
          if (stat.isDirectory()) {
            copyDirRecursiveSync(oldPath, newPath);
            fs.rmSync(oldPath, { recursive: true, force: true });
            return;
          } else {
            fs.copyFileSync(oldPath, newPath);
            fs.unlinkSync(oldPath);
            return;
          }
        } catch (copyErr) {
          throw new Error(`파일 또는 폴더가 다른 프로그램이나 시스템 프로세스에서 사용 중이어서 이름을 변경할 수 없습니다. (원인: ${err.message})`);
        }
      }
      throw err;
    }
  }
}

// Validate file/folder names against OS rules, slashes, forbidden characters, and reserved device names
function validateName(name, itemType = '항목') {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: `${itemType} 이름을 입력해주세요.` };
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: `${itemType} 이름을 입력해주세요. (공백만으로는 생성할 수 없습니다)` };
  }

  // 1. Slashes & Backslashes check
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return {
      valid: false,
      error: `${itemType} 이름에 슬래시(/)나 역슬래시(\\)를 포함할 수 없습니다.\n(운영체제의 경로 구분 기호입니다. 대신 '-' 또는 '_' 등을 사용해주세요.)`
    };
  }

  // 2. Windows and cross-platform forbidden special characters: : * ? " < > |
  const forbiddenMatch = trimmed.match(/[:*?"<>|]/);
  if (forbiddenMatch) {
    return {
      valid: false,
      error: `${itemType} 이름에 사용할 수 없는 특수문자('${forbiddenMatch[0]}')가 포함되어 있습니다.\n(사용 불가 특수문자: / \\ : * ? " < > |)`
    };
  }

  // 3. Control characters
  if (/[\x00-\x1f]/.test(trimmed)) {
    return {
      valid: false,
      error: `${itemType} 이름에 사용할 수 없는 시스템 제어 문자가 포함되어 있습니다.`
    };
  }

  // 4. Dot rules
  if (trimmed === '.' || trimmed === '..') {
    return {
      valid: false,
      error: `'.' 또는 '..'은 상위/현재 경로 예약어이므로 ${itemType} 이름으로 사용할 수 없습니다.`
    };
  }
  if (trimmed.endsWith('.')) {
    return {
      valid: false,
      error: `${itemType} 이름은 마침표(.)나 공백으로 끝날 수 없습니다.`
    };
  }

  // 5. Windows reserved device names
  const baseNameOnly = trimmed.replace(/\.[^.]+$/, '').toUpperCase();
  const windowsReserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  if (windowsReserved.includes(baseNameOnly)) {
    return {
      valid: false,
      error: `'${baseNameOnly}'은(는) 운영체제 시스템 예약어이므로 ${itemType} 이름으로 사용할 수 없습니다.`
    };
  }

  // 6. Max length check (255 bytes)
  if (Buffer.byteLength(trimmed, 'utf8') > 255) {
    return {
      valid: false,
      error: `${itemType} 이름의 길이가 너무 깁니다. (최대 255바이트)`
    };
  }

  return { valid: true, name: trimmed };
}

// Convert low-level OS/Node.js filesystem error codes to friendly Korean explanations
function formatSystemError(err, actionDesc = '작업') {
  if (!err) return `${actionDesc} 중 오류가 발생했습니다.`;
  const code = err.code || '';
  switch (code) {
    case 'EACCES':
    case 'EPERM':
      return `해당 위치에 ${actionDesc}을(를) 진행할 수 있는 쓰기/수정 권한이 없습니다 (${code}).\n폴더 권한이나 관리자 설정을 확인해주세요.`;
    case 'ENOENT':
      return `대상 파일 또는 상위 폴더 경로를 찾을 수 없습니다 (${code}).\n폴더가 이동되었거나 삭제되었는지 확인해주세요.`;
    case 'EEXIST':
      return `이미 동일한 이름의 파일 또는 폴더가 해당 위치에 존재합니다 (${code}).`;
    case 'EBUSY':
    case 'ETXTBSY':
      return `다른 프로그램에서 파일이나 폴더를 사용 중이어서 ${actionDesc}을(를) 진행할 수 없습니다 (${code}).\n사용 중인 프로그램을 닫고 다시 시도해주세요.`;
    case 'ENOSPC':
      return `디스크 저장 공간이 부족하여 ${actionDesc}을(를) 진행할 수 없습니다 (${code}).`;
    case 'ENAMETOOLONG':
      return `파일 또는 폴더 이름/경로가 너무 깁니다 (${code}).`;
    case 'EINVAL':
      return `이름에 운영체제에서 지원하지 않는 기호가 포함되어 있거나 경로가 올바르지 않습니다 (${code}).`;
    case 'EXDEV':
      return `서로 다른 디스크 드라이브 간에는 직접 이동/변경할 수 없습니다 (${code}).`;
    case 'ENOTEMPTY':
      return `폴더가 비어 있지 않아 작업을 진행할 수 없습니다 (${code}).`;
    default:
      return `${actionDesc} 실패: ${err.message || code || '알 수 없는 오류'}`;
  }
}

// Directory tree scanner
function scanDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const results = [];
  try {
    const list = fs.readdirSync(dirPath);
    // Sort: directories first, then alphabetical
    const sorted = list
      .filter(item => !item.startsWith('.') && item !== 'node_modules')
      .sort((a, b) => {
        const aIsDir = fs.statSync(path.join(dirPath, a)).isDirectory();
        const bIsDir = fs.statSync(path.join(dirPath, b)).isDirectory();
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      });

    for (const item of sorted) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      const isDir = stat.isDirectory();
      results.push({
        name: item,
        path: fullPath,
        isDir: isDir,
        children: isDir ? scanDirectory(fullPath) : []
      });
    }
  } catch (err) {
    console.error(`Error reading ${dirPath}:`, err.message);
  }
  return results;
}

// Recursively find a file with exact or case-insensitive matching name inside a directory
function findFileInDir(dir, targetName) {
  if (!fs.existsSync(dir)) return null;
  const targetLower = targetName.toLowerCase();
  try {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      if (item.startsWith('.') || item === 'node_modules') continue;
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        const found = findFileInDir(full, targetName);
        if (found) return found;
      } else {
        if (item.toLowerCase() === targetLower) return full;
      }
    }
  } catch (e) {}
  return null;
}

// Known binary/media extensions to skip during full-text content search
const BINARY_EXTENSIONS = new Set([
  '.exe', '.dll', '.bin', '.dat', '.iso', '.img', '.sys', '.class',
  '.zip', '.tar', '.gz', '.7z', '.rar', '.bz2', '.tgz',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svgz', '.tif', '.tiff',
  '.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac',
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.woff', '.woff2', '.ttf', '.eot', '.otf'
]);

function isSearchableFile(fileName, stat) {
  if (!stat || stat.size > 5 * 1024 * 1024) return false; // skip files > 5MB
  const ext = path.extname(fileName).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return false;
  return true;
}

// Search text recursively across all text files within a directory
function searchDirectoryContent(rootDir, query, maxResults = 500) {
  if (!query || !query.trim() || !fs.existsSync(rootDir)) {
    return { query: query || '', totalMatches: 0, totalFiles: 0, truncated: false, results: [] };
  }

  const normQuery = query.trim().normalize('NFC').toLowerCase();
  const results = [];
  let totalMatches = 0;
  let truncated = false;

  function traverse(dir) {
    if (totalMatches >= maxResults) {
      truncated = true;
      return;
    }
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }

    // Sort: directories first, then alphabetical
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    for (const ent of entries) {
      if (totalMatches >= maxResults) {
        truncated = true;
        break;
      }
      if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;

      const fullPath = path.join(dir, ent.name);

      if (ent.isDirectory()) {
        traverse(fullPath);
      } else if (ent.isFile()) {
        try {
          const stat = fs.statSync(fullPath);
          if (!isSearchableFile(ent.name, stat)) continue;

          const content = fs.readFileSync(fullPath, 'utf8');
          const normContent = content.normalize('NFC').toLowerCase();
          if (!normContent.includes(normQuery)) continue;

          const lines = content.split(/\r?\n/);
          const fileMatches = [];

          for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            if (totalMatches >= maxResults) {
              truncated = true;
              break;
            }
            const line = lines[lineIdx];
            const normLine = line.normalize('NFC').toLowerCase();
            let matchIdx = normLine.indexOf(normQuery);

            if (matchIdx !== -1) {
              while (matchIdx !== -1) {
                totalMatches++;
                const col = matchIdx + 1; // 1-based column

                // Extract a readable snippet around the match
                let snippet = line;
                let snippetMatchStart = matchIdx;
                if (line.length > 120) {
                  const startCut = Math.max(0, matchIdx - 35);
                  const endCut = Math.min(line.length, matchIdx + normQuery.length + 45);
                  snippet = (startCut > 0 ? '...' : '') + line.slice(startCut, endCut) + (endCut < line.length ? '...' : '');
                  snippetMatchStart = (startCut > 0 ? 3 : 0) + (matchIdx - startCut);
                }

                fileMatches.push({
                  line: lineIdx + 1,
                  column: col,
                  lineText: line,
                  snippet: snippet,
                  matchIndex: snippetMatchStart,
                  matchLength: normQuery.length
                });

                if (fileMatches.length >= 50) break; // limit matches per single file
                matchIdx = normLine.indexOf(normQuery, matchIdx + normQuery.length);
              }
            }
          }

          if (fileMatches.length > 0) {
            const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
            results.push({
              filePath: fullPath,
              relativePath: relPath || ent.name,
              fileName: ent.name,
              matchCount: fileMatches.length,
              matches: fileMatches
            });
          }
        } catch (e) {
          // Skip file on read error
        }
      }
    }
  }

  traverse(rootDir);

  return {
    query: query.trim(),
    totalMatches,
    totalFiles: results.length,
    truncated,
    results
  };
}

// Open file or URL with default system application (Excel, PDF viewer, Word, Browser, etc.)
function openExternalFile(filePathOrUrl) {
  return new Promise((resolve) => {
    let target = filePathOrUrl.trim();
    if (/^www\./i.test(target)) {
      target = 'https://' + target;
    }
    const isUrl = /^https?:\/\//i.test(target);
    if (!isUrl && !fs.existsSync(target)) {
      return resolve({ success: false, error: '파일을 찾을 수 없습니다: ' + target });
    }

    if (process.platform === 'win32') {
      const cmd = `cmd.exe /c start "" "${filePathOrUrl.replace(/"/g, '""')}"`;
      exec(cmd, { windowsHide: true }, (err) => {
        if (err) {
          const ps = `powershell -NoProfile -Command "Start-Process '${filePathOrUrl.replace(/'/g, "''")}'"`;
          exec(ps, (err2) => {
            if (err2) return resolve({ success: false, error: err2.message });
            resolve({ success: true });
          });
        } else {
          resolve({ success: true });
        }
      });
    } else if (process.platform === 'darwin') {
      exec(`open "${filePathOrUrl.replace(/"/g, '\\"')}"`, (err) => {
        if (err) return resolve({ success: false, error: err.message });
        resolve({ success: true });
      });
    } else {
      exec(`xdg-open "${filePathOrUrl.replace(/"/g, '\\"')}"`, (err) => {
        if (err) return resolve({ success: false, error: err.message });
        resolve({ success: true });
      });
    }
  });
}

// JSON Helper
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

// Parse request body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Serve static files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStatic(req, res, pathname) {
  let relativePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(__dirname, 'public', relativePath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  fs.createReadStream(filePath).pipe(res);
}

// Native OS Folder Picker
function openNativeFolderPicker(currentPath) {
  return new Promise((resolve) => {
    if (process.platform === 'darwin') {
      const defaultLoc = (currentPath && fs.existsSync(currentPath))
        ? ` default location (POSIX file "${currentPath.replace(/"/g, '\\"')}")`
        : '';
      const script = `osascript -e 'activate' -e 'POSIX path of (choose folder with prompt "메모를 저장할 폴더를 선택하세요"${defaultLoc})'`;
      exec(script, (err, stdout) => {
        if (err) return resolve({ success: false, cancelled: true });
        const chosen = stdout.trim();
        if (chosen) {
          return resolve({ success: true, rootFolder: chosen });
        }
        resolve({ success: false, cancelled: true });
      });
    } else if (process.platform === 'win32') {
      // 1. Primary: Windows Forms FolderBrowserDialog via PowerShell (STA mode, TopMost owner, string comparison)
      const psScript = [
        '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
        'Add-Type -AssemblyName System.Windows.Forms',
        'Add-Type -AssemblyName System.Drawing',
        '$owner = New-Object System.Windows.Forms.Form',
        '$owner.Text = "Desktop Memo"',
        '$owner.TopMost = $true',
        '$owner.Size = New-Object System.Drawing.Size(1, 1)',
        '$owner.Opacity = 0.01',
        '$owner.Show()',
        '$owner.Activate()',
        '$owner.BringToFront()',
        '$f = New-Object System.Windows.Forms.FolderBrowserDialog',
        '$f.ShowNewFolderButton = $true',
        '$f.Description = "메모를 저장할 폴더를 선택하세요"',
        'if ($f.ShowDialog($owner) -eq "OK") {',
        '    [Console]::WriteLine($f.SelectedPath)',
        '} else {',
        '    [Console]::WriteLine("__CANCEL__")',
        '}',
        '$owner.Close()',
        '$owner.Dispose()',
        '$f.Dispose()'
      ].join('\r\n');

      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      const psCmd = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -STA -EncodedCommand ${encoded}`;

      exec(psCmd, { timeout: 300000 }, (err, stdout, stderr) => {
        const out = (stdout || '').trim();
        if (!err && out) {
          if (out.includes('__CANCEL__')) {
            return resolve({ success: false, cancelled: true });
          }
          const lines = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const chosen = lines[lines.length - 1];
          if (chosen && chosen !== '__CANCEL__' && fs.existsSync(chosen)) {
            return resolve({ success: true, rootFolder: chosen });
          }
        }

        // 2. Fallback: VBScript Shell.Application BrowseForFolder with modern style (&H0050 = 80)
        // Written as pure ASCII to avoid any Windows ANSI/UTF code-page compilation errors
        const vbsScript = [
          'Set shell = CreateObject("Shell.Application")',
          'Set folder = shell.BrowseForFolder(0, "Select a folder for Desktop Memo", 80, 0)',
          'If Not folder Is Nothing Then',
          '    WScript.Echo folder.Self.Path',
          'Else',
          '    WScript.Echo "__CANCEL__"',
          'End If'
        ].join('\r\n');

        const vbsPath = path.join(os.tmpdir(), `memo_browse_${Date.now()}.vbs`);
        try {
          fs.writeFileSync(vbsPath, vbsScript, 'ascii');
          exec(`cscript //Nologo "${vbsPath}"`, { timeout: 300000 }, (vbsErr, vbsOut) => {
            try { fs.unlinkSync(vbsPath); } catch (e) {}
            const vOut = (vbsOut || '').trim();
            if (!vbsErr && vOut) {
              if (vOut.includes('__CANCEL__')) {
                return resolve({ success: false, cancelled: true });
              }
              const lines = vOut.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
              const chosen = lines[lines.length - 1];
              if (chosen && chosen !== '__CANCEL__' && fs.existsSync(chosen)) {
                return resolve({ success: true, rootFolder: chosen });
              }
            }
            resolve({ success: false, error: '시스템 탐색기 프로세스를 실행할 수 없습니다.' });
          });
        } catch (e) {
          resolve({ success: false, error: '탐색기 호출 실패: ' + e.message });
        }
      });
    } else {
      resolve({ success: false, error: '지원되지 않는 운영체제입니다.' });
    }
  });
}

// Server handler
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  try {
    if (pathname !== '/api/shutdown') {
      hasClientConnected = true;
      if (shutdownTimeout) {
        clearTimeout(shutdownTimeout);
        shutdownTimeout = null;
      }
    }

    // API: Heartbeat
    if (pathname === '/api/heartbeat') {
      return sendJSON(res, 200, { ok: true });
    }

    // API: Shutdown Beacon on Window Close (Accept both GET and POST)
    if (pathname === '/api/shutdown') {
      console.log('[INFO] 브라우저 창 닫힘 신호 수신. 서버를 안전하게 종료합니다.');
      if (shutdownTimeout) clearTimeout(shutdownTimeout);
      shutdownTimeout = setTimeout(() => {
        console.log('[INFO] 프로그램을 종료합니다.');
        process.exit(0);
      }, 2000);
      return sendJSON(res, 200, { ok: true });
    }

    // API: Get Config
    if (pathname === '/api/config' && req.method === 'GET') {
      const cfg = getConfig();
      return sendJSON(res, 200, { ...cfg, version: APP_VERSION });
    }

    // API: Update Config
    if (pathname === '/api/config' && req.method === 'POST') {
      const body = await parseBody(req);
      const cfg = getConfig();
      if (body.rootFolder) {
        if (!fs.existsSync(body.rootFolder)) {
          fs.mkdirSync(body.rootFolder, { recursive: true });
        }
        cfg.rootFolder = path.resolve(body.rootFolder);
      }
      if (body.lastOpenedFile !== undefined) {
        cfg.lastOpenedFile = body.lastOpenedFile;
      }
      saveConfig(cfg);
      return sendJSON(res, 200, cfg);
    }

    // API: Native Folder Picker Dialog
    if (pathname === '/api/browse-folder' && req.method === 'POST') {
      const current = getConfig().rootFolder;
      const result = await openNativeFolderPicker(current);
      if (result && result.success && result.rootFolder) {
        const cfg = getConfig();
        cfg.rootFolder = result.rootFolder;
        saveConfig(cfg);
        return sendJSON(res, 200, { success: true, rootFolder: result.rootFolder });
      }
      return sendJSON(res, 200, result || { success: false, cancelled: true });
    }

    // API: List Directories for in-app Folder Browser
    if (pathname === '/api/list-dirs' && req.method === 'GET') {
      let targetPath = parsedUrl.searchParams.get('path');
      if (!targetPath || !fs.existsSync(targetPath)) {
        targetPath = getConfig().rootFolder || os.homedir();
      }
      if (!fs.existsSync(targetPath)) {
        targetPath = os.homedir();
      }

      try {
        const stat = fs.statSync(targetPath);
        if (!stat.isDirectory()) {
          targetPath = path.dirname(targetPath);
        }
      } catch (e) {
        targetPath = os.homedir();
      }

      // Quick navigation shortcuts
      const home = os.homedir();
      const quickLocations = [
        { name: '📝 기본 메모 폴더', path: DEFAULT_MEMOS_DIR },
        { name: '🏠 사용자 홈', path: home },
        { name: '🖥️ 데스크탑 (바탕화면)', path: path.join(home, 'Desktop') },
        { name: '📄 문서', path: path.join(home, 'Documents') },
        { name: '📥 다운로드', path: path.join(home, 'Downloads') }
      ];
      if (process.platform === 'win32') {
        if (fs.existsSync('C:\\')) quickLocations.push({ name: '💾 로컬 디스크 (C:)', path: 'C:\\' });
        if (fs.existsSync('D:\\')) quickLocations.push({ name: '💾 로컬 디스크 (D:)', path: 'D:\\' });
      }
      const validQuickLocations = quickLocations.filter(loc => fs.existsSync(loc.path));

      let subdirs = [];
      try {
        const entries = fs.readdirSync(targetPath, { withFileTypes: true });
        for (const ent of entries) {
          if (ent.isDirectory() && !ent.name.startsWith('.')) {
            subdirs.push({
              name: ent.name,
              path: path.join(targetPath, ent.name)
            });
          }
        }
        subdirs.sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
      } catch (err) {
        console.error('List dirs error:', err);
      }

      const parentPath = path.dirname(targetPath);
      const hasParent = parentPath && parentPath !== targetPath;

      return sendJSON(res, 200, {
        currentPath: targetPath,
        parentPath: hasParent ? parentPath : null,
        quickLocations: validQuickLocations,
        folders: subdirs
      });
    }

    // API: Get Tree
    if (pathname === '/api/tree' && req.method === 'GET') {
      const reqPath = parsedUrl.searchParams.get('path') || getConfig().rootFolder;
      const tree = scanDirectory(reqPath);
      return sendJSON(res, 200, { rootFolder: reqPath, tree });
    }

    // API: Full-text Search across all files
    if (pathname === '/api/search' && req.method === 'GET') {
      const q = parsedUrl.searchParams.get('q') || '';
      const reqPath = parsedUrl.searchParams.get('path') || getConfig().rootFolder;
      const searchResult = searchDirectoryContent(reqPath, q);
      return sendJSON(res, 200, searchResult);
    }

    // API: Get File Content
    if (pathname === '/api/file' && req.method === 'GET') {
      const rawPath = parsedUrl.searchParams.get('path');
      const resolved = resolveFilePath(rawPath);
      if (!resolved || !fs.existsSync(resolved)) {
        return sendJSON(res, 404, { error: '파일을 찾을 수 없습니다.' });
      }
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        return sendJSON(res, 400, { error: '폴더는 직접 열 수 없습니다.' });
      }
      const content = fs.readFileSync(resolved, 'utf-8');
      return sendJSON(res, 200, { path: resolved, content, mtime: stat.mtimeMs });
    }

    // API: Save File Content
    if (pathname === '/api/file' && req.method === 'POST') {
      const { path: filePath, content } = await parseBody(req);
      if (!filePath) return sendJSON(res, 400, { error: 'Path is required' });
      try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content ?? '', 'utf-8');
        const stat = fs.statSync(filePath);
        return sendJSON(res, 200, { success: true, path: filePath, mtime: stat.mtimeMs });
      } catch (err) {
        console.error('Save file error:', err);
        return sendJSON(res, 500, { error: formatSystemError(err, '파일 저장') });
      }
    }

    // API: Create File
    if (pathname === '/api/create-file' && req.method === 'POST') {
      let { dirPath, fileName, autoName } = await parseBody(req);
      fileName = (fileName || '').trim();

      let targetDir = dirPath;
      if (targetDir && fs.existsSync(targetDir)) {
        const stat = fs.statSync(targetDir);
        if (!stat.isDirectory()) {
          targetDir = path.dirname(targetDir);
        }
      } else {
        targetDir = getConfig().rootFolder;
      }

      if (!targetDir || !fs.existsSync(targetDir)) {
        return sendJSON(res, 404, { error: '파일을 생성할 대상 폴더 경로를 찾을 수 없습니다. (폴더가 이동되었거나 삭제되었을 수 있습니다)' });
      }

      // If fileName is empty or autoName is true, generate automatic unique name (새 메모.txt, 새 메모 1.txt, ...)
      if (!fileName || autoName) {
        let base = fileName || '새 메모';
        if (base.toLowerCase().endsWith('.txt')) base = base.slice(0, -4);
        let candidate = `${base}.txt`;
        let counter = 1;
        while (fs.existsSync(path.join(targetDir, candidate))) {
          candidate = `${base} ${counter}.txt`;
          counter++;
        }
        fileName = candidate;
      } else {
        // Validate custom file name
        const ext = path.extname(fileName);
        const base = ext ? fileName.slice(0, -ext.length) : fileName;
        const v = validateName(base, '파일');
        if (!v.valid) {
          return sendJSON(res, 400, { error: v.error });
        }
        if (!ext) fileName += '.txt';
        const fullPath = path.join(targetDir, fileName);
        if (fs.existsSync(fullPath)) {
          return sendJSON(res, 400, { error: `'${path.basename(fileName)}' 파일이 해당 위치에 이미 존재합니다.` });
        }
      }

      try {
        const fullPath = path.join(targetDir, fileName);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, '', 'utf-8');
        return sendJSON(res, 200, { success: true, path: fullPath, fileName });
      } catch (err) {
        console.error('Create file error:', err);
        return sendJSON(res, 500, { error: formatSystemError(err, '파일 생성') });
      }
    }

    // API: Create Folder
    if (pathname === '/api/create-folder' && req.method === 'POST') {
      const { dirPath, folderName } = await parseBody(req);
      const name = (folderName || '').trim();
      const v = validateName(name, '폴더');
      if (!v.valid) {
        return sendJSON(res, 400, { error: v.error });
      }

      let targetDir = dirPath;
      if (targetDir && fs.existsSync(targetDir)) {
        const stat = fs.statSync(targetDir);
        if (!stat.isDirectory()) {
          targetDir = path.dirname(targetDir);
        }
      } else {
        targetDir = getConfig().rootFolder;
      }

      if (!targetDir || !fs.existsSync(targetDir)) {
        return sendJSON(res, 404, { error: '폴더를 생성할 상위 경로를 찾을 수 없습니다. (폴더가 이동되었거나 삭제되었을 수 있습니다)' });
      }

      const fullPath = path.join(targetDir, v.name);
      if (fs.existsSync(fullPath)) {
        return sendJSON(res, 400, { error: `'${v.name}'(이)라는 이름의 폴더가 해당 위치에 이미 존재합니다. 다른 이름을 사용해주세요.` });
      }

      try {
        fs.mkdirSync(fullPath, { recursive: true });
        return sendJSON(res, 200, { success: true, path: fullPath });
      } catch (err) {
        console.error('Create folder error:', err);
        return sendJSON(res, 500, { error: formatSystemError(err, '폴더 생성') });
      }
    }

    // API: Rename
    if (pathname === '/api/rename' && req.method === 'POST') {
      const { oldPath, newName } = await parseBody(req);
      if (!oldPath || !fs.existsSync(oldPath)) {
        return sendJSON(res, 404, { error: '이름을 변경할 원본 파일 또는 폴더를 찾을 수 없습니다.' });
      }

      let isDir = false;
      try {
        isDir = fs.statSync(oldPath).isDirectory();
      } catch (e) {
        return sendJSON(res, 404, { error: '원본 항목 정보를 읽을 수 없습니다.' });
      }
      const itemType = isDir ? '폴더' : '파일';

      let name = (newName || '').trim();
      const oldExt = path.extname(oldPath);
      // If user typed name without extension for file, keep old extension
      if (!isDir && !path.extname(name) && oldExt) {
        name += oldExt;
      }

      const checkName = (!isDir && path.extname(name)) ? name.slice(0, -path.extname(name).length) : name;
      const v = validateName(checkName, itemType);
      if (!v.valid) {
        return sendJSON(res, 400, { error: v.error });
      }

      const parentDir = path.dirname(oldPath);
      const newPath = path.join(parentDir, name);
      if (fs.existsSync(newPath) && path.resolve(newPath) !== path.resolve(oldPath)) {
        return sendJSON(res, 400, { error: `'${name}'(이)라는 이름의 ${itemType}이(가) 이미 존재합니다. 다른 이름을 사용해주세요.` });
      }

      try {
        await safeRename(oldPath, newPath);
      } catch (err) {
        console.error('Rename error:', err);
        return sendJSON(res, 500, { error: formatSystemError(err, `${itemType} 이름 변경`) });
      }

      // If lastOpenedFile is inside or equal to oldPath, update config
      const cfg = getConfig();
      if (cfg.lastOpenedFile) {
        const lastNorm = path.resolve(cfg.lastOpenedFile);
        const oldNorm = path.resolve(oldPath);
        if (lastNorm === oldNorm) {
          cfg.lastOpenedFile = newPath;
          saveConfig(cfg);
        } else if (lastNorm.startsWith(oldNorm + path.sep)) {
          cfg.lastOpenedFile = path.join(newPath, lastNorm.slice(oldNorm.length + 1));
          saveConfig(cfg);
        }
      }

      return sendJSON(res, 200, { success: true, newPath });
    }

    // API: Move File or Folder
    if (pathname === '/api/move' && req.method === 'POST') {
      const { sourcePath, targetDirPath } = await parseBody(req);
      if (!sourcePath || !fs.existsSync(sourcePath)) {
        return sendJSON(res, 404, { error: '이동할 항목을 찾을 수 없습니다.' });
      }

      let destDir = targetDirPath;
      if (!destDir || !fs.existsSync(destDir)) {
        destDir = getConfig().rootFolder;
      }
      const dirStat = fs.statSync(destDir);
      if (!dirStat.isDirectory()) {
        destDir = path.dirname(destDir);
      }

      // Check if moving to same directory
      const currentParent = path.dirname(sourcePath);
      if (path.resolve(currentParent) === path.resolve(destDir)) {
        return sendJSON(res, 400, { error: '이미 해당 폴더에 위치해 있습니다.' });
      }

      // If moving a directory, check if destDir is within sourcePath
      const srcStat = fs.statSync(sourcePath);
      if (srcStat.isDirectory()) {
        const rel = path.relative(sourcePath, destDir);
        if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
          return sendJSON(res, 400, { error: '폴더를 자기 자신의 하위 폴더로 이동할 수 없습니다.' });
        }
      }

      const itemName = path.basename(sourcePath);
      const newPath = path.join(destDir, itemName);
      if (fs.existsSync(newPath)) {
        return sendJSON(res, 400, { error: `'${itemName}' 항목이 대상 위치에 이미 존재합니다.` });
      }

      try {
        await safeRename(sourcePath, newPath);
      } catch (err) {
        console.error('Move error:', err);
        return sendJSON(res, 500, { error: formatSystemError(err, '항목 이동') });
      }

      // If lastOpenedFile is inside or equal to sourcePath, update config
      const cfg = getConfig();
      if (cfg.lastOpenedFile) {
        const lastNorm = path.resolve(cfg.lastOpenedFile);
        const srcNorm = path.resolve(sourcePath);
        if (lastNorm === srcNorm) {
          cfg.lastOpenedFile = newPath;
          saveConfig(cfg);
        } else if (lastNorm.startsWith(srcNorm + path.sep)) {
          cfg.lastOpenedFile = path.join(newPath, lastNorm.slice(srcNorm.length + 1));
          saveConfig(cfg);
        }
      }

      return sendJSON(res, 200, { success: true, oldPath: sourcePath, newPath: newPath });
    }

    // API: Delete
    if (pathname === '/api/delete' && req.method === 'POST') {
      const { targetPath } = await parseBody(req);
      if (!targetPath || !fs.existsSync(targetPath)) {
        return sendJSON(res, 404, { error: 'Target not found' });
      }

      try {
        const stat = fs.statSync(targetPath);
        if (stat.isDirectory()) {
          fs.rmSync(targetPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(targetPath);
        }
      } catch (err) {
        console.error('Delete error:', err);
        return sendJSON(res, 500, { error: formatSystemError(err, '항목 삭제') });
      }

      // If lastOpenedFile is the deleted item or located inside the deleted folder, clear it
      const cfg = getConfig();
      if (cfg.lastOpenedFile) {
        const lastNorm = path.resolve(cfg.lastOpenedFile);
        const targetNorm = path.resolve(targetPath);
        if (lastNorm === targetNorm || lastNorm.startsWith(targetNorm + path.sep)) {
          cfg.lastOpenedFile = '';
          saveConfig(cfg);
        }
      }

      return sendJSON(res, 200, { success: true });
    }

    // API: Open External File or URL with OS default application (Excel, PDF viewer, Word, etc.)
    if (pathname === '/api/open-external' && req.method === 'POST') {
      const { target, currentDir } = await parseBody(req);
      if (!target) return sendJSON(res, 400, { error: 'Target is required' });

      let resolvedTarget = target.trim();
      if (/^www\./i.test(resolvedTarget)) {
        resolvedTarget = 'https://' + resolvedTarget;
      }
      const isUrl = /^https?:\/\//i.test(resolvedTarget);

      if (!isUrl) {
        resolvedTarget = resolvedTarget.replace(/^file:\/\/\/?/i, '');
        try { resolvedTarget = decodeURIComponent(resolvedTarget); } catch (e) {}

        const rootDir = getConfig().rootFolder;

        if (fs.existsSync(resolvedTarget)) {
          // Absolute path already valid
        } else if (currentDir && fs.existsSync(path.join(currentDir, resolvedTarget))) {
          resolvedTarget = path.join(currentDir, resolvedTarget);
        } else if (fs.existsSync(path.join(rootDir, resolvedTarget))) {
          resolvedTarget = path.join(rootDir, resolvedTarget);
        } else {
          // Search recursively in rootFolder
          const found = findFileInDir(rootDir, path.basename(resolvedTarget));
          if (found) {
            resolvedTarget = found;
          } else {
            return sendJSON(res, 404, { error: `'${path.basename(resolvedTarget)}' 파일을 찾을 수 없습니다.` });
          }
        }
      }

      const result = await openExternalFile(resolvedTarget);
      if (result.success) {
        return sendJSON(res, 200, { success: true, openedPath: resolvedTarget });
      } else {
        return sendJSON(res, 500, { error: result.error || '프로그램 실행에 실패했습니다.' });
      }
    }

    // Static Assets
    serveStatic(req, res, pathname);
  } catch (err) {
    console.error('Server error:', err);
    sendJSON(res, 500, { error: err.message });
  }
});

// Open in Standalone App Window Mode (No browser address bar or tabs)
function openBrowser(url) {
  if (process.env.NO_BROWSER) return;
  if (process.platform === 'darwin') {
    // Mac: Google Chrome App Mode
    exec(`open -na "Google Chrome" --args --app="${url}"`, (err) => {
      if (err) exec(`open "${url}"`);
    });
  } else if (process.platform === 'win32') {
    // Windows: MS Edge (built-in) or Chrome App Mode
    exec(`start msedge --app="${url}"`, (err) => {
      if (err) {
        exec(`start chrome --app="${url}"`, (err2) => {
          if (err2) exec(`start "${url}"`);
        });
      }
    });
  } else {
    exec(`google-chrome --app="${url}" || xdg-open "${url}"`);
  }
}

// Handle port collision gracefully (reuse existing instance)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[INFO] Desktop Memo가 이미 실행 중입니다 (포트 ${PORT}). 브라우저 창을 엽니다.`);
    openBrowser(`http://localhost:${PORT}`);
    process.exit(0);
  } else {
    console.error('서버 오류:', err);
    process.exit(1);
  }
});

// Start server
server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n======================================================`);
  console.log(`  📝 데스크톱 메모 프로그램이 실행되었습니다!`);
  console.log(`  접속 주소: ${url}`);
  console.log(`======================================================\n`);
  openBrowser(url);
});
