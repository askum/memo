/**
 * Desktop Memo Frontend Client
 */
const savedLinePref = localStorage.getItem('memo_show_line_numbers');

let state = {
  rootFolder: '',
  currentFilePath: null,
  treeData: [],
  selectedNodePath: null,
  selectedNodeIsDir: false,
  saveTimeout: null,
  maxSaveTimeout: null,
  isDirty: false,
  lastSavedContent: null,
  lastSavedTimeStr: '',
  showLineNumbers: savedLinePref !== null ? savedLinePref === 'true' : true
};

// Navigation History
let navHistory = {
  past: [],
  future: []
};

// DOM Elements
const sidebar = document.getElementById('sidebar');
const splitter = document.getElementById('splitter');
const currentFolderName = document.getElementById('currentFolderName');
const btnChangeFolder = document.getElementById('btnChangeFolder');
const btnNewFile = document.getElementById('btnNewFile');
const btnNewFolder = document.getElementById('btnNewFolder');
const btnRefresh = document.getElementById('btnRefresh');
const treeSearchInput = document.getElementById('treeSearchInput');
const treeRoot = document.getElementById('treeRoot');
const btnThemeToggle = document.getElementById('btnThemeToggle');

const btnNavBack = document.getElementById('btnNavBack');
const btnNavForward = document.getElementById('btnNavForward');
const fileIcon = document.getElementById('fileIcon');
const fileTitle = document.getElementById('fileTitle');
const filePathDisplay = document.getElementById('filePathDisplay');
const btnToggleLineNumbers = document.getElementById('btnToggleLineNumbers');
const saveStatusBadge = document.getElementById('saveStatusBadge');
const btnManualSave = document.getElementById('btnManualSave');
const btnInsertLink = document.getElementById('btnInsertLink');
const emptyState = document.getElementById('emptyState');
const editorWorkspace = document.getElementById('editorWorkspace');
const editorGutter = document.getElementById('editorGutter');
const gutterInner = document.getElementById('gutterInner');
const memoTextarea = document.getElementById('memoTextarea');

const charCount = document.getElementById('charCount');
const wordCount = document.getElementById('wordCount');
const cursorPos = document.getElementById('cursorPos');
const lastSavedTime = document.getElementById('lastSavedTime');

// Modal Elements
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const modalInput = document.getElementById('modalInput');
const btnModalCancel = document.getElementById('btnModalCancel');
const btnModalConfirm = document.getElementById('btnModalConfirm');
let modalCallback = null;

// Link Modal Elements
const linkModalOverlay = document.getElementById('linkModalOverlay');
const linkSearchInput = document.getElementById('linkSearchInput');
const linkItemsList = document.getElementById('linkItemsList');
const btnLinkModalCancel = document.getElementById('btnLinkModalCancel');

// Help Modal Elements
const btnHelp = document.getElementById('btnHelp');
const btnFooterHelp = document.getElementById('btnFooterHelp');
const helpModalOverlay = document.getElementById('helpModalOverlay');
const btnHelpModalClose = document.getElementById('btnHelpModalClose');
const btnHelpModalConfirm = document.getElementById('btnHelpModalConfirm');

function openHelpModal() {
  if (helpModalOverlay) helpModalOverlay.classList.remove('hidden');
}

function closeHelpModal() {
  if (helpModalOverlay) helpModalOverlay.classList.add('hidden');
}

// Folder Browser Modal Elements
const folderBrowserModalOverlay = document.getElementById('folderBrowserModalOverlay');
const fbCurrentPathDisplay = document.getElementById('fbCurrentPathDisplay');
const fbQuickList = document.getElementById('fbQuickList');
const fbFolderList = document.getElementById('fbFolderList');
const btnFbGoUp = document.getElementById('btnFbGoUp');
const btnFbNewFolder = document.getElementById('btnFbNewFolder');
const btnFbNativePicker = document.getElementById('btnFbNativePicker');
const btnFbClose = document.getElementById('btnFbClose');
const btnFbCancel = document.getElementById('btnFbCancel');
const btnFbConfirm = document.getElementById('btnFbConfirm');

let fbState = {
  browsingPath: '',
  selectedPath: '',
  parentPath: null
};

// Helper to hide file extension in UI
function getDisplayName(name, isDir) {
  if (isDir || !name) return name || '';
  return name.replace(/\.(txt|md|markdown)$/i, '');
}

// Format timestamp for display
function formatTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timePart = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (isToday) {
    return timePart;
  }
  const datePart = `${d.getMonth() + 1}/${d.getDate()}`;
  return `${datePart} ${timePart}`;
}

// Theme Manager (Light / Dark Mode)
function initTheme() {
  const saved = localStorage.getItem('memo_theme');
  if (saved === 'dark' || saved === 'light') {
    applyTheme(saved, false);
  } else {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(isDark ? 'dark' : 'light', false);
  }

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('memo_theme')) {
        applyTheme(e.matches ? 'dark' : 'light', false);
      }
    });
  }
}

function applyTheme(theme, save = true) {
  document.documentElement.setAttribute('data-theme', theme);
  if (save) {
    localStorage.setItem('memo_theme', theme);
  }
  if (btnThemeToggle) {
    if (theme === 'dark') {
      btnThemeToggle.textContent = '☀️';
      btnThemeToggle.title = '라이트 모드로 변경';
    } else {
      btnThemeToggle.textContent = '🌙';
      btnThemeToggle.title = '다크 모드로 변경';
    }
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next, true);
}

// Init Application
async function init() {
  initTheme();
  updateLineNumbersVisibility();
  setupSplitter();
  setupKeyboardShortcuts();
  setupEventListeners();
  startHeartbeat();

  try {
    const configRes = await fetch('/api/config');
    const config = await configRes.json();
    state.rootFolder = config.rootFolder;
    updateRootFolderDisplay();
    await loadTree();

    if (config.lastOpenedFile) {
      await loadFile(config.lastOpenedFile);
    }
  } catch (err) {
    console.error('Failed to init:', err);
  }
}

function updateRootFolderDisplay() {
  const parts = state.rootFolder.split(/[\\/]/);
  const name = parts[parts.length - 1] || state.rootFolder;
  currentFolderName.textContent = `📁 ${name}`;
  currentFolderName.title = state.rootFolder;
}

// Load Tree
async function loadTree() {
  try {
    const res = await fetch(`/api/tree?path=${encodeURIComponent(state.rootFolder)}`);
    const data = await res.json();
    state.treeData = data.tree || [];
    renderTree(state.treeData, treeRoot);
  } catch (err) {
    console.error('Failed to load tree:', err);
  }
}

// Render Tree View
function renderTree(items, containerElement) {
  containerElement.innerHTML = '';
  if (!items || items.length === 0) {
    const empty = document.createElement('div');
    empty.style.padding = '16px 12px';
    empty.style.color = 'var(--text-muted)';
    empty.style.fontSize = '12px';
    empty.textContent = '폴더가 비어 있습니다. [+ 새 메모]를 눌러보세요.';
    containerElement.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const node = createTreeNode(item);
    containerElement.appendChild(node);
  });
  updateTreeActiveState();
}

