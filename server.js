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

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DEFAULT_MEMOS_DIR)) fs.mkdirSync(DEFAULT_MEMOS_DIR, { recursive: true });

// Heartbeat & Auto-Shutdown tracking
let lastHeartbeat = Date.now();
let hasClientEverConnected = false;
let shutdownTimeout = null;

// Watchdog: check every 2 seconds
// If client connected at least once and no heartbeat for 5 seconds, exit cleanly
setInterval(() => {
  if (hasClientEverConnected && (Date.now() - lastHeartbeat > 5000)) {
    console.log('\n[INFO] 메모 창이 닫혀 프로그램을 안전하게 종료합니다.');
    process.exit(0);
  }
}, 2000);

// Helper to resolve file path handling Unicode NFC/NFD on macOS
function resolveFilePath(rawPath) {
  if (!rawPath) return null;
  if (fs.existsSync(rawPath)) return rawPath;
  const nfc = rawPath.normalize('NFC');
  if (fs.existsSync(nfc)) return nfc;
  const nfd = rawPath.normalize('NFD');
  if (fs.existsSync(nfd)) return nfd;
  return null;
}

// Ensure initial seed files
function ensureSeedFiles(folder) {
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  const entries = fs.readdirSync(folder).filter(f => !f.startsWith('.'));
  if (entries.length === 0) {
    fs.mkdirSync(path.join(folder, '업무'), { recursive: true });
    fs.mkdirSync(path.join(folder, '개인'), { recursive: true });
    fs.mkdirSync(path.join(folder, '아이디어'), { recursive: true });
    const welcomeText = `📝 데스크톱 메모장에 오신 것을 환영합니다!

왼쪽 창에서 폴더를 지정하고, 원하는 위치에 파일이나 새 폴더를 바로 만들어보세요.

📌 주요 기능:
1. 폴더 선택: 좌측 상단 [폴더 변경] 버튼으로 원하는 메모 저장 위치를 지정할 수 있습니다.
2. 새 메모 생성: [+ 📝 새 메모] 버튼을 누르면 새 메모가 생성됩니다.
3. 새 폴더 생성: [+ 📁 새 폴더] 버튼으로 하위 폴더를 자유롭게 만듭니다.
4. 메모 간 이동: 본문에 [[회의록]] 같은 링크를 적어두고 더블 클릭하면 바로 이동합니다.
5. 실시간 자동 저장: 우측 창에서 메모를 입력하면 파일로 즉시 자동 저장됩니다.
`;
    fs.writeFileSync(path.join(folder, '환영합니다.txt'), welcomeText, 'utf-8');
  }
}

// Config manager
function getConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (cfg.rootFolder && fs.existsSync(cfg.rootFolder)) {
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
  return new Promise((resolve, reject) => {
    if (process.platform === 'darwin') {
      const script = `osascript -e 'tell application (path to frontmost application as text) to set myFolder to choose folder with prompt "메모를 저장할 폴더를 선택하세요"' -e 'POSIX path of myFolder'`;
      exec(script, (err, stdout) => {
        if (err) return resolve(null); // Cancelled or closed
        const chosen = stdout.trim();
        resolve(chosen || null);
      });
    } else if (process.platform === 'win32') {
      const psScript = `powershell -NoProfile -Command "& {Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = '메모를 저장할 폴더를 선택하세요'; if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }}"`;
      exec(psScript, (err, stdout) => {
        if (err) return resolve(null);
        const chosen = stdout.trim();
        resolve(chosen || null);
      });
    } else {
      resolve(null);
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
    if (pathname === '/api/heartbeat' && req.method === 'POST') {
      hasClientEverConnected = true;
      lastHeartbeat = Date.now();
      if (shutdownTimeout) {
        clearTimeout(shutdownTimeout);
        shutdownTimeout = null;
      }
      return sendJSON(res, 200, { ok: true });
    }

    // API: Shutdown Beacon on Window Close
    if (pathname === '/api/shutdown' && req.method === 'POST') {
      console.log('[INFO] 브라우저 창 닫힘 신호 수신. 잠시 후 종료합니다.');
      if (shutdownTimeout) clearTimeout(shutdownTimeout);
      shutdownTimeout = setTimeout(() => {
        console.log('[INFO] 프로그램을 종료합니다.');
        process.exit(0);
      }, 1500);
      return sendJSON(res, 200, { ok: true });
    }

    // API: Get Config
    if (pathname === '/api/config' && req.method === 'GET') {
      const cfg = getConfig();
      ensureSeedFiles(cfg.rootFolder);
      return sendJSON(res, 200, cfg);
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
      const picked = await openNativeFolderPicker(current);
      if (picked) {
        const cfg = getConfig();
        cfg.rootFolder = picked;
        ensureSeedFiles(picked);
        saveConfig(cfg);
        return sendJSON(res, 200, { success: true, rootFolder: picked });
      }
      return sendJSON(res, 200, { success: false, cancelled: true });
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
      return sendJSON(res, 200, { path: resolved, content });
    }

    // API: Save File Content
    if (pathname === '/api/file' && req.method === 'POST') {
      const { path: filePath, content } = await parseBody(req);
      if (!filePath) return sendJSON(res, 400, { error: 'Path is required' });
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content ?? '', 'utf-8');
      return sendJSON(res, 200, { success: true, path: filePath });
    }

    // API: Create File
    if (pathname === '/api/create-file' && req.method === 'POST') {
      let { dirPath, fileName } = await parseBody(req);
      fileName = (fileName || '').trim();
      if (!fileName) return sendJSON(res, 400, { error: '파일 이름을 입력하세요.' });
      if (!path.extname(fileName)) fileName += '.txt';
      const fullPath = path.join(dirPath, fileName);
      if (fs.existsSync(fullPath)) {
        return sendJSON(res, 400, { error: `'${fileName}' 파일이 이미 존재합니다.` });
      }
      fs.writeFileSync(fullPath, '', 'utf-8');
      return sendJSON(res, 200, { success: true, path: fullPath });
    }

    // API: Create Folder
    if (pathname === '/api/create-folder' && req.method === 'POST') {
      const { dirPath, folderName } = await parseBody(req);
      const name = (folderName || '').trim();
      if (!name) return sendJSON(res, 400, { error: '폴더 이름을 입력하세요.' });
      const fullPath = path.join(dirPath, name);
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
      return sendJSON(res, 200, { success: true });
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

// Start server
server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n======================================================`);
  console.log(`  📝 데스크톱 메모 프로그램이 실행되었습니다!`);
  console.log(`  접속 주소: ${url}`);
  console.log(`======================================================\n`);
  openBrowser(url);
});
