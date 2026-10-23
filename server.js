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
const APP_VERSION = 'v1.0.0';

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DEFAULT_MEMOS_DIR)) fs.mkdirSync(DEFAULT_MEMOS_DIR, { recursive: true });

// Shutdown tracking on window close
let shutdownTimeout = null;

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
    const isUrl = /^https?:\/\//i.test(filePathOrUrl);
    if (!isUrl && !fs.existsSync(filePathOrUrl)) {
      return resolve({ success: false, error: '파일을 찾을 수 없습니다: ' + filePathOrUrl });
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
    // API: Heartbeat (Cancels any pending shutdown timer on window refresh)
    if (pathname === '/api/heartbeat' && req.method === 'POST') {
      if (shutdownTimeout) {
        clearTimeout(shutdownTimeout);
        shutdownTimeout = null;
      }
      return sendJSON(res, 200, { ok: true });
    }

    // API: Shutdown Beacon on Window Close
    if (pathname === '/api/shutdown' && req.method === 'POST') {
      console.log('[INFO] 브라우저 창 닫힘 신호 수신. 3초 후 서버를 안전하게 종료합니다.');
      if (shutdownTimeout) clearTimeout(shutdownTimeout);
      shutdownTimeout = setTimeout(() => {
        console.log('[INFO] 프로그램을 종료합니다.');
        process.exit(0);
      }, 3000);
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
      let { dirPath, fileName } = await parseBody(req);
      fileName = (fileName || '').trim();
      if (!fileName) return sendJSON(res, 400, { error: '파일 이름을 입력하세요.' });
      if (!path.extname(fileName)) fileName += '.txt';

      let targetDir = dirPath;
      if (targetDir && fs.existsSync(targetDir)) {
        const stat = fs.statSync(targetDir);
        if (!stat.isDirectory()) {
          targetDir = path.dirname(targetDir);
        }
      } else {
        targetDir = getConfig().rootFolder;
      }

      const fullPath = path.join(targetDir, fileName);
      if (fs.existsSync(fullPath)) {
        return sendJSON(res, 400, { error: `'${fileName}' 파일이 이미 존재합니다.` });
      }
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, '', 'utf-8');
      return sendJSON(res, 200, { success: true, path: fullPath });
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