// Highlight currently opened & editing memo in the left tree
function updateTreeActiveState() {
  const normCurrent = state.currentFilePath ? state.currentFilePath.replace(/\\/g, '/') : null;
  document.querySelectorAll('.tree-item').forEach(el => {
    const rawPath = el.getAttribute('data-path');
    const normPath = rawPath ? rawPath.replace(/\\/g, '/') : null;
    if (normCurrent && normPath === normCurrent) {
      el.classList.add('active');
      if (state.isDirty) {
        el.classList.add('editing');
      } else {
        el.classList.remove('editing');
      }
    } else {
      el.classList.remove('active', 'editing');
    }
  });
}

function createTreeNode(item) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tree-node-wrapper';

  const row = document.createElement('div');
  row.className = 'tree-item';
  row.setAttribute('data-path', item.path);

  const normCurrent = state.currentFilePath ? state.currentFilePath.replace(/\\/g, '/') : null;
  const normItem = item.path ? item.path.replace(/\\/g, '/') : null;
  if (normCurrent && normCurrent === normItem) {
    row.classList.add('active');
    if (state.isDirty) {
      row.classList.add('editing');
    }
  }

  // Chevron (for folders)
  const chevron = document.createElement('span');
  chevron.className = 'tree-item-chevron';
  if (item.isDir) {
    chevron.textContent = '▶';
    chevron.classList.add('open'); // default open
  } else {
    chevron.style.visibility = 'hidden';
  }
  row.appendChild(chevron);

  // Icon
  const icon = document.createElement('span');
  icon.className = 'tree-item-icon';
  icon.textContent = item.isDir ? '📁' : '📝';
  row.appendChild(icon);

  // Label (without extension)
  const cleanLabelName = getDisplayName(item.name, item.isDir);
  const label = document.createElement('span');
  label.className = 'tree-item-label';
  label.textContent = cleanLabelName;
  label.setAttribute('data-path', item.path);
  label.setAttribute('data-raw-name', cleanLabelName);
  row.appendChild(label);

  // Hover Actions
  const actions = document.createElement('div');
  actions.className = 'tree-item-actions';

  if (item.isDir) {
    const btnAdd = document.createElement('button');
    btnAdd.className = 'action-btn';
    btnAdd.title = '이 폴더 안에 새 메모 생성';
    btnAdd.textContent = '+📝';
    btnAdd.onclick = (e) => { e.stopPropagation(); promptNewFile(item.path); };
    actions.appendChild(btnAdd);

    const btnAddFolder = document.createElement('button');
    btnAddFolder.className = 'action-btn';
    btnAddFolder.title = '이 폴더 안에 새 폴더 생성';
    btnAddFolder.textContent = '+📁';
    btnAddFolder.onclick = (e) => { e.stopPropagation(); promptNewFolder(item.path); };
    actions.appendChild(btnAddFolder);
  }

  const btnRename = document.createElement('button');
  btnRename.className = 'action-btn';
  btnRename.title = '이름 변경';
  btnRename.textContent = '✏️';
  btnRename.onclick = (e) => { e.stopPropagation(); promptRename(item.path, item.name); };
  actions.appendChild(btnRename);

  const btnDelete = document.createElement('button');
  btnDelete.className = 'action-btn';
  btnDelete.title = '삭제';
  btnDelete.textContent = '🗑️';
  btnDelete.onclick = (e) => { e.stopPropagation(); promptDelete(item.path, item.name, item.isDir); };
  actions.appendChild(btnDelete);

  row.appendChild(actions);
  wrapper.appendChild(row);

  // Children Container for folders
  let childrenContainer = null;
  if (item.isDir) {
    childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children';
    if (item.children && item.children.length > 0) {
      item.children.forEach(child => {
        childrenContainer.appendChild(createTreeNode(child));
      });
    }
    wrapper.appendChild(childrenContainer);

    chevron.onclick = (e) => {
      e.stopPropagation();
      const isOpen = chevron.classList.toggle('open');
      childrenContainer.classList.toggle('collapsed', !isOpen);
      icon.textContent = isOpen ? '📁' : '📂';
    };
  }

  // Row Click
  row.onclick = () => {
    state.selectedNodePath = item.path;
    state.selectedNodeIsDir = item.isDir;
    if (item.isDir) {
      if (childrenContainer) {
        const isOpen = chevron.classList.toggle('open');
        childrenContainer.classList.toggle('collapsed', !isOpen);
        icon.textContent = isOpen ? '📁' : '📂';
      }
    } else {
      loadFile(item.path);
    }
  };

  return wrapper;
}

// Load File into Editor
async function loadFile(filePath, isNavigatingHistory = false) {
  if (!filePath) return false;

  // Don't reload if already open and clean
  if (state.currentFilePath === filePath && !state.isDirty) {
    return true;
  }

  // Auto-save existing file ONLY IF it was genuinely modified
  if (state.isDirty && state.currentFilePath && state.lastSavedContent !== null && memoTextarea.value !== state.lastSavedContent) {
    try {
      await saveCurrentFile(false);
    } catch (e) {
      console.warn('Auto-save prior to load failed:', e);
    }
  }

  // Clear any pending timers from previously open file
  if (state.saveTimeout) {
    clearTimeout(state.saveTimeout);
    state.saveTimeout = null;
  }
  if (state.maxSaveTimeout) {
    clearTimeout(state.maxSaveTimeout);
    state.maxSaveTimeout = null;
  }

  // 1. Fetch file content from server (with retry in case of sleep/wake reconnect)
  let fileData = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || '파일을 읽을 수 없습니다.');
      }
      fileData = await res.json();
      break;
    } catch (err) {
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 400));
        continue;
      }
      console.error('Error fetching file:', err);
      alert('파일을 불러오지 못했습니다: ' + err.message);
      return false;
    }
  }

  // 2. Safely update UI with loaded content
  try {
    const previousPath = state.currentFilePath;
    state.currentFilePath = filePath;
    state.selectedNodePath = filePath;
    state.selectedNodeIsDir = false;
    state.isDirty = false;
    state.lastSavedContent = fileData.content || '';
    state.lastSavedTimeStr = fileData.mtime ? formatTime(fileData.mtime) : '';

    // Track navigation history
    if (!isNavigatingHistory && previousPath && previousPath !== filePath) {
      navHistory.past.push(previousPath);
      if (navHistory.past.length > 50) {
        navHistory.past.shift();
      }
      navHistory.future = [];
    }
    updateNavButtons();

    // Update Header (hide extension)
    const fileName = filePath.split(/[\\/]/).pop();
    fileIcon.textContent = '📝';
    fileTitle.textContent = getDisplayName(fileName, false);
    const relPath = filePath.replace(state.rootFolder, '').replace(/^[\\/]/, '') || fileName;
    filePathDisplay.textContent = getDisplayName(relPath, false);

    // Show Editor
    emptyState.classList.add('hidden');
    if (editorWorkspace) editorWorkspace.classList.remove('hidden');
    memoTextarea.classList.remove('hidden');

    memoTextarea.value = state.lastSavedContent;
    btnManualSave.disabled = true; // Clean loaded file, no unsaved changes!
    btnInsertLink.disabled = false;

    // Display clean state with actual file modification time, without triggering a save
    updateSaveStatus('clean', state.lastSavedTimeStr);
    updateStats();
    updateCursorPos();
    updateLineNumbers();
    highlightActiveLine();

    // Highlight active tree node
    updateTreeActiveState();

    // Mark config
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastOpenedFile: filePath })
    }).catch(() => {});
    return true;
  } catch (uiErr) {
    console.error('UI update error after file load:', uiErr);
    return false;
  }
}

