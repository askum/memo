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

// Lifecycle & Auto-Shutdown Watchdog
const serverStartTime = Date.now();
let lastHeartbeatTime = Date.now();
let hasClientConnected = false;
let shutdownTimeout = null;

// Watchdog: If no client heartbeat received within 4.5 seconds after connection, terminate!
const WATCHDOG_CHECK_INTERVAL_MS = 1000;
const HEARTBEAT_TIMEOUT_MS = 4500;

setInterval(() => {
  if (hasClientConnected) {
    const elapsed = Date.now() - lastHeartbeatTime;
    if (elapsed > HEARTBEAT_TIMEOUT_MS) {
      console.log(`[INFO] 브라우저 창 닫힘 감지 (${Math.round(elapsed / 1000)}초간 하트비트 없음). 서버를 안전하게 종료합니다.`);
      process.exit(0);
    }
  } else if (Date.now() - serverStartTime > 30000) {
    // If no browser connected within 30 seconds of server launch, exit
    console.log('[INFO] 브라우저 연결 없음 (30초 경과). 서버를 자동 종료합니다.');
    process.exit(0);
  }
}, WATCHDOG_CHECK_INTERVAL_MS);

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

// Auto-repair garbled folder/file names resulting from Windows CP949/Latin-1 zip extraction
function repairGarbledEntries(folder) {
  if (!fs.existsSync(folder)) return;
  try {
    const entries = fs.readdirSync(folder);
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const full = path.join(folder, entry);
      const isDir = fs.statSync(full).isDirectory();

      let targetName = null;
      if (isDir) {
        if (entry.includes('媛쒖씤') || entry.includes('媛') || (entry.includes('씤') && !entry.includes('개인'))) {
          targetName = '개인';
        } else if (entry.includes('뾽') || entry.includes('몮臾') || (entry.includes('臾') && !entry.includes('업무'))) {
          targetName = '업무';
        }
      } else {
        if (entry.includes('뀒') || entry.includes('í') || (entry.includes('듃') && !entry.includes('테스트'))) {
          targetName = '테스트.txt';
        } else if (entry.includes('í') || entry.includes('ë') || (entry.includes('í') && !entry.includes('환영합니다'))) {
          targetName = '환영합니다.txt';
        }
      }

      if (targetName && targetName !== entry) {
        const dest = path.join(folder, targetName);
        if (!fs.existsSync(dest)) {
          fs.renameSync(full, dest);
          console.log(`[Auto-Repair] Renamed garbled: '${entry}' -> '${targetName}'`);
        }
      }

      // Check subdirectories
      if (isDir) {
        const subPath = targetName ? path.join(folder, targetName) : full;
        repairGarbledEntries(subPath);
      }
    }
  } catch (err) {
    console.error('Auto-repair warning:', err.message);
  }
}