// Navigation History: Go Back
async function goBack() {
  if (navHistory.past.length === 0) return;

  if (state.isDirty && state.currentFilePath && state.lastSavedContent !== null && memoTextarea.value !== state.lastSavedContent) {
    try {
      await saveCurrentFile(false);
    } catch (e) {
      console.warn('Auto-save prior to goBack failed:', e);
    }
  }

  const prevPath = navHistory.past.pop();
  if (state.currentFilePath) {
    navHistory.future.push(state.currentFilePath);
  }

  const ok = await loadFile(prevPath, true);
  if (!ok) {
    if (navHistory.future.length > 0) {
      navHistory.future.pop();
    }
  }
  updateNavButtons();
}

// Navigation History: Go Forward
async function goForward() {
  if (navHistory.future.length === 0) return;

  if (state.isDirty && state.currentFilePath && state.lastSavedContent !== null && memoTextarea.value !== state.lastSavedContent) {
    try {
      await saveCurrentFile(false);
    } catch (e) {
      console.warn('Auto-save prior to goForward failed:', e);
    }
  }

  const nextPath = navHistory.future.pop();
  if (state.currentFilePath) {
    navHistory.past.push(state.currentFilePath);
  }

  const ok = await loadFile(nextPath, true);
  if (!ok) {
    if (navHistory.past.length > 0) {
      navHistory.past.pop();
    }
  }
  updateNavButtons();
}

// Update History Navigation Buttons state
function updateNavButtons() {
  if (btnNavBack) {
    btnNavBack.disabled = navHistory.past.length === 0;
  }
  if (btnNavForward) {
    btnNavForward.disabled = navHistory.future.length === 0;
  }
}

// Save Current File
async function saveCurrentFile(showNotification = true) {
  if (!state.currentFilePath) return;

  if (state.saveTimeout) {
    clearTimeout(state.saveTimeout);
    state.saveTimeout = null;
  }
  if (state.maxSaveTimeout) {
    clearTimeout(state.maxSaveTimeout);
    state.maxSaveTimeout = null;
  }

  const content = memoTextarea.value;

  // Crucial: If content is identical to what's already saved, skip saving!
  if (state.lastSavedContent !== null && content === state.lastSavedContent) {
    state.isDirty = false;
    updateSaveStatus('clean', state.lastSavedTimeStr);
    return;
  }

  updateSaveStatus('saving');

  try {
    const res = await fetch('/api/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: state.currentFilePath, content })
    });

    if (!res.ok) throw new Error('저장 실패');
    const data = await res.json().catch(() => ({}));
    state.isDirty = false;
    state.lastSavedContent = content;
    const nowTime = data.mtime ? formatTime(data.mtime) : new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    updateSaveStatus('saved', nowTime);
  } catch (err) {
    console.error('Save error:', err);
    updateSaveStatus('error', err.message);
    if (showNotification) alert('저장 실패: ' + err.message);
  }
}

function updateSaveStatus(status, detail = '') {
  saveStatusBadge.className = 'status-badge ' + status;
  if (status === 'clean') {
    // Unmodified file loaded from disk
    const timeStr = detail || state.lastSavedTimeStr || '';
    saveStatusBadge.textContent = timeStr ? `💾 저장됨 (${timeStr})` : `💾 저장됨`;
    saveStatusBadge.title = timeStr ? `파일이 최신 상태로 보존되어 있습니다 (최종 수정: ${timeStr})` : '파일이 최신 상태로 보존되어 있습니다';
    saveStatusBadge.onclick = null;
    lastSavedTime.textContent = timeStr ? `최종 수정: ${timeStr}` : '최신 상태';
    updateUnsavedIndicators(false);
  } else if (status === 'saved') {
    // Actively saved
    const timeStr = detail || new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    state.lastSavedTimeStr = timeStr;
    saveStatusBadge.textContent = `💾 저장됨 (${timeStr})`;
    saveStatusBadge.title = `안전하게 저장되었습니다 (${timeStr})`;
    saveStatusBadge.onclick = null;
    lastSavedTime.textContent = `마지막 저장: ${timeStr}`;
    updateUnsavedIndicators(false);
  } else if (status === 'saving') {
    saveStatusBadge.textContent = '⏳ 저장 중...';
    saveStatusBadge.title = '서버에 저장하고 있습니다';
    saveStatusBadge.onclick = null;
  } else if (status === 'editing' || status === 'unsaved') {
    saveStatusBadge.textContent = '⚠️ 저장 안 됨 (수정 중)';
    saveStatusBadge.title = '아직 저장되지 않은 내용이 있습니다. 1초 후 자동 저장되거나 클릭하여 즉시 저장합니다.';
    saveStatusBadge.onclick = () => saveCurrentFile(true);
    updateUnsavedIndicators(true);
  } else if (status === 'error') {
    saveStatusBadge.textContent = '❌ 저장 실패 (클릭하여 재시도)';
    saveStatusBadge.title = detail ? `저장 실패 원인: ${detail}. 클릭하여 다시 시도하세요.` : '저장에 실패했습니다. 클릭하여 다시 시도하세요.';
    saveStatusBadge.onclick = () => saveCurrentFile(true);
    updateUnsavedIndicators(true);
  }
}

// Visual indicators for unsaved state: ● dot in header title & left tree
function updateUnsavedIndicators(isUnsaved) {
  if (!state.currentFilePath) return;

  const fileName = state.currentFilePath.split(/[\\/]/).pop();
  const cleanName = getDisplayName(fileName, false);

  // 1. Header Title Dot
  if (isUnsaved) {
    fileTitle.innerHTML = `${escapeHtml(cleanName)} <span class="unsaved-dot" title="저장되지 않음">●</span>`;
  } else {
    fileTitle.textContent = cleanName;
  }

  // 2. Left Tree Active/Editing Highlight & Dot
  updateTreeActiveState();

  const normCurrent = state.currentFilePath.replace(/\\/g, '/');
  document.querySelectorAll('.tree-item-label').forEach(label => {
    const rawPath = label.getAttribute('data-path') || '';
    const normPath = rawPath.replace(/\\/g, '/');
    if (normPath === normCurrent) {
      let dot = label.querySelector('.tree-unsaved-dot');
      if (isUnsaved) {
        if (!dot) {
          dot = document.createElement('span');
          dot.className = 'tree-unsaved-dot';
          dot.textContent = ' ●';
          dot.title = '수정 중 (저장되지 않은 변경사항)';
          label.appendChild(dot);
        }
      } else {
        if (dot) dot.remove();
      }
    } else {
      const otherDot = label.querySelector('.tree-unsaved-dot');
      if (otherDot) otherDot.remove();
    }
  });

  // 3. Manual Save Button
  btnManualSave.disabled = !isUnsaved && !state.isDirty;
}

// --- Memo Link Interlinking & Preview Features ---

// Recursively get all memo files in tree
function getAllMemoFiles(items, result = []) {
  if (!items) return result;
  items.forEach(item => {
    if (!item.isDir) {
      result.push({ name: item.name, path: item.path });
    }
    if (item.children) {
      getAllMemoFiles(item.children, result);
    }
  });
  return result;
}

// Find memo path by filename (with or without extension) or relative path
function findMemoPath(target) {
  const allFiles = getAllMemoFiles(state.treeData);
  const cleanTarget = target.trim().replace(/^\[\[/, '').replace(/\]\]$/, '').replace(/\\/g, '/');
  const targetLower = cleanTarget.toLowerCase();
  const targetNorm = targetLower.replace(/\.(txt|md|markdown)$/i, '');

  // 1. If path contains slash (e.g. "업무/회의록" or "업무/회의록.txt")
  if (cleanTarget.includes('/')) {
    const match = allFiles.find(f => {
      const fNorm = f.path.replace(/\\/g, '/').toLowerCase().replace(/\.(txt|md|markdown)$/i, '');
      return fNorm.endsWith('/' + targetNorm) || fNorm === targetNorm;
    });
    if (match) return match.path;
  }

  // 2. Only file name given (e.g. "회의록")
  // Priority A: Same folder as current file
  if (state.currentFilePath) {
    const currentDir = state.currentFilePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
    const sameFolderMatch = allFiles.find(f => {
      const fDir = f.path.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
      const fNameNorm = f.name.toLowerCase().replace(/\.(txt|md|markdown)$/i, '');
      return fDir === currentDir && fNameNorm === targetNorm;
    });
    if (sameFolderMatch) return sameFolderMatch.path;
  }

  // Priority B: Root folder
  const rootDirNorm = state.rootFolder.replace(/\\/g, '/');
  const rootMatch = allFiles.find(f => {
    const fDir = f.path.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
    const fNameNorm = f.name.toLowerCase().replace(/\.(txt|md|markdown)$/i, '');
    return fDir === rootDirNorm && fNameNorm === targetNorm;
  });
  if (rootMatch) return rootMatch.path;

  // Priority C: First matching file in tree
  const firstMatch = allFiles.find(f => {
    const fNameNorm = f.name.toLowerCase().replace(/\.(txt|md|markdown)$/i, '');
    return fNameNorm === targetNorm;
  });
  if (firstMatch) return firstMatch.path;

  return null;
}