// Ensure initial seed files
function ensureSeedFiles(folder) {
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

  // 1. Repair any garbled names from zip extraction
  repairGarbledEntries(folder);

  // 2. Ensure standard folders and files exist
  const personalDir = path.join(folder, '개인');
  const workDir = path.join(folder, '업무');
  const personalTest = path.join(personalDir, '테스트.txt');
  const workTest = path.join(workDir, '테스트.txt');
  const welcomeFile = path.join(folder, '환영합니다.txt');

  if (!fs.existsSync(personalDir)) fs.mkdirSync(personalDir, { recursive: true });
  if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

  if (!fs.existsSync(personalTest)) {
    const src = path.join(DEFAULT_MEMOS_DIR, '개인', '테스트.txt');
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, personalTest);
    } else {
      fs.writeFileSync(personalTest, `📝 개인 메모 테스트\n\n이 메모는 [개인] 폴더의 예시 메모입니다.\n개인적인 생각, 일기, 학습 노트 등을 자유롭게 기록해 보세요.\n\n---\n\n📌 다른 메모로 이동하기 (더블 클릭):\n- 시작 안내문: [[환영합니다]]\n- 업무 메모: [[업무/테스트]]\n`, 'utf-8');
    }
  }

  if (!fs.existsSync(workTest)) {
    const src = path.join(DEFAULT_MEMOS_DIR, '업무', '테스트.txt');
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, workTest);
    } else {
      fs.writeFileSync(workTest, `📝 업무 메모 테스트\n\n이 메모는 [업무] 폴더의 예시 메모입니다.\n업무 일지, 회의록, 프로젝트 계획 등을 체계적으로 관리해 보세요.\n\n---\n\n📌 다른 메모로 이동하기 (더블 클릭):\n- 시작 안내문: [[환영합니다]]\n- 개인 메모: [[개인/테스트]]\n`, 'utf-8');
    }
  }

  if (!fs.existsSync(welcomeFile)) {
    const src = path.join(DEFAULT_MEMOS_DIR, '환영합니다.txt');
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, welcomeFile);
    } else {
      fs.writeFileSync(welcomeFile, `📝 데스크톱 메모장에 오신 것을 환영합니다!\n\n- 개인 메모: [[개인/테스트]]\n- 업무 메모: [[업무/테스트]]\n`, 'utf-8');
    }
  }
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
    // API: Heartbeat
    if (pathname === '/api/heartbeat') {
      lastHeartbeatTime = Date.now();
      hasClientConnected = true;
      if (shutdownTimeout) {
        clearTimeout(shutdownTimeout);
        shutdownTimeout = null;
      }
      return sendJSON(res, 200, { ok: true });
    }

    // API: Shutdown Beacon on Window Close (Accept both GET and POST)
    if (pathname === '/api/shutdown') {
      console.log('[INFO] 브라우저 창 닫힘 신호 수신. 서버를 안전하게 종료합니다.');
      if (shutdownTimeout) clearTimeout(shutdownTimeout);
      shutdownTimeout = setTimeout(() => {
        console.log('[INFO] 프로그램을 종료합니다.');
        process.exit(0);
      }, 1000);
      return sendJSON(res, 200, { ok: true });
    }

    // API: Get Config
    if (pathname === '/api/config' && req.method === 'GET') {
      const cfg = getConfig();
      ensureSeedFiles(cfg.rootFolder);
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
        ensureSeedFiles(cfg.rootFolder);
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
        ensureSeedFiles(result.rootFolder);
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
      ensureSeedFiles(reqPath);
      const tree = scanDirectory(reqPath);
      return sendJSON(res, 200, { rootFolder: reqPath, tree });
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
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content ?? '', 'utf-8');
      const stat = fs.statSync(filePath);
      return sendJSON(res, 200, { success: true, path: filePath, mtime: stat.mtimeMs });
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
        if (!path.extname(fileName)) fileName += '.txt';
        const fullPath = path.join(targetDir, fileName);
        if (fs.existsSync(fullPath)) {
          return sendJSON(res, 400, { error: `'${fileName}' 파일이 이미 존재합니다.` });
        }
      }

      const fullPath = path.join(targetDir, fileName);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, '', 'utf-8');
      return sendJSON(res, 200, { success: true, path: fullPath, fileName });
    }

    // API: Create Folder
    if (pathname === '/api/create-folder' && req.method === 'POST') {
      const { dirPath, folderName } = await parseBody(req);
      const name = (folderName || '').trim();
      if (!name) return sendJSON(res, 400, { error: '폴더 이름을 입력하세요.' });

      let targetDir = dirPath;
      if (targetDir && fs.existsSync(targetDir)) {
        const stat = fs.statSync(targetDir);
        if (!stat.isDirectory()) {
          targetDir = path.dirname(targetDir);
        }
      } else {
        targetDir = getConfig().rootFolder;
      }

      const fullPath = path.join(targetDir, name);
      if (fs.existsSync(fullPath)) {
        return sendJSON(res, 400, { error: `'${name}' 폴더가 이미 존재합니다.` });
      }
      fs.mkdirSync(fullPath, { recursive: true });
      return sendJSON(res, 200, { success: true, path: fullPath });
    }

    // API: Rename
    if (pathname === '/api/rename' && req.method === 'POST') {
      const { oldPath, newName } = await parseBody(req);
      let name = (newName || '').trim();
      if (!name) return sendJSON(res, 400, { error: '새 이름을 입력하세요.' });
      const oldExt = path.extname(oldPath);
      if (!path.extname(name) && oldExt) {
        name += oldExt;
      }
      const parentDir = path.dirname(oldPath);
      const newPath = path.join(parentDir, name);
      if (fs.existsSync(newPath)) {
        return sendJSON(res, 400, { error: `'${name}' 항목이 이미 존재합니다.` });
      }
      fs.renameSync(oldPath, newPath);
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

      fs.renameSync(sourcePath, newPath);
      return sendJSON(res, 200, { success: true, oldPath: sourcePath, newPath: newPath });
    }

    // API: Delete
    if (pathname === '/api/delete' && req.method === 'POST') {
      const { targetPath } = await parseBody(req);
      if (!targetPath || !fs.existsSync(targetPath)) {
        return sendJSON(res, 404, { error: 'Target not found' });
      }
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
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