// Jump to linked memo
async function jumpToMemo(target) {
  const cleanTarget = target.trim().replace(/^\[\[/, '').replace(/\]\]$/, '');
  const matchedPath = findMemoPath(cleanTarget);

  if (matchedPath) {
    await loadFile(matchedPath);
  } else {
    // Prompt to create target memo if it doesn't exist
    const defaultName = cleanTarget.endsWith('.txt') || cleanTarget.endsWith('.md') ? cleanTarget : `${cleanTarget}.txt`;
    if (confirm(`'${cleanTarget}' 메모를 찾을 수 없습니다.\n새로운 메모로 바로 생성하시겠습니까?`)) {
      // If path contains subfolder (e.g. "아이디어/테스트"), create relative to root folder
      // Otherwise create in active directory
      const targetBaseDir = (cleanTarget.includes('/') || cleanTarget.includes('\\'))
        ? state.rootFolder
        : getActiveTargetDir();
      try {
        const res = await fetch('/api/create-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dirPath: targetBaseDir, fileName: defaultName })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        await loadTree();
        await loadFile(data.path);
      } catch (err) {
        alert('메모 생성 실패: ' + err.message);
      }
    }
  }
}

// Open Link Insertion Modal
function openLinkSelectorModal() {
  const allFiles = getAllMemoFiles(state.treeData).filter(f => f.path !== state.currentFilePath);
  linkSearchInput.value = '';
  renderLinkItems(allFiles);
  linkModalOverlay.classList.remove('hidden');
  linkSearchInput.focus();

  linkSearchInput.oninput = () => {
    const q = linkSearchInput.value.toLowerCase().trim();
    const filtered = allFiles.filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
    renderLinkItems(filtered);
  };
}

function renderLinkItems(files) {
  linkItemsList.innerHTML = '';
  if (files.length === 0) {
    linkItemsList.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12px;">일치하는 메모가 없습니다.</div>';
    return;
  }

  // Count duplicate names to automatically qualify with folder path if needed
  const nameCounts = {};
  files.forEach(f => {
    const c = getDisplayName(f.name, false);
    nameCounts[c] = (nameCounts[c] || 0) + 1;
  });

  files.forEach(file => {
    const row = document.createElement('div');
    row.className = 'link-item-row';
    const cleanName = getDisplayName(file.name, false);
    const relPath = getDisplayName(file.path.replace(state.rootFolder, '').replace(/^[\\/]/, ''), false);
    const hasDuplicate = nameCounts[cleanName] > 1;
    const linkToInsert = hasDuplicate ? relPath : cleanName;

    row.innerHTML = `
      <span style="font-size: 14px;">📝</span>
      <span class="link-item-name">${escapeHtml(cleanName)}</span>
      <span class="link-item-path">${escapeHtml(relPath)}</span>
    `;

    row.onclick = () => {
      insertLinkIntoTextarea(`[[${linkToInsert}]]`);
      linkModalOverlay.classList.add('hidden');
    };

    linkItemsList.appendChild(row);
  });
}

function insertLinkIntoTextarea(linkText) {
  const start = memoTextarea.selectionStart;
  const end = memoTextarea.selectionEnd;
  const val = memoTextarea.value;
  memoTextarea.value = val.substring(0, start) + linkText + val.substring(end);
  memoTextarea.selectionStart = memoTextarea.selectionEnd = start + linkText.length;
  memoTextarea.focus();

  state.isDirty = true;
  updateSaveStatus('editing');
  updateTreeActiveState();
  updateStats();

  if (state.saveTimeout) clearTimeout(state.saveTimeout);
  state.saveTimeout = setTimeout(() => saveCurrentFile(false), 1000);
}

function escapeHtml(text) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function updateStats() {
  const text = memoTextarea.value || '';
  charCount.textContent = `${text.length} 글자`;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  wordCount.textContent = `${words} 단어`;
}

function updateCursorPos() {
  const pos = memoTextarea.selectionStart || 0;
  const lines = memoTextarea.value.substring(0, pos).split('\n');
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  cursorPos.textContent = `줄 ${line}, 열 ${col}`;
}

// --- Line Numbers (Gutter) Logic ---
let mirrorEl = null;
let updateLineNumbersRaf = null;

function getMirrorElement() {
  if (!mirrorEl) {
    mirrorEl = document.createElement('div');
    mirrorEl.className = 'editor-mirror';
    document.body.appendChild(mirrorEl);
  }
  return mirrorEl;
}

function updateLineNumbers() {
  if (!state.showLineNumbers || !editorGutter || !memoTextarea) return;
  if (updateLineNumbersRaf) cancelAnimationFrame(updateLineNumbersRaf);
  updateLineNumbersRaf = requestAnimationFrame(() => {
    renderLineNumbers();
  });
}

function renderLineNumbers() {
  if (!state.showLineNumbers || !editorGutter || !memoTextarea || !gutterInner) return;

  const text = memoTextarea.value || '';
  const lines = text.split('\n');
  const lineCount = lines.length;

  // Auto-expand gutter width for 3, 4, 5+ digits so numbers never clip
  const digits = Math.max(2, String(lineCount).length);
  const gutterWidth = Math.max(48, 16 + digits * 9);
  editorGutter.style.width = `${gutterWidth}px`;
  editorGutter.style.minWidth = `${gutterWidth}px`;

  // Sync mirror style with textarea
  const mirror = getMirrorElement();
  const cs = window.getComputedStyle(memoTextarea);
  const pl = parseFloat(cs.paddingLeft) || 24;
  const pr = parseFloat(cs.paddingRight) || 24;
  const contentWidth = Math.max(60, memoTextarea.clientWidth - pl - pr);
  mirror.style.width = `${contentWidth}px`;
  mirror.style.fontFamily = cs.fontFamily;
  mirror.style.fontSize = cs.fontSize;
  mirror.style.lineHeight = cs.lineHeight;

  // Render mirror lines to measure wrapped line heights
  let mirrorHtml = '';
  for (let i = 0; i < lineCount; i++) {
    const raw = lines[i];
    const escaped = raw ? raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '&nbsp;';
    mirrorHtml += `<div class="mirror-row">${escaped}</div>`;
  }
  mirror.innerHTML = mirrorHtml;

  // Measure heights and generate gutter markup
  const rows = mirror.children;
  const pos = memoTextarea.selectionStart || 0;
  const currentLineIdx = text.substring(0, pos).split('\n').length - 1;

  let gutterHtml = '';
  for (let i = 0; i < lineCount; i++) {
    const h = rows[i] ? rows[i].offsetHeight : 24;
    const isActive = (i === currentLineIdx);
    gutterHtml += `<div class="gutter-line${isActive ? ' active' : ''}" data-line="${i + 1}" style="height: ${h}px; line-height: 24px;" title="클릭하여 ${i + 1}번째 줄 선택">${i + 1}</div>`;
  }

  gutterInner.innerHTML = gutterHtml;
  editorGutter.scrollTop = memoTextarea.scrollTop;
}

function highlightActiveLine() {
  if (!state.showLineNumbers || !gutterInner) return;
  const pos = memoTextarea.selectionStart || 0;
  const currentLineIdx = (memoTextarea.value || '').substring(0, pos).split('\n').length - 1;
  const lineEls = gutterInner.children;
  for (let i = 0; i < lineEls.length; i++) {
    if (i === currentLineIdx) {
      if (!lineEls[i].classList.contains('active')) lineEls[i].classList.add('active');
    } else {
      if (lineEls[i].classList.contains('active')) lineEls[i].classList.remove('active');
    }
  }
}

function toggleLineNumbers(forceState) {
  state.showLineNumbers = (typeof forceState === 'boolean') ? forceState : !state.showLineNumbers;
  localStorage.setItem('memo_show_line_numbers', state.showLineNumbers ? 'true' : 'false');
  updateLineNumbersVisibility();
}

function updateLineNumbersVisibility() {
  if (!editorGutter || !btnToggleLineNumbers) return;
  if (state.showLineNumbers) {
    editorGutter.classList.remove('hidden');
    btnToggleLineNumbers.classList.add('active');
    btnToggleLineNumbers.title = '라인 번호 숨기기 (단축키: Alt+L)';
    updateLineNumbers();
    highlightActiveLine();
  } else {
    editorGutter.classList.add('hidden');
    btnToggleLineNumbers.classList.remove('active');
    btnToggleLineNumbers.title = '라인 번호 표시 (단축키: Alt+L)';
  }
}

// Prompt Modals
function showModal(title, desc, initialValue, onConfirm) {
  modalTitle.textContent = title;
  modalDesc.textContent = desc;
  modalInput.value = initialValue || '';
  modalOverlay.classList.remove('hidden');
  modalInput.focus();
  modalCallback = onConfirm;
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  modalCallback = null;
}

function promptNewFile(targetDir) {
  const dir = targetDir || getActiveTargetDir();
  const folderRel = dir.replace(state.rootFolder, '').replace(/^[\\/]/, '') || '루트 폴더';
  showModal(
    '새 메모 만들기',
    `'${folderRel}' 위치에 생성할 메모 이름을 입력하세요 (예: 회의록, 아이디어):`,
    '',
    async (fileName) => {
      if (!fileName.trim()) return;
      try {
        const res = await fetch('/api/create-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dirPath: dir, fileName: fileName.trim() })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        await loadTree();
        await loadFile(data.path);
      } catch (err) {
        alert(err.message);
      }
    }
  );
}

function promptNewFolder(targetDir) {
  const dir = targetDir || getActiveTargetDir();
  const folderRel = dir.replace(state.rootFolder, '').replace(/^[\\/]/, '') || '루트 폴더';
  showModal(
    '새 폴더 만들기',
    `'${folderRel}' 위치에 생성할 폴더 이름을 입력하세요:`,
    '',
    async (folderName) => {
      if (!folderName.trim()) return;
      try {
        const res = await fetch('/api/create-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dirPath: dir, folderName: folderName.trim() })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        await loadTree();
        if (folderBrowserModalOverlay && !folderBrowserModalOverlay.classList.contains('hidden')) {
          await loadFolderBrowserDirs(fbState.browsingPath);
        }
      } catch (err) {
        alert(err.message);
      }
    }
  );
}

function promptRename(oldPath, currName) {
  const isDir = !pathHasExtension(currName);
  const cleanCurrent = getDisplayName(currName, isDir);
  showModal(
    '이름 변경',
    `새로운 이름을 입력하세요:`,
    cleanCurrent,
    async (newName) => {
      if (!newName.trim() || newName.trim() === cleanCurrent) return;
      try {
        const res = await fetch('/api/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPath, newName: newName.trim() })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        await loadTree();
        if (state.currentFilePath === oldPath) {
          state.currentFilePath = data.newPath;
        }
        navHistory.past = navHistory.past.map(p => p === oldPath ? data.newPath : p);
        navHistory.future = navHistory.future.map(p => p === oldPath ? data.newPath : p);
        if (state.currentFilePath === data.newPath) {
          await loadFile(data.newPath, true);
        }
      } catch (err) {
        alert(err.message);
      }
    }
  );
}

function pathHasExtension(p) {
  return /\.(txt|md|markdown|json|csv)$/i.test(p);
}

function promptDelete(targetPath, name, isDir) {
  const itemType = isDir ? '폴더' : '메모';
  const displayTitle = getDisplayName(name, isDir);
  if (confirm(`정말로 ${itemType} '${displayTitle}'을(를) 삭제하시겠습니까?`)) {
    fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPath })
    }).then(async (res) => {
      if (!res.ok) throw new Error('삭제 실패');
      if (state.currentFilePath === targetPath || (isDir && state.currentFilePath?.startsWith(targetPath + '/'))) {
        state.currentFilePath = null;
        emptyState.classList.remove('hidden');
        if (editorWorkspace) editorWorkspace.classList.add('hidden');
        memoTextarea.classList.add('hidden');
        fileTitle.textContent = '선택된 메모 없음';
        filePathDisplay.textContent = '👈 왼쪽 트리에서 메모 파일을 선택하거나 새로 만드세요';
        btnManualSave.disabled = true;
      }
      navHistory.past = navHistory.past.filter(p => p !== targetPath && (!isDir || !p.startsWith(targetPath + '/')));
      navHistory.future = navHistory.future.filter(p => p !== targetPath && (!isDir || !p.startsWith(targetPath + '/')));
      updateNavButtons();
      await loadTree();
    }).catch(err => alert(err.message));
  }
}

function getActiveTargetDir() {
  if (state.selectedNodePath) {
    if (state.selectedNodeIsDir) {
      return state.selectedNodePath;
    }
    // If selected node is a file, return its parent directory
    const parts = state.selectedNodePath.split(/[\\/]/);
    parts.pop();
    return parts.join('/') || state.rootFolder;
  }
  if (state.currentFilePath) {
    const parts = state.currentFilePath.split(/[\\/]/);
    parts.pop();
    return parts.join('/') || state.rootFolder;
  }
  return state.rootFolder;
}

// Visual Folder Browser Functions
function openFolderBrowser(initialPath) {
  if (!folderBrowserModalOverlay) return;
  const start = initialPath || state.rootFolder;
  fbState.browsingPath = start;
  fbState.selectedPath = start;
  folderBrowserModalOverlay.classList.remove('hidden');
  loadFolderBrowserDirs(start);
}

function closeFolderBrowser() {
  if (folderBrowserModalOverlay) {
    folderBrowserModalOverlay.classList.add('hidden');
  }
}

async function loadFolderBrowserDirs(targetPath) {
  try {
    const res = await fetch(`/api/list-dirs?path=${encodeURIComponent(targetPath || '')}`);
    if (!res.ok) throw new Error('폴더 목록을 불러오지 못했습니다.');
    const data = await res.json();

    fbState.browsingPath = data.currentPath;
    fbState.selectedPath = data.currentPath;
    fbState.parentPath = data.parentPath;

    if (fbCurrentPathDisplay) {
      fbCurrentPathDisplay.textContent = data.currentPath;
      fbCurrentPathDisplay.title = data.currentPath;
    }

    if (btnFbGoUp) {
      btnFbGoUp.disabled = !data.parentPath;
    }

    // Render Quick Locations
    if (fbQuickList) {
      fbQuickList.innerHTML = '';
      (data.quickLocations || []).forEach(loc => {
        const item = document.createElement('div');
        item.className = 'fb-quick-item' + (loc.path === data.currentPath ? ' active' : '');
        item.textContent = loc.name;
        item.title = loc.path;
        item.onclick = () => loadFolderBrowserDirs(loc.path);
        fbQuickList.appendChild(item);
      });
    }

    // Render Subfolders
    if (fbFolderList) {
      fbFolderList.innerHTML = '';
      if (!data.folders || data.folders.length === 0) {
        fbFolderList.innerHTML = `
          <div style="padding: 28px 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
            이 위치에 하위 폴더가 없습니다.<br>
            <span style="font-size: 12px; opacity: 0.8; margin-top: 4px; display: inline-block;">현재 폴더를 작업 공간으로 지정하려면 아래 <strong>[✅ 이 폴더로 선택]</strong>을 누르세요.</span>
          </div>`;
      } else {
        data.folders.forEach(f => {
          const row = document.createElement('div');
          row.className = 'fb-folder-item';
          row.innerHTML = `<span style="font-size: 16px;">📁</span> <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(f.name)}</span>`;
          row.title = `${f.name} (클릭하여 선택, 더블 클릭하여 진입)`;

          row.onclick = () => {
            document.querySelectorAll('.fb-folder-item').forEach(el => el.classList.remove('selected'));
            row.classList.add('selected');
            fbState.selectedPath = f.path;
            if (fbCurrentPathDisplay) fbCurrentPathDisplay.textContent = f.path;
          };

          row.ondblclick = (e) => {
            e.stopPropagation();
            loadFolderBrowserDirs(f.path);
          };

          fbFolderList.appendChild(row);
        });
      }
    }
  } catch (err) {
    console.error('loadFolderBrowserDirs error:', err);
  }
}

// Change Root Folder - Opens Visual Folder Browser Screen
function handleChangeFolder() {
  openFolderBrowser(state.rootFolder);
}

// Event Listeners
function setupEventListeners() {
  btnChangeFolder.onclick = handleChangeFolder;
  currentFolderName.onclick = handleChangeFolder;
  btnNewFile.onclick = () => promptNewFile();
  btnNewFolder.onclick = () => promptNewFolder();
  btnRefresh.onclick = loadTree;
  btnManualSave.onclick = () => saveCurrentFile(true);

  // Theme Toggle Button
  if (btnThemeToggle) btnThemeToggle.onclick = toggleTheme;

  // Help Modal Actions
  if (btnHelp) btnHelp.onclick = openHelpModal;
  if (btnFooterHelp) btnFooterHelp.onclick = openHelpModal;
  if (btnHelpModalClose) btnHelpModalClose.onclick = closeHelpModal;
  if (btnHelpModalConfirm) btnHelpModalConfirm.onclick = closeHelpModal;
  if (helpModalOverlay) {
    helpModalOverlay.onclick = (e) => {
      if (e.target === helpModalOverlay) closeHelpModal();
    };
  }

  // Folder Browser Modal Actions
  if (btnFbClose) btnFbClose.onclick = closeFolderBrowser;
  if (btnFbCancel) btnFbCancel.onclick = closeFolderBrowser;
  if (folderBrowserModalOverlay) {
    folderBrowserModalOverlay.onclick = (e) => {
      if (e.target === folderBrowserModalOverlay) closeFolderBrowser();
    };
  }

  if (btnFbGoUp) {
    btnFbGoUp.onclick = () => {
      if (fbState.parentPath) loadFolderBrowserDirs(fbState.parentPath);
    };
  }

  if (btnFbNewFolder) {
    btnFbNewFolder.onclick = () => {
      promptNewFolder(fbState.browsingPath);
    };
  }

  if (btnFbConfirm) {
    btnFbConfirm.onclick = async () => {
      const chosen = fbState.selectedPath || fbState.browsingPath;
      if (!chosen) return;
      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rootFolder: chosen })
        });
        const cfg = await res.json();
        state.rootFolder = cfg.rootFolder;
        updateRootFolderDisplay();
        await loadTree();
        closeFolderBrowser();
      } catch (err) {
        alert('폴더 설정 실패: ' + err.message);
      }
    };
  }

  if (btnFbNativePicker) {
    btnFbNativePicker.onclick = async () => {
      const origHtml = btnFbNativePicker.innerHTML;
      try {
        btnFbNativePicker.disabled = true;
        btnFbNativePicker.innerHTML = '⏳ 탐색기 여는 중...';
        const res = await fetch('/api/browse-folder', { method: 'POST' });
        const data = await res.json();
        if (data.success && data.rootFolder) {
          state.rootFolder = data.rootFolder;
          updateRootFolderDisplay();
          await loadTree();
          closeFolderBrowser();
        } else if (data.error) {
          alert('시스템 탐색기를 열지 못했습니다: ' + data.error + '\n\n현재 화면에 표시된 폴더 목록에서 직접 원하는 폴더를 선택하실 수 있습니다.');
        }
      } catch (e) {
        console.warn('Native picker error:', e);
        alert('시스템 탐색기 호출 중 오류가 발생했습니다.\n현재 화면의 폴더 목록에서 직접 원하는 폴더를 선택해주세요.');
      } finally {
        btnFbNativePicker.disabled = false;
        btnFbNativePicker.innerHTML = origHtml;
      }
    };
  }

  // History Navigation Buttons
  if (btnNavBack) btnNavBack.onclick = () => goBack();
  if (btnNavForward) btnNavForward.onclick = () => goForward();

  // Mouse Back / Forward buttons (buttons 3 and 4)
  window.addEventListener('mouseup', (e) => {
    if (e.button === 3) {
      e.preventDefault();
      goBack();
    } else if (e.button === 4) {
      e.preventDefault();
      goForward();
    }
  });

  // Link Insertion
  btnInsertLink.onclick = openLinkSelectorModal;
  btnLinkModalCancel.onclick = () => linkModalOverlay.classList.add('hidden');

  // Line Numbers Toggle
  if (btnToggleLineNumbers) {
    btnToggleLineNumbers.onclick = () => {
      toggleLineNumbers();
    };
  }

  // Footer cursor position click toggles line numbers
  if (cursorPos) {
    cursorPos.onclick = () => {
      toggleLineNumbers();
    };
  }

  // Gutter line click to select that line
  if (gutterInner) {
    gutterInner.addEventListener('click', (e) => {
      const lineEl = e.target.closest('.gutter-line');
      if (!lineEl) return;
      const lineNum = parseInt(lineEl.dataset.line, 10);
      if (!lineNum) return;

      const lines = memoTextarea.value.split('\n');
      let startIdx = 0;
      for (let i = 0; i < lineNum - 1 && i < lines.length; i++) {
        startIdx += lines[i].length + 1;
      }
      const lineContent = lines[lineNum - 1] || '';
      const endIdx = startIdx + lineContent.length;

      memoTextarea.focus();
      memoTextarea.setSelectionRange(startIdx, endIdx);
      updateCursorPos();
      highlightActiveLine();
    });
  }

  // Scroll sync: textarea scrolls gutter
  memoTextarea.addEventListener('scroll', () => {
    if (state.showLineNumbers && editorGutter) {
      editorGutter.scrollTop = memoTextarea.scrollTop;
    }
  }, { passive: true });

  // Scroll sync: wheel over gutter scrolls textarea
  if (editorGutter) {
    editorGutter.addEventListener('wheel', (e) => {
      memoTextarea.scrollTop += e.deltaY;
    }, { passive: true });
  }

  // ResizeObserver to adjust gutter heights when window/sidebar resizes
  try {
    const ro = new ResizeObserver(() => {
      if (state.showLineNumbers) {
        updateLineNumbers();
      }
    });
    ro.observe(memoTextarea);
  } catch (err) {
    window.addEventListener('resize', () => {
      if (state.showLineNumbers) updateLineNumbers();
    });
  }

  // Auto-Save: Debounce (1s idle) + Max Interval (3s continuous)
  memoTextarea.addEventListener('input', () => {
    updateStats();
    updateCursorPos();
    updateLineNumbers();
    highlightActiveLine();

    // Check if the content is ACTUALLY different from what's on disk
    const isActuallyModified = state.lastSavedContent !== null && memoTextarea.value !== state.lastSavedContent;

    if (!isActuallyModified) {
      // User typed and undid/erased back to the original content!
      state.isDirty = false;
      if (state.saveTimeout) {
        clearTimeout(state.saveTimeout);
        state.saveTimeout = null;
      }
      if (state.maxSaveTimeout) {
        clearTimeout(state.maxSaveTimeout);
        state.maxSaveTimeout = null;
      }
      updateSaveStatus('clean', state.lastSavedTimeStr);
      updateTreeActiveState();
      return;
    }

    // Genuinely modified
    state.isDirty = true;
    updateSaveStatus('editing');
    updateTreeActiveState();

    // 1. Save 1 second after user pauses typing
    if (state.saveTimeout) clearTimeout(state.saveTimeout);
    state.saveTimeout = setTimeout(() => {
      saveCurrentFile(false);
    }, 1000);

    // 2. Even if user types continuously without pausing, save at least every 3 seconds
    if (!state.maxSaveTimeout) {
      state.maxSaveTimeout = setTimeout(() => {
        state.maxSaveTimeout = null;
        if (state.isDirty && memoTextarea.value !== state.lastSavedContent) {
          saveCurrentFile(false);
        }
      }, 3000);
    }
  });

  // Click & Double-Click to open link directly in textarea
  memoTextarea.addEventListener('click', (e) => {
    updateCursorPos();
    highlightActiveLine();
    if (e.metaKey || e.ctrlKey) {
      handleTextareaLinkClick();
    }
  });

  memoTextarea.addEventListener('dblclick', () => {
    handleTextareaLinkClick();
  });

  memoTextarea.addEventListener('keyup', () => {
    updateCursorPos();
    highlightActiveLine();
  });
  memoTextarea.addEventListener('select', highlightActiveLine);

  // Search Filter
  treeSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    filterTree(query);
  });

  // Modal actions
  btnModalCancel.onclick = closeModal;
  btnModalConfirm.onclick = () => {
    if (modalCallback) modalCallback(modalInput.value);
    closeModal();
  };
  modalInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      if (modalCallback) modalCallback(modalInput.value);
      closeModal();
    } else if (e.key === 'Escape') {
      closeModal();
    }
  };
}

// Detect [[link]] or [label](target) under cursor on double-click or Cmd/Ctrl+Click
function handleTextareaLinkClick() {
  const pos = memoTextarea.selectionStart;
  const val = memoTextarea.value;
  const before = val.substring(0, pos);
  const after = val.substring(pos);

  const openBracket = before.lastIndexOf('[[');
  const closeBracket = after.indexOf(']]');

  if (openBracket !== -1 && closeBracket !== -1) {
    const betweenBefore = before.substring(openBracket + 2);
    const betweenAfter = after.substring(0, closeBracket);
    if (!betweenBefore.includes(']]') && !betweenAfter.includes('[[')) {
      const target = (betweenBefore + betweenAfter).trim();
      if (target) {
        jumpToMemo(target);
        return;
      }
    }
  }

  // Markdown link [title](target)
  const mdMatches = [...val.matchAll(/\[(.*?)\]\((.*?)\)/g)];
  for (const m of mdMatches) {
    const start = m.index;
    const end = m.index + m[0].length;
    if (pos >= start && pos <= end) {
      const target = m[2].trim();
      if (target) {
        jumpToMemo(target);
        return;
      }
    }
  }
}

function filterTree(query) {
  document.querySelectorAll('.tree-node-wrapper').forEach(wrapper => {
    const label = wrapper.querySelector('.tree-item-label');
    if (!label) return;
    const match = !query || label.textContent.toLowerCase().includes(query);
    wrapper.style.display = match ? '' : 'none';
  });
}

// Resizable Splitter
function setupSplitter() {
  let isDragging = false;

  splitter.addEventListener('mousedown', (e) => {
    isDragging = true;
    splitter.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const newWidth = Math.max(220, Math.min(600, e.clientX));
    sidebar.style.width = `${newWidth}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      splitter.classList.remove('dragging');
      document.body.style.cursor = '';
    }
  });
}

// Keyboard Shortcuts
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const mod = isMac ? e.metaKey : e.ctrlKey;

    // F1: Open Help Guide
    if (e.key === 'F1') {
      e.preventDefault();
      openHelpModal();
      return;
    }

    // Escape: Close modals
    if (e.key === 'Escape') {
      if (folderBrowserModalOverlay && !folderBrowserModalOverlay.classList.contains('hidden')) {
        closeFolderBrowser();
        return;
      }
      if (helpModalOverlay && !helpModalOverlay.classList.contains('hidden')) {
        closeHelpModal();
        return;
      }
      if (linkModalOverlay && !linkModalOverlay.classList.contains('hidden')) {
        linkModalOverlay.classList.add('hidden');
        return;
      }
      if (modalOverlay && !modalOverlay.classList.contains('hidden')) {
        closeModal();
        return;
      }
    }

    // Cmd/Ctrl + S: Save
    if (mod && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      saveCurrentFile(true);
      return;
    }
    // Alt + L or Cmd/Ctrl + Shift + L: Toggle Line Numbers
    if ((e.altKey && (e.key === 'l' || e.key === 'L' || e.code === 'KeyL')) ||
        (mod && e.shiftKey && (e.key === 'l' || e.key === 'L' || e.code === 'KeyL'))) {
      e.preventDefault();
      toggleLineNumbers();
      return;
    }
    // Cmd/Ctrl + K: Insert Memo Link
    if (mod && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (!btnInsertLink.disabled) openLinkSelectorModal();
      return;
    }
    // Cmd/Ctrl + N: New File
    if (mod && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      promptNewFile();
      return;
    }
    // Cmd/Ctrl + O: Change Folder
    if (mod && (e.key === 'o' || e.key === 'O')) {
      e.preventDefault();
      handleChangeFolder();
      return;
    }

    // Navigation Back:
    // - Mac: Cmd + [
    // - Windows/Universal: Ctrl + [
    // - Windows standard: Alt + ArrowLeft
    // - Alt + Cmd + ArrowLeft / Alt + Ctrl + ArrowLeft
    // - Multimedia Key: BrowserBack
    if (
      (mod && e.key === '[') ||
      (e.altKey && e.key === 'ArrowLeft') ||
      (mod && e.altKey && e.key === 'ArrowLeft') ||
      e.key === 'BrowserBack'
    ) {
      e.preventDefault();
      goBack();
      return;
    }

    // Navigation Forward:
    // - Mac: Cmd + ]
    // - Windows/Universal: Ctrl + ]
    // - Windows standard: Alt + ArrowRight
    // - Alt + Cmd + ArrowRight / Alt + Ctrl + ArrowRight
    // - Multimedia Key: BrowserForward
    if (
      (mod && e.key === ']') ||
      (e.altKey && e.key === 'ArrowRight') ||
      (mod && e.altKey && e.key === 'ArrowRight') ||
      e.key === 'BrowserForward'
    ) {
      e.preventDefault();
      goForward();
      return;
    }

    // When NOT actively typing inside textarea or an input field:
    // Support Cmd + ArrowLeft / Ctrl + ArrowLeft or Backspace
    const isEditingText =
      document.activeElement === memoTextarea ||
      document.activeElement?.tagName === 'INPUT' ||
      document.activeElement?.tagName === 'TEXTAREA';
    if (!isEditingText) {
      if (mod && e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
        return;
      }
      if (mod && e.key === 'ArrowRight') {
        e.preventDefault();
        goForward();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        goBack();
        return;
      }
    }
  });
}

// Heartbeat & Auto-shutdown client
function startHeartbeat() {
  function ping() {
    fetch('/api/heartbeat', { method: 'POST' }).catch(() => {});
  }
  ping();
  setInterval(ping, 2500);

  // Ping immediately when user returns to window, switches tab, or wakes from sleep
  window.addEventListener('focus', ping);
  window.addEventListener('pageshow', ping);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') ping();
  });

  // Also ping on user interaction (throttled to at most once per 4 seconds)
  let lastActivityPing = 0;
  const onActivity = () => {
    const now = Date.now();
    if (now - lastActivityPing > 4000) {
      lastActivityPing = now;
      ping();
    }
  };
  window.addEventListener('pointerdown', onActivity, { passive: true });
  window.addEventListener('keydown', onActivity, { passive: true });

  // Send shutdown beacon when window closes
  const sendShutdown = () => {
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/shutdown');
      } else {
        fetch('/api/shutdown', { method: 'POST', keepalive: true }).catch(() => {});
      }
    } catch (e) {}
  };

  window.addEventListener('beforeunload', sendShutdown);
  window.addEventListener('pagehide', sendShutdown);
}

// Launch
window.addEventListener('DOMContentLoaded', init);
