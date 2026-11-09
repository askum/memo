/**
 * Desktop Memo Frontend Client
 */
const savedLinePref = localStorage.getItem('memo_show_line_numbers');
const savedWrapPref = localStorage.getItem('memo_word_wrap');
const savedShowAllFiles = localStorage.getItem('memo_show_all_files');
const savedFontSize = localStorage.getItem('memo_font_size');

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
  showLineNumbers: savedLinePref !== null ? savedLinePref === 'true' : true,
  wordWrap: savedWrapPref !== null ? savedWrapPref === 'true' : true,
  showAllFiles: savedShowAllFiles === 'true' ? true : false,
  fontSize: savedFontSize ? parseInt(savedFontSize, 10) : 14.5,
  draggedTreeItem: null,
  searchMode: 'files',
  searchDebounceTimer: null
};

// Navigation History
let navHistory = {
  past: [],
  future: []
};

// DOM Elements
const sidebar = document.getElementById('sidebar');
const splitter = document.getElementById('splitter');
const currentFolderCard = document.getElementById('currentFolderCard');
const currentFolderName = document.getElementById('currentFolderName');
const btnChangeFolder = document.getElementById('btnChangeFolder');
const btnNewFile = document.getElementById('btnNewFile');
const btnNewFolder = document.getElementById('btnNewFolder');
const btnToggleAllFiles = document.getElementById('btnToggleAllFiles');
const btnRefresh = document.getElementById('btnRefresh');
const tabSearchFiles = document.getElementById('tabSearchFiles');
const tabSearchContent = document.getElementById('tabSearchContent');
const treeSearchInput = document.getElementById('treeSearchInput');
const btnTreeSearchClear = document.getElementById('btnTreeSearchClear');
const treeRoot = document.getElementById('treeRoot');
const contentSearchResults = document.getElementById('contentSearchResults');
const treeScrollContainer = document.getElementById('treeScrollContainer');
const btnThemeToggle = document.getElementById('btnThemeToggle');

const btnNavBack = document.getElementById('btnNavBack');
const btnNavForward = document.getElementById('btnNavForward');
const fileIcon = document.getElementById('fileIcon');
const fileTitle = document.getElementById('fileTitle');
const filePathDisplay = document.getElementById('filePathDisplay');
const btnToggleFindReplace = document.getElementById('btnToggleFindReplace');
const btnToggleLineNumbers = document.getElementById('btnToggleLineNumbers');
const btnFooterLineNumbers = document.getElementById('btnFooterLineNumbers');
const btnFooterWordWrap = document.getElementById('btnFooterWordWrap');
const saveStatusBadge = document.getElementById('saveStatusBadge');
const btnManualSave = document.getElementById('btnManualSave');
const btnInsertLink = document.getElementById('btnInsertLink');
const emptyState = document.getElementById('emptyState');
const editorWorkspace = document.getElementById('editorWorkspace');
const editorTextWrapper = document.getElementById('editorTextWrapper');
const editorHighlights = document.getElementById('editorHighlights');
const editorGutter = document.getElementById('editorGutter');
const gutterInner = document.getElementById('gutterInner');
const memoTextarea = document.getElementById('memoTextarea');
const editorColumnOverlay = document.getElementById('editorColumnOverlay');
const columnModeStatus = document.getElementById('columnModeStatus');
const columnModeSep = document.getElementById('columnModeSep');

// Link Modal Elements
const linkModalOverlay = document.getElementById('linkModalOverlay');
const linkSearchInput = document.getElementById('linkSearchInput');
const linkItemsList = document.getElementById('linkItemsList');
const btnLinkModalCancel = document.getElementById('btnLinkModalCancel');
const btnLinkExternalFile = document.getElementById('btnLinkExternalFile');
const externalFileInput = document.getElementById('externalFileInput');

// Find & Replace Elements
const findReplacePanel = document.getElementById('findReplacePanel');
const findInput = document.getElementById('findInput');
const findCount = document.getElementById('findCount');
const btnFindMatchCase = document.getElementById('btnFindMatchCase');
const btnFindPrev = document.getElementById('btnFindPrev');
const btnFindNext = document.getElementById('btnFindNext');
const btnToggleReplaceMode = document.getElementById('btnToggleReplaceMode');
const btnFindClose = document.getElementById('btnFindClose');
const replaceRow = document.getElementById('replaceRow');
const replaceInput = document.getElementById('replaceInput');
const btnReplaceOne = document.getElementById('btnReplaceOne');
const btnReplaceAll = document.getElementById('btnReplaceAll');

const charCount = document.getElementById('charCount');
const wordCount = document.getElementById('wordCount');
const cursorPos = document.getElementById('cursorPos');
const lastSavedTime = document.getElementById('lastSavedTime');

// Modal Elements
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const modalInput = document.getElementById('modalInput');
const modalError = document.getElementById('modalError');
const btnModalCancel = document.getElementById('btnModalCancel');
const btnModalConfirm = document.getElementById('btnModalConfirm');
let modalCallback = null;
let modalValidationType = null;

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

// Helper: Check if file is a text memo
function isTextMemo(fileName) {
  if (!fileName) return false;
  return /\.(txt|md|markdown)$/i.test(fileName);
}

// Helper: Get icon SVG based on file type
function getFileIcon(fileName, isDir, isOpen = false) {
  if (isDir) {
    if (isOpen) {
      return `<svg class="tree-item-icon-svg icon-folder open" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/></svg>`;
    }
    return `<svg class="tree-item-icon-svg icon-folder" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;
  }
  const ext = (fileName || '').split('.').pop().toLowerCase();
  switch (ext) {
    case 'xlsx':
    case 'xls':
    case 'csv':
      return `<svg class="tree-item-icon-svg icon-excel" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`;
    case 'pdf':
      return `<svg class="tree-item-icon-svg icon-pdf" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13v4"/><path d="M12 13v4"/><path d="M15 13v4"/></svg>`;
    case 'doc':
    case 'docx':
    case 'hwp':
    case 'hwpx':
      return `<svg class="tree-item-icon-svg icon-doc" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
    case 'ppt':
    case 'pptx':
      return `<svg class="tree-item-icon-svg icon-ppt" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
      return `<svg class="tree-item-icon-svg icon-image" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return `<svg class="tree-item-icon-svg icon-zip" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`;
    case 'mp3':
    case 'wav':
    case 'm4a':
      return `<svg class="tree-item-icon-svg icon-audio" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
    case 'mp4':
    case 'mov':
    case 'avi':
      return `<svg class="tree-item-icon-svg icon-video" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
    case 'txt':
    case 'md':
    case 'markdown':
      return `<svg class="tree-item-icon-svg icon-memo" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
    default:
      return `<svg class="tree-item-icon-svg icon-default" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;
  }
}

// Toast notification helper
function showToast(msg) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.className = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// Open file or URL with external program
async function openExternalLink(target) {
  const currentDir = state.currentFilePath 
    ? state.currentFilePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/') 
    : state.rootFolder;

  try {
    const res = await fetch('/api/open-external', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, currentDir })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const isUrl = /^https?:\/\//i.test(target);
      if (isUrl) {
        showToast(`🌐 '${target}' 웹페이지를 브라우저로 열었습니다.`);
      } else {
        const fileName = target.split(/[\\/]/).pop();
        showToast(`🚀 '${fileName}' 파일을 별도 프로그램으로 열었습니다.`);
      }
    } else {
      alert(data.error || `'${target}' 파일을 열 수 없습니다.`);
    }
  } catch (err) {
    alert(`파일 실행 중 오류가 발생했습니다: ${err.message}`);
  }
}

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
      btnThemeToggle.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
      btnThemeToggle.title = '라이트 모드로 변경';
    } else {
      btnThemeToggle.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
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

function updateFileFilterBtn() {
  if (!btnToggleAllFiles) return;
  if (state.showAllFiles) {
    btnToggleAllFiles.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg><span>전체 파일</span>`;
    btnToggleAllFiles.classList.add('active');
    btnToggleAllFiles.title = '파일 보기 필터: 모든 파일 표시 중 (클릭시 txt 메모만 보기)';
  } else {
    btnToggleAllFiles.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>txt 전용</span>`;
    btnToggleAllFiles.classList.remove('active');
    btnToggleAllFiles.title = '파일 보기 필터: txt 메모만 표시 중 (클릭시 모든 파일 보기)';
  }
}

// Init Application
async function init() {
  initTheme();
  applyFontSize(state.fontSize, false);
  updateFileFilterBtn();
  updateWordWrapVisibility();
  updateLineNumbersVisibility();
  setupSplitter();
  setupKeyboardShortcuts();
  setupDropdownMenus();
  setupEventListeners();
  startHeartbeat();

  try {
    const configRes = await fetch('/api/config');
    const config = await configRes.json();
    if (config.version) {
      document.querySelectorAll('.version-badge').forEach(b => b.textContent = config.version);
      const fv = document.querySelector('.footer-version');
      if (fv) fv.textContent = config.version;
    }
    state.rootFolder = config.rootFolder;
    updateRootFolderDisplay();
    await loadTree();

    if (config.lastOpenedFile) {
      const ok = await loadFile(config.lastOpenedFile, false, false, true);
      if (!ok) {
        await loadInitialWelcomeMemo();
      }
    } else {
      await loadInitialWelcomeMemo();
    }
  } catch (err) {
    console.error('Failed to init:', err);
  }
}

async function loadInitialWelcomeMemo() {
  const allMemos = getAllFiles(state.treeData).filter(f => isTextMemo(f.name));
  const welcome = allMemos.find(f => f.name === '환영합니다.txt' || f.name === '환영합니다') || allMemos[0];
  if (welcome) {
    await loadFile(welcome.path, false, false, true);
  }
}

function updateRootFolderDisplay() {
  const parts = state.rootFolder.split(/[\\/]/).filter(Boolean);
  const name = parts[parts.length - 1] || state.rootFolder;
  currentFolderName.innerHTML = `
    <svg class="folder-select-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
    <span class="folder-name-text">${escapeHtml(name)}</span>
    <svg class="folder-caret-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
  `;
  currentFolderName.title = state.rootFolder;
}

// Load Tree
async function loadTree() {
  try {
    const res = await fetch(`/api/tree?path=${encodeURIComponent(state.rootFolder)}`);
    const data = await res.json();
    state.treeData = data.tree || [];
    renderTree(state.treeData, treeRoot);
    if (treeSearchInput && treeSearchInput.value) {
      if (state.searchMode === 'files') {
        filterTree(treeSearchInput.value);
      } else {
        performContentSearch(treeSearchInput.value);
      }
    }
  } catch (err) {
    console.error('Failed to load tree:', err);
  }
}

// Filter tree items based on txt-only vs show-all preference
function filterTreeItems(items) {
  if (state.showAllFiles) return items || [];
  return (items || [])
    .filter(item => item.isDir || isTextMemo(item.name))
    .map(item => {
      if (item.isDir && item.children) {
        return {
          ...item,
          children: filterTreeItems(item.children)
        };
      }
      return item;
    });
}

// Render Tree View
function renderTree(items, containerElement) {
  containerElement.innerHTML = '';
  const displayItems = filterTreeItems(items);
  if (!displayItems || displayItems.length === 0) {
    const empty = document.createElement('div');
    empty.style.padding = '16px 12px';
    empty.style.color = 'var(--text-muted)';
    empty.style.fontSize = '12px';
    empty.textContent = state.showAllFiles 
      ? '폴더가 비어 있습니다. [+ 새 메모]를 눌러보세요.' 
      : '표시할 txt 메모가 없습니다. [+ 새 메모]를 누르거나 상단 [📄 txt]를 눌러 전체 파일을 확인하세요.';
    containerElement.appendChild(empty);
    return;
  }

  displayItems.forEach(item => {
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

// Move File or Folder to target directory
async function moveTreeItem(sourcePath, targetDirPath) {
  if (!sourcePath || !targetDirPath) return;

  const srcNorm = sourcePath.replace(/\\/g, '/');
  const targetDirNorm = targetDirPath.replace(/\\/g, '/');
  const currentParentNorm = srcNorm.substring(0, srcNorm.lastIndexOf('/'));

  if (currentParentNorm === targetDirNorm) {
    showToast('ℹ️ 이미 해당 폴더에 위치해 있습니다.');
    return;
  }

  const fileName = sourcePath.split(/[\\/]/).pop();
  const rootNorm = state.rootFolder.replace(/\\/g, '/');
  const targetFolderName = (targetDirNorm === rootNorm)
    ? '최상위(루트)'
    : targetDirPath.split(/[\\/]/).pop();

  try {
    const res = await fetch('/api/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath, targetDirPath })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '파일 이동에 실패했습니다.');
      return;
    }

    showToast(`🚚 '${getDisplayName(fileName, false)}'을(를) '${targetFolderName}' 폴더로 이동했습니다.`);

    // If the currently open file was moved, update state and header paths
    if (state.currentFilePath && isPathEqualOrInside(state.currentFilePath, sourcePath)) {
      const normCur = state.currentFilePath.replace(/\\/g, '/');
      const normSrc = sourcePath.replace(/\\/g, '/').replace(/\/+$/, '');
      const normNew = data.newPath.replace(/\\/g, '/').replace(/\/+$/, '');
      const updatedPath = normCur === normSrc ? data.newPath : normNew + normCur.slice(normSrc.length);
      state.currentFilePath = updatedPath;
      state.selectedNodePath = updatedPath;
      if (filePathDisplay) filePathDisplay.textContent = getDisplayPathFromRoot(updatedPath);
      const curName = updatedPath.split(/[\\/]/).pop();
      renderHeaderFileTitle(getDisplayName(curName, false), state.isDirty);
    }

    await loadTree();
  } catch (err) {
    alert('파일 이동 중 오류가 발생했습니다: ' + err.message);
  }
}

function createTreeNode(item) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tree-node-wrapper';

  const row = document.createElement('div');
  row.className = 'tree-item';
  row.setAttribute('data-path', item.path);
  row.draggable = true;

  // Drag start for moving item to another folder
  row.addEventListener('dragstart', (e) => {
    if (e.target.closest('.action-btn') || e.target.closest('.tree-item-chevron')) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', item.path);
    e.dataTransfer.effectAllowed = 'move';
    state.draggedTreeItem = item;
    setTimeout(() => {
      row.classList.add('is-dragging');
    }, 0);
  });

  row.addEventListener('dragend', () => {
    row.classList.remove('is-dragging');
    state.draggedTreeItem = null;
    document.querySelectorAll('.drag-over-folder').forEach(el => el.classList.remove('drag-over-folder'));
  });

  // Drop target handling
  if (item.isDir) {
    row.addEventListener('dragover', (e) => {
      if (!state.draggedTreeItem) return;
      if (state.draggedTreeItem.path === item.path) return;
      // Prevent dropping a folder into itself or its subfolders
      if (state.draggedTreeItem.isDir) {
        const srcNorm = state.draggedTreeItem.path.replace(/\\/g, '/');
        const targetNorm = item.path.replace(/\\/g, '/');
        if (targetNorm === srcNorm || targetNorm.startsWith(srcNorm + '/')) {
          return;
        }
      }
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      row.classList.add('drag-over-folder');
    });

    row.addEventListener('dragleave', (e) => {
      if (!row.contains(e.relatedTarget)) {
        row.classList.remove('drag-over-folder');
      }
    });

    row.addEventListener('drop', async (e) => {
      if (!state.draggedTreeItem) return;
      e.preventDefault();
      e.stopPropagation();
      row.classList.remove('drag-over-folder');
      const srcPath = state.draggedTreeItem.path;
      if (srcPath && srcPath !== item.path) {
        if (childrenContainer && !chevron.classList.contains('open')) {
          chevron.click();
        }
        await moveTreeItem(srcPath, item.path);
      }
    });
  } else {
    // Dropping onto a file -> target that file's parent folder
    row.addEventListener('dragover', (e) => {
      if (!state.draggedTreeItem) return;
      if (state.draggedTreeItem.path === item.path) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      row.classList.add('drag-over-folder');
    });

    row.addEventListener('dragleave', (e) => {
      if (!row.contains(e.relatedTarget)) {
        row.classList.remove('drag-over-folder');
      }
    });

    row.addEventListener('drop', async (e) => {
      if (!state.draggedTreeItem) return;
      e.preventDefault();
      e.stopPropagation();
      row.classList.remove('drag-over-folder');
      const srcPath = state.draggedTreeItem.path;
      if (srcPath && srcPath !== item.path) {
        const parentDir = item.path.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
        await moveTreeItem(srcPath, parentDir);
      }
    });
  }

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
    chevron.innerHTML = `<svg class="chevron-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
    chevron.classList.add('open'); // default open
  } else {
    chevron.style.visibility = 'hidden';
  }
  row.appendChild(chevron);

  // Icon
  const icon = document.createElement('span');
  icon.className = 'tree-item-icon';
  icon.innerHTML = getFileIcon(item.name, item.isDir, true);
  row.appendChild(icon);

  // Label (without extension for text memos, with extension for external files)
  const cleanLabelName = isTextMemo(item.name) ? getDisplayName(item.name, item.isDir) : item.name;
  const label = document.createElement('span');
  label.className = 'tree-item-label';
  label.textContent = cleanLabelName;
  label.setAttribute('data-path', item.path);
  label.setAttribute('data-raw-name', cleanLabelName);
  label.setAttribute('data-full-name', item.name);
  row.setAttribute('data-name', item.name);
  row.setAttribute('data-is-dir', item.isDir ? 'true' : 'false');
  row.appendChild(label);

  // Hover Actions
  const actions = document.createElement('div');
  actions.className = 'tree-item-actions';

  if (item.isDir) {
    const btnAdd = document.createElement('button');
    btnAdd.className = 'action-btn';
    btnAdd.title = '이 폴더 안에 새 메모 생성';
    btnAdd.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`;
    btnAdd.onclick = (e) => { e.stopPropagation(); promptNewFile(item.path); };
    actions.appendChild(btnAdd);

    const btnAddFolder = document.createElement('button');
    btnAddFolder.className = 'action-btn';
    btnAddFolder.title = '이 폴더 안에 새 폴더 생성';
    btnAddFolder.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`;
    btnAddFolder.onclick = (e) => { e.stopPropagation(); promptNewFolder(item.path); };
    actions.appendChild(btnAddFolder);
  }

  const btnRename = document.createElement('button');
  btnRename.className = 'action-btn';
  btnRename.title = '이름 변경';
  btnRename.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  btnRename.onclick = (e) => { e.stopPropagation(); promptRename(item.path, item.name); };
  actions.appendChild(btnRename);

  const btnDelete = document.createElement('button');
  btnDelete.className = 'action-btn action-btn-delete';
  btnDelete.title = '삭제';
  btnDelete.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
  btnDelete.onclick = (e) => { e.stopPropagation(); promptDelete(item.path, item.name, item.isDir); };
  actions.appendChild(btnDelete);

  row.appendChild(actions);
  wrapper.appendChild(row);

  // Children Container for folders
  let childrenContainer = null;
  if (item.isDir) {
    childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children';
    const childItems = filterTreeItems(item.children || []);
    if (childItems.length > 0) {
      childItems.forEach(child => {
        childrenContainer.appendChild(createTreeNode(child));
      });
    }
    wrapper.appendChild(childrenContainer);

    chevron.onclick = (e) => {
      e.stopPropagation();
      const isOpen = chevron.classList.toggle('open');
      childrenContainer.classList.toggle('collapsed', !isOpen);
      icon.innerHTML = getFileIcon(item.name, true, isOpen);
    };
  }

  // Row Click
  row.onclick = () => {
    state.isRootTarget = false;
    if (currentFolderCard) currentFolderCard.classList.remove('selected-target');
    document.querySelectorAll('.tree-item.selected').forEach(el => el.classList.remove('selected'));
    row.classList.add('selected');

    state.selectedNodePath = item.path;
    state.selectedNodeIsDir = item.isDir;
    if (item.isDir) {
      if (childrenContainer) {
        const isOpen = chevron.classList.toggle('open');
        childrenContainer.classList.toggle('collapsed', !isOpen);
        icon.innerHTML = getFileIcon(item.name, true, isOpen);
      }
    } else {
      if (isTextMemo(item.name)) {
        loadFile(item.path);
      } else {
        openExternalLink(item.path);
      }
    }
  };

  return wrapper;
}

// Load File into Editor
async function loadFile(filePath, isNavigatingHistory = false, forceReload = false, isSilent = false) {
  if (!filePath) return false;

  // Don't reload if already open and clean (unless forceReload is requested)
  if (!forceReload && state.currentFilePath === filePath && !state.isDirty) {
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
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || '파일을 읽을 수 없습니다.');
      }
      fileData = await res.json();
      break;
    } catch (err) {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      console.warn('Error fetching file:', err);
      if (!isSilent) {
        alert('파일을 불러오지 못했습니다: ' + err.message);
      }
      return false;
    }
  }

  // 2. Safely update UI with loaded content
  try {
    const previousPath = state.currentFilePath;
    state.currentFilePath = filePath;
    state.selectedNodePath = filePath;
    state.selectedNodeIsDir = false;
    if (colMode && colMode.active) exitColumnMode();
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

    // Update Header (hide extension & make clickable to rename)
    const fileName = filePath.split(/[\\/]/).pop();
    fileIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-title-svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
    const cleanTitle = getDisplayName(fileName, false);
    renderHeaderFileTitle(cleanTitle, false);
    fileTitle.classList.add('editable');
    fileTitle.title = '클릭하여 메모 이름 변경';
    fileTitle.onclick = () => {
      if (state.currentFilePath) {
        const curName = state.currentFilePath.split(/[\\/]/).pop();
        promptRename(state.currentFilePath, curName);
      }
    };
    filePathDisplay.textContent = getDisplayPathFromRoot(filePath);

    // Show Editor
    emptyState.classList.add('hidden');
    if (editorWorkspace) editorWorkspace.classList.remove('hidden');
    memoTextarea.classList.remove('hidden');

    memoTextarea.value = state.lastSavedContent;
    btnManualSave.disabled = true; // Clean loaded file, no unsaved changes!
    btnInsertLink.disabled = false;
    if (btnToggleFindReplace) btnToggleFindReplace.disabled = false;
    if (frState.isOpen) executeFind(0);

    // Display clean state with actual file modification time, without triggering a save
    updateSaveStatus('clean', state.lastSavedTimeStr);
    updateStats();
    updateCursorPos();
    updateLineNumbers();
    highlightActiveLine();
    renderTextHighlights();
  if (colMode && colMode.active) {
    renderColumnSelection();
  }

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
    saveStatusBadge.innerHTML = `<span class="status-dot status-dot-saved"></span><span class="status-text">저장됨</span>`;
    saveStatusBadge.title = timeStr ? `파일이 최신 상태로 보존되어 있습니다 (최종 수정: ${timeStr})` : '파일이 최신 상태로 보존되어 있습니다';
    saveStatusBadge.onclick = null;
    lastSavedTime.textContent = timeStr ? `최종 수정: ${timeStr}` : '최신 상태';
    updateUnsavedIndicators(false);
  } else if (status === 'saved') {
    // Actively saved
    const timeStr = detail || new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    state.lastSavedTimeStr = timeStr;
    saveStatusBadge.innerHTML = `<span class="status-dot status-dot-saved"></span><span class="status-text">저장됨</span>`;
    saveStatusBadge.title = `안전하게 저장되었습니다 (${timeStr})`;
    saveStatusBadge.onclick = null;
    lastSavedTime.textContent = `마지막 저장: ${timeStr}`;
    updateUnsavedIndicators(false);
  } else if (status === 'saving') {
    saveStatusBadge.innerHTML = `<span class="status-dot status-dot-saving pulse"></span><span class="status-text">저장 중...</span>`;
    saveStatusBadge.title = '서버에 자동 저장하고 있습니다';
    saveStatusBadge.onclick = null;
  } else if (status === 'editing' || status === 'unsaved') {
    saveStatusBadge.innerHTML = `<span class="status-dot status-dot-dirty"></span><span class="status-text">수정 중</span>`;
    saveStatusBadge.title = '아직 저장되지 않은 내용이 있습니다. 1초 후 자동 저장되거나 클릭하여 즉시 저장합니다.';
    saveStatusBadge.onclick = () => saveCurrentFile(true);
    updateUnsavedIndicators(true);
  } else if (status === 'error') {
    saveStatusBadge.innerHTML = `<span class="status-dot status-dot-error"></span><span class="status-text">저장 실패</span>`;
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
  renderHeaderFileTitle(cleanName, isUnsaved);

  // Sync header path display with current file path
  if (filePathDisplay) {
    filePathDisplay.textContent = getDisplayPathFromRoot(state.currentFilePath);
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

// Recursively get all memo files in tree (.txt / .md)
function getAllMemoFiles(items, result = []) {
  if (!items) return result;
  items.forEach(item => {
    if (!item.isDir && isTextMemo(item.name)) {
      result.push({ name: item.name, path: item.path });
    }
    if (item.children) {
      getAllMemoFiles(item.children, result);
    }
  });
  return result;
}

// Recursively get all files (memos + external files like .xlsx, .pdf, etc.)
function getAllFiles(items, result = []) {
  if (!items) return result;
  items.forEach(item => {
    if (!item.isDir) {
      result.push({ name: item.name, path: item.path, isText: isTextMemo(item.name) });
    }
    if (item.children) {
      getAllFiles(item.children, result);
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

// Jump to linked memo or launch external file (.xlsx, .pdf, etc.) in system application
async function jumpToMemo(target) {
  let cleanTarget = target.trim().replace(/^\[\[/, '').replace(/\]\]$/, '');
  if (!cleanTarget) return;

  if (/^www\./i.test(cleanTarget)) {
    cleanTarget = 'https://' + cleanTarget;
  }
  const isUrl = /^https?:\/\//i.test(cleanTarget);
  const ext = cleanTarget.includes('.') ? cleanTarget.split('.').pop().toLowerCase() : '';
  const isExternalExt = /^(xlsx?|csv|pdf|docx?|pptx?|hwp|hwpx|png|jpe?g|gif|webp|svg|zip|rar|7z|tar|gz|mp4|mov|avi|mp3|wav|m4a|exe|msi)$/i.test(ext);

  // If it's a URL or known non-text file extension -> open with OS default application!
  if (isUrl || isExternalExt) {
    await openExternalLink(cleanTarget);
    return;
  }

  // Otherwise search for a text memo (.txt / .md)
  const matchedPath = findMemoPath(cleanTarget);

  if (matchedPath) {
    await loadFile(matchedPath);
  } else {
    // Check if an external file exists in the folder tree with this name
    const allExtFiles = getAllFiles(state.treeData);
    const foundExt = allExtFiles.find(f => {
      const fName = f.name.toLowerCase();
      const targetLower = cleanTarget.toLowerCase();
      return fName === targetLower || fName.startsWith(targetLower + '.');
    });

    if (foundExt && !isTextMemo(foundExt.name)) {
      await openExternalLink(foundExt.path);
      return;
    }

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

// --- Find & Replace Logic ---
let frState = {
  isOpen: false,
  isReplaceOpen: false,
  matchCase: false,
  matches: [],
  currentIndex: -1
};

function openFindPanel(showReplace = false) {
  if (!state.currentFilePath) return;
  findReplacePanel.classList.remove('hidden');
  frState.isOpen = true;
  if (btnToggleFindReplace) btnToggleFindReplace.classList.add('active');

  if (showReplace) {
    replaceRow.classList.remove('hidden');
    frState.isReplaceOpen = true;
    btnToggleReplaceMode.textContent = '▴';
  }

  // Pre-fill with current selection if non-empty and single-line
  const start = memoTextarea.selectionStart;
  const end = memoTextarea.selectionEnd;
  if (start !== end) {
    const selText = memoTextarea.value.substring(start, end);
    if (!selText.includes('\n') && selText.length < 80) {
      findInput.value = selText;
    }
  }

  if (showReplace && findInput.value.trim()) {
    replaceInput.focus();
    replaceInput.select();
  } else {
    findInput.focus();
    findInput.select();
  }

  executeFind(0);
}

function closeFindPanel() {
  if (!findReplacePanel) return;
  findReplacePanel.classList.add('hidden');
  frState.isOpen = false;
  frState.matches = [];
  frState.currentIndex = -1;
  if (btnToggleFindReplace) btnToggleFindReplace.classList.remove('active');
  renderTextHighlights();
  if (colMode && colMode.active) {
    renderColumnSelection();
  }
  memoTextarea.focus();
}

function toggleReplaceMode() {
  frState.isReplaceOpen = !frState.isReplaceOpen;
  if (frState.isReplaceOpen) {
    replaceRow.classList.remove('hidden');
    btnToggleReplaceMode.textContent = '▴';
    replaceInput.focus();
    replaceInput.select();
  } else {
    replaceRow.classList.add('hidden');
    btnToggleReplaceMode.textContent = '▾';
    findInput.focus();
  }
}

function scrollCharIntoView(charIndex) {
  const linesBefore = memoTextarea.value.substring(0, charIndex).split('\n');
  const lineNum = linesBefore.length - 1;
  const targetTop = lineNum * 24;
  const currentScroll = memoTextarea.scrollTop;
  const viewHeight = memoTextarea.clientHeight;
  if (targetTop < currentScroll || targetTop > currentScroll + viewHeight - 60) {
    memoTextarea.scrollTop = Math.max(0, targetTop - viewHeight / 2);
  }
}

function executeFind(direction = 0) {
  const query = findInput.value;
  if (!query) {
    frState.matches = [];
    frState.currentIndex = -1;
    findCount.textContent = '0 / 0';
    findCount.style.color = '';
    renderTextHighlights();
  if (colMode && colMode.active) {
    renderColumnSelection();
  }
    return;
  }

  const text = memoTextarea.value;
  const q = frState.matchCase ? query : query.toLowerCase();
  const src = frState.matchCase ? text : text.toLowerCase();
  const matches = [];
  let idx = src.indexOf(q);
  while (idx !== -1) {
    matches.push({ start: idx, end: idx + query.length });
    idx = src.indexOf(q, idx + 1);
  }
  frState.matches = matches;

  if (matches.length === 0) {
    findCount.textContent = '결과 없음';
    findCount.style.color = '#ef4444';
    frState.currentIndex = -1;
    renderTextHighlights();
  if (colMode && colMode.active) {
    renderColumnSelection();
  }
    return;
  }

  findCount.style.color = '';

  if (direction === 0) {
    const selStart = memoTextarea.selectionStart;
    let nextIdx = matches.findIndex(m => m.start >= selStart);
    if (nextIdx === -1) nextIdx = 0;
    frState.currentIndex = nextIdx;
  } else if (direction === 1) {
    frState.currentIndex = (frState.currentIndex + 1) % matches.length;
  } else if (direction === -1) {
    frState.currentIndex = (frState.currentIndex - 1 + matches.length) % matches.length;
  }

  const cur = matches[frState.currentIndex];
  findCount.textContent = `${frState.currentIndex + 1} / ${matches.length}`;
  memoTextarea.setSelectionRange(cur.start, cur.end);
  scrollCharIntoView(cur.start);
  updateCursorPos();
  highlightActiveLine();
  renderTextHighlights();
  if (colMode && colMode.active) {
    renderColumnSelection();
  }
}

function replaceOne() {
  const query = findInput.value;
  if (!query || frState.matches.length === 0 || frState.currentIndex === -1) return;

  const cur = frState.matches[frState.currentIndex];
  const rep = replaceInput.value || '';
  const text = memoTextarea.value;

  memoTextarea.value = text.substring(0, cur.start) + rep + text.substring(cur.end);
  memoTextarea.setSelectionRange(cur.start, cur.start + rep.length);
  memoTextarea.dispatchEvent(new Event('input'));
  executeFind(0);
}

function replaceAll() {
  const query = findInput.value;
  if (!query) return;

  executeFind(0);
  if (frState.matches.length === 0) return;

  const count = frState.matches.length;
  const rep = replaceInput.value || '';
  const text = memoTextarea.value;
  let newText = '';

  if (frState.matchCase) {
    newText = text.split(query).join(rep);
  } else {
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    newText = text.replace(regex, rep);
  }

  memoTextarea.value = newText;
  memoTextarea.dispatchEvent(new Event('input'));
  executeFind(0);
  findCount.textContent = `${count}개 바꿈`;
  findCount.style.color = '#10b981';
}

// Helper: Detect if string is a valid web URL or domain
function detectUrl(raw) {
  if (!raw) return null;
  const str = raw.trim();
  if (/^https?:\/\//i.test(str)) {
    return str;
  }
  if (/^www\./i.test(str)) {
    return 'https://' + str;
  }
  const fileExts = /^(txt|md|markdown|xlsx?|csv|pdf|docx?|pptx?|hwp|hwpx|png|jpe?g|gif|webp|svg|zip|rar|7z|tar|gz|mp3|wav|mp4|mov|avi|js|html|css|json|py)$/i;
  const m = str.match(/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+([a-zA-Z]{2,63})(\/.*)?$/);
  if (m) {
    const tld = m[3];
    const hasPath = Boolean(m[4]);
    if (!hasPath && fileExts.test(tld)) {
      return null;
    }
    return 'https://' + str;
  }
  return null;
}

// Track active selection when Link Modal is opened
let linkModalSelection = { start: 0, end: 0, selectedText: '' };

// Open Link Insertion Modal
function openLinkSelectorModal() {
  const start = memoTextarea.selectionStart || 0;
  const end = memoTextarea.selectionEnd || 0;
  linkModalSelection = {
    start,
    end,
    selectedText: memoTextarea.value.substring(start, end).trim()
  };

  const allFiles = getAllFiles(state.treeData).filter(f => f.path !== state.currentFilePath);
  linkSearchInput.value = '';
  renderLinkItems(allFiles, '');
  linkModalOverlay.classList.remove('hidden');
  linkSearchInput.focus();

  linkSearchInput.oninput = () => {
    const raw = linkSearchInput.value;
    const q = raw.toLowerCase().trim();
    const filtered = allFiles.filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
    renderLinkItems(filtered, raw);
  };

  linkSearchInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = linkSearchInput.value.trim();
      const detected = detectUrl(q);
      if (detected) {
        const selText = linkModalSelection.selectedText;
        const linkText = selText ? `[${selText}](${detected})` : `[${detected}](${detected})`;
        insertLinkIntoTextarea(linkText);
        linkModalOverlay.classList.add('hidden');
        return;
      }
      const firstRow = linkItemsList.querySelector('.link-item-row');
      if (firstRow) {
        firstRow.click();
      }
    } else if (e.key === 'Escape') {
      linkModalOverlay.classList.add('hidden');
      memoTextarea.focus();
    }
  };
}

function renderLinkItems(files, query = '') {
  linkItemsList.innerHTML = '';
  const detectedUrl = detectUrl(query);
  const selText = linkModalSelection ? linkModalSelection.selectedText : '';

  if (detectedUrl) {
    const urlRow = document.createElement('div');
    urlRow.className = 'link-item-row link-item-url-row';
    const linkText = selText ? `[${selText}](${detectedUrl})` : `[${detectedUrl}](${detectedUrl})`;
    urlRow.innerHTML = `
      <span class="link-item-icon" style="color: #3b82f6;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
      </span>
      <div style="display: flex; flex-direction: column; overflow: hidden; flex: 1; min-width: 0;">
        <span class="link-item-name" style="font-weight: 600; color: var(--accent);">웹 링크 삽입: ${escapeHtml(linkText)}</span>
        <span class="link-item-path" style="font-size: 11px; opacity: 0.8;">클릭하거나 Enter 키를 누르면 본문에 삽입됩니다</span>
      </div>
    `;
    urlRow.onclick = () => {
      insertLinkIntoTextarea(linkText);
      linkModalOverlay.classList.add('hidden');
    };
    linkItemsList.appendChild(urlRow);
  }

  if (files.length === 0 && !detectedUrl) {
    linkItemsList.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12px;">일치하는 메모나 파일이 없습니다. (웹 URL을 직접 입력할 수도 있습니다)</div>';
    return;
  }

  // Count duplicate names to automatically qualify with folder path if needed
  const nameCounts = {};
  files.forEach(f => {
    const c = f.isText ? getDisplayName(f.name, false) : f.name;
    nameCounts[c] = (nameCounts[c] || 0) + 1;
  });

  files.forEach(file => {
    const row = document.createElement('div');
    row.className = 'link-item-row';
    const cleanName = file.isText ? getDisplayName(file.name, false) : file.name;
    const relPath = file.path.replace(state.rootFolder, '').replace(/^[\\/]/, '');
    const hasDuplicate = nameCounts[cleanName] > 1;
    const linkToInsert = hasDuplicate ? relPath : cleanName;
    const icon = getFileIcon(file.name, false);

    row.innerHTML = `
      <span class="link-item-icon">${icon}</span>
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
  const start = (linkModalSelection && typeof linkModalSelection.start === 'number')
    ? linkModalSelection.start
    : memoTextarea.selectionStart;
  const end = (linkModalSelection && typeof linkModalSelection.end === 'number')
    ? linkModalSelection.end
    : memoTextarea.selectionEnd;
  const val = memoTextarea.value;
  memoTextarea.value = val.substring(0, start) + linkText + val.substring(end);
  memoTextarea.selectionStart = memoTextarea.selectionEnd = start + linkText.length;
  memoTextarea.focus();

  // Reset modal selection
  linkModalSelection = { start: memoTextarea.selectionStart, end: memoTextarea.selectionEnd, selectedText: '' };

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

// --- Text Highlights (Find & Word Selection Occurrences) ---
let renderHighlightsRaf = null;

function isWordChar(char) {
  return /^[a-zA-Z0-9_\uAC00-\uD7A3]$/.test(char);
}

function renderTextHighlights() {
  if (renderHighlightsRaf) cancelAnimationFrame(renderHighlightsRaf);
  renderHighlightsRaf = requestAnimationFrame(() => {
    doRenderTextHighlights();
  });
}

function doRenderTextHighlights() {
  if (!editorHighlights || !memoTextarea) return;

  const text = memoTextarea.value || '';
  if (!text || memoTextarea.classList.contains('hidden')) {
    editorHighlights.innerHTML = '';
    editorHighlights.classList.add('hidden');
    return;
  }

  // 1. Gather ranges to highlight
  const ranges = [];

  // A. Find & Replace matches (Priority: yellow/amber)
  if (frState.isOpen && frState.matches && frState.matches.length > 0) {
    frState.matches.forEach((m, idx) => {
      const isCur = (idx === frState.currentIndex);
      ranges.push({
        start: m.start,
        end: m.end,
        className: isCur ? 'hl-match hl-current' : 'hl-match'
      });
    });
  } else {
  // Selection occurrences (VS Code style cyan/blue)
    const selStart = memoTextarea.selectionStart;
    const selEnd = memoTextarea.selectionEnd;
    if (typeof selStart === 'number' && typeof selEnd === 'number' && selEnd > selStart) {
      const selectedText = text.substring(selStart, selEnd);
      const trimmed = selectedText.trim();
      // Only highlight identical occurrences when 2 or more characters are selected (up to 80 chars)
      if (trimmed.length >= 2 && trimmed.length <= 80 && !selectedText.includes('\n')) {
        const q = trimmed.toLowerCase();
        const src = text.toLowerCase();
        let idx = src.indexOf(q);
        while (idx !== -1) {
          const end = idx + trimmed.length;
          ranges.push({
            start: idx,
            end: end,
            className: 'hl-occurrence'
          });
          idx = src.indexOf(q, idx + 1);
        }
      }
    }
  }

  if (ranges.length === 0) {
    editorHighlights.innerHTML = '';
    editorHighlights.classList.add('hidden');
    return;
  }

  // Sort ranges by start position
  ranges.sort((a, b) => a.start - b.start);

  // Build markup
  let html = '';
  let lastIdx = 0;
  for (const r of ranges) {
    if (r.start < lastIdx) continue; // Skip overlaps safely
    if (r.start > lastIdx) {
      html += escapeHtml(text.substring(lastIdx, r.start));
    }
    html += `<mark class="${r.className}">${escapeHtml(text.substring(r.start, r.end))}</mark>`;
    lastIdx = r.end;
  }
  if (lastIdx < text.length) {
    html += escapeHtml(text.substring(lastIdx));
  }
  if (text.endsWith('\n')) {
    html += ' ';
  }

  editorHighlights.innerHTML = html;
  editorHighlights.classList.remove('hidden');

  // Sync scroll
  editorHighlights.scrollTop = memoTextarea.scrollTop;
  editorHighlights.scrollLeft = memoTextarea.scrollLeft;
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

  const pos = memoTextarea.selectionStart || 0;
  const currentLineIdx = text.substring(0, pos).split('\n').length - 1;

  let gutterHtml = '';

  const cs = window.getComputedStyle(memoTextarea);
  const baseHeight = Math.round(parseFloat(cs.lineHeight) || 24);

  if (!state.wordWrap) {
    // When word wrap is OFF, line height strictly follows font line-height
    for (let i = 0; i < lineCount; i++) {
      const isActive = (i === currentLineIdx);
      gutterHtml += `<div class="gutter-line${isActive ? ' active' : ''}" data-line="${i + 1}" style="height: ${baseHeight}px; line-height: ${baseHeight}px;" title="클릭하여 ${i + 1}번째 줄 선택">${i + 1}</div>`;
    }
  } else {
    // When word wrap is ON, measure wrapped line heights with mirror
    const mirror = getMirrorElement();
    const pl = parseFloat(cs.paddingLeft) || 24;
    const pr = parseFloat(cs.paddingRight) || 24;
    const contentWidth = Math.max(60, memoTextarea.clientWidth - pl - pr);
    mirror.style.width = `${contentWidth}px`;
    mirror.style.fontFamily = cs.fontFamily;
    mirror.style.fontSize = cs.fontSize;
    mirror.style.lineHeight = cs.lineHeight;
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordBreak = 'break-word';
    mirror.style.overflowWrap = 'break-word';

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
    for (let i = 0; i < lineCount; i++) {
      const h = rows[i] ? rows[i].offsetHeight : baseHeight;
      const isActive = (i === currentLineIdx);
      gutterHtml += `<div class="gutter-line${isActive ? ' active' : ''}" data-line="${i + 1}" style="height: ${h}px; line-height: ${baseHeight}px;" title="클릭하여 ${i + 1}번째 줄 선택">${i + 1}</div>`;
    }
  }

  gutterInner.innerHTML = gutterHtml;
  editorGutter.scrollTop = memoTextarea.scrollTop;
}

function applyFontSize(size, showNotification = true) {
  const clamped = Math.min(32, Math.max(11, Math.round(size)));
  state.fontSize = clamped;
  localStorage.setItem('memo_font_size', String(clamped));
  document.documentElement.style.setProperty('--editor-font-size', `${clamped}px`);
  if (typeof colWidthCache !== 'undefined') {
    colWidthCache.clear();
    colFontKey = '';
  }
  if (state.showLineNumbers) {
    updateLineNumbers();
  }
  renderTextHighlights();
  if (colMode && colMode.active) {
    renderColumnSelection();
  }
  if (showNotification) {
    showToast(`🔍 글자 크기: ${clamped}px`);
  }
}

function zoomIn() {
  applyFontSize((state.fontSize || 14.5) + 1.5);
}

function zoomOut() {
  applyFontSize((state.fontSize || 14.5) - 1.5);
}

function zoomReset() {
  applyFontSize(14.5);
}

function printCurrentMemo() {
  if (!state.currentFilePath || memoTextarea.classList.contains('hidden')) {
    alert('인쇄할 메모가 열려 있지 않습니다.');
    return;
  }
  window.print();
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
  if (!editorGutter) return;
  if (state.showLineNumbers) {
    editorGutter.classList.remove('hidden');
    if (btnToggleLineNumbers) {
      btnToggleLineNumbers.classList.add('active');
      btnToggleLineNumbers.title = '라인 번호 숨기기 (단축키: Alt+L)';
    }
    if (btnFooterLineNumbers) {
      btnFooterLineNumbers.classList.add('active');
      btnFooterLineNumbers.title = '줄 번호 끄기 (단축키: Alt+L)';
    }
    updateLineNumbers();
    highlightActiveLine();
  } else {
    editorGutter.classList.add('hidden');
    if (btnToggleLineNumbers) {
      btnToggleLineNumbers.classList.remove('active');
      btnToggleLineNumbers.title = '라인 번호 표시 (단축키: Alt+L)';
    }
    if (btnFooterLineNumbers) {
      btnFooterLineNumbers.classList.remove('active');
      btnFooterLineNumbers.title = '줄 번호 켜기 (단축키: Alt+L)';
    }
  }
}

function toggleWordWrap(forceState) {
  state.wordWrap = (typeof forceState === 'boolean') ? forceState : !state.wordWrap;
  localStorage.setItem('memo_word_wrap', state.wordWrap ? 'true' : 'false');
  updateWordWrapVisibility();
}

function updateWordWrapVisibility() {
  if (!memoTextarea) return;
  if (state.wordWrap) {
    memoTextarea.classList.remove('no-wrap');
    if (editorHighlights) editorHighlights.classList.remove('no-wrap');
    if (btnFooterWordWrap) {
      btnFooterWordWrap.classList.add('active');
      btnFooterWordWrap.title = '자동 줄바꿈 끄기 (단축키: Alt+Z)';
    }
  } else {
    memoTextarea.classList.add('no-wrap');
    if (editorHighlights) editorHighlights.classList.add('no-wrap');
    if (btnFooterWordWrap) {
      btnFooterWordWrap.classList.remove('active');
      btnFooterWordWrap.title = '자동 줄바꿈 켜기 (단축키: Alt+Z)';
    }
  }
  if (state.showLineNumbers) {
    updateLineNumbers();
  }
  renderTextHighlights();
  if (colMode && colMode.active) {
    renderColumnSelection();
  }
}

// Cross-platform filename and folder name validator
function validateItemName(name, itemType = '항목') {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: `${itemType} 이름을 입력해주세요.` };
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: `${itemType} 이름을 입력해주세요. (공백만으로는 생성할 수 없습니다)` };
  }

  // 1. Slashes & Backslashes
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return {
      valid: false,
      error: `${itemType} 이름에 슬래시(/)나 역슬래시(\\)를 포함할 수 없습니다.\n(운영체제의 경로 구분 기호입니다. 대신 '-' 또는 '_' 등을 사용해주세요.)`
    };
  }

  // 2. Windows / OS forbidden special characters
  const forbiddenMatch = trimmed.match(/[:*?"<>|]/);
  if (forbiddenMatch) {
    return {
      valid: false,
      error: `${itemType} 이름에 사용할 수 없는 특수문자('${forbiddenMatch[0]}')가 포함되어 있습니다.\n(사용 불가 특수문자: / \\ : * ? " < > |)`
    };
  }

  // 3. Dot rules
  if (trimmed === '.' || trimmed === '..') {
    return {
      valid: false,
      error: `'.' 또는 '..'은 시스템 예약 경로이므로 ${itemType} 이름으로 사용할 수 없습니다.`
    };
  }
  if (trimmed.endsWith('.')) {
    return {
      valid: false,
      error: `${itemType} 이름은 마침표(.)나 공백으로 끝날 수 없습니다.`
    };
  }

  // 4. Windows reserved device names
  const baseNameOnly = trimmed.replace(/\.[^.]+$/, '').toUpperCase();
  const windowsReserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  if (windowsReserved.includes(baseNameOnly)) {
    return {
      valid: false,
      error: `'${baseNameOnly}'은(는) 운영체제 시스템 예약어이므로 ${itemType} 이름으로 사용할 수 없습니다.`
    };
  }

  return { valid: true, name: trimmed };
}

// Prompt Modals
function showModal(title, desc, initialValue, onConfirm, validationType = null) {
  modalTitle.textContent = title;
  modalDesc.textContent = desc;
  modalInput.value = initialValue || '';
  modalInput.classList.remove('error');
  if (modalError) {
    modalError.textContent = '';
    modalError.classList.add('hidden');
  }
  modalOverlay.classList.remove('hidden');
  modalInput.focus();
  modalCallback = onConfirm;
  modalValidationType = validationType;
}

function setModalError(msg) {
  if (!modalError) return;
  if (msg) {
    modalError.textContent = msg;
    modalError.classList.remove('hidden');
    modalInput.classList.add('error');
  } else {
    modalError.textContent = '';
    modalError.classList.add('hidden');
    modalInput.classList.remove('error');
  }
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  modalCallback = null;
  modalValidationType = null;
  if (modalError) {
    modalError.textContent = '';
    modalError.classList.add('hidden');
  }
  modalInput.classList.remove('error');
}

// Helper to render the header file title with unsaved dot and rename icon
function renderHeaderFileTitle(cleanTitle, isUnsaved) {
  if (!fileTitle) return;
  const renameIconSvg = `<svg class="file-title-rename-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  if (isUnsaved) {
    fileTitle.innerHTML = `<span class="file-title-text">${escapeHtml(cleanTitle)}</span> <span class="unsaved-dot" title="저장되지 않음">●</span> ${renameIconSvg}`;
  } else {
    fileTitle.innerHTML = `<span class="file-title-text">${escapeHtml(cleanTitle)}</span> ${renameIconSvg}`;
  }
}

// Display path starting from the root folder shown in the top-left (e.g. memos/업무)
function getDisplayPathFromRoot(targetPath) {
  if (!targetPath || !state.rootFolder) {
    return typeof currentFolderName !== 'undefined' && currentFolderName ? currentFolderName.textContent.trim() : '루트 폴더';
  }
  const normTarget = targetPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const normRoot = state.rootFolder.replace(/\\/g, '/').replace(/\/+$/, '');
  const rootBaseName = normRoot.split('/').pop() || 'memos';

  if (normTarget === normRoot) {
    return rootBaseName;
  }
  if (normTarget.startsWith(normRoot + '/')) {
    const rel = normTarget.slice(normRoot.length + 1);
    return `${rootBaseName}/${rel}`;
  }
  return normTarget.split('/').slice(-2).join('/') || rootBaseName;
}

async function promptNewFile(targetDir) {
  const dir = targetDir || getActiveTargetDir();
  try {
    const res = await fetch('/api/create-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dirPath: dir, autoName: true })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '새 메모 생성 실패');

    await loadTree();
    await loadFile(data.path);

    if (memoTextarea) {
      memoTextarea.focus();
    }

    const cleanTitle = getDisplayName(data.fileName, false);
    showToast(`✨ '${cleanTitle}' 생성됨 (제목을 클릭해 이름 변경 가능)`);
  } catch (err) {
    alert('새 메모 생성 실패:\n' + err.message);
  }
}

function promptNewFolder(targetDir) {
  const dir = targetDir || getActiveTargetDir();
  const folderRel = getDisplayPathFromRoot(dir);
  showModal(
    '새 폴더 만들기',
    `'${folderRel}' 위치에 생성할 폴더 이름을 입력하세요:`,
    '',
    async (folderName) => {
      const v = validateItemName(folderName, '폴더');
      if (!v.valid) {
        throw new Error(v.error);
      }
      const res = await fetch('/api/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dirPath: dir, folderName: v.name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '폴더 생성에 실패했습니다.');
      await loadTree();
      if (folderBrowserModalOverlay && !folderBrowserModalOverlay.classList.contains('hidden')) {
        await loadFolderBrowserDirs(fbState.browsingPath);
      }
      showToast(`📁 '${v.name}' 폴더가 생성되었습니다.`);
      return true;
    },
    '폴더'
  );
}

function promptRename(oldPath, currName) {
  const isDir = !pathHasExtension(currName);
  const itemType = isDir ? '폴더' : '파일';
  const cleanCurrent = getDisplayName(currName, isDir);
  showModal(
    '이름 변경',
    `새로운 ${itemType} 이름을 입력하세요:`,
    cleanCurrent,
    async (newName) => {
      const trimmedNew = newName.trim();
      if (!trimmedNew || trimmedNew === cleanCurrent) return true;
      const v = validateItemName(trimmedNew, itemType);
      if (!v.valid) {
        throw new Error(v.error);
      }
      // If the currently open file is inside or equal to oldPath, save any pending edits first
      if (state.isDirty && state.currentFilePath && isPathEqualOrInside(state.currentFilePath, oldPath)) {
        await saveCurrentFile(false);
      }

      const res = await fetch('/api/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath, newName: v.name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '이름 변경에 실패했습니다.');

      const rewritePath = (p) => {
        if (!p) return p;
        const normP = p.replace(/\\/g, '/');
        const normOld = oldPath.replace(/\\/g, '/').replace(/\/+$/, '');
        const normNew = data.newPath.replace(/\\/g, '/').replace(/\/+$/, '');
        if (normP === normOld) return data.newPath;
        if (normP.startsWith(normOld + '/')) {
          return normNew + normP.slice(normOld.length);
        }
        return p;
      };

      navHistory.past = navHistory.past.map(rewritePath);
      navHistory.future = navHistory.future.map(rewritePath);

      const isCurrentAffected = state.currentFilePath && isPathEqualOrInside(state.currentFilePath, oldPath);

      await loadTree();

      if (isCurrentAffected) {
        const updatedCurrent = rewritePath(state.currentFilePath);
        // Do NOT pre-mutate state.currentFilePath; loadFile with forceReload will fetch,
        // update state.currentFilePath, renderHeaderFileTitle, and update filePathDisplay!
        await loadFile(updatedCurrent, true, true);
      }

      showToast(`✏️ '${v.name}'(으)로 이름이 변경되었습니다.`);
      return true;
    },
    itemType
  );
}

function pathHasExtension(p) {
  return /\.(txt|md|markdown|json|csv)$/i.test(p);
}

// Cross-platform helper to check if a path is identical to or located inside a directory
function isPathEqualOrInside(childPath, parentPath) {
  if (!childPath || !parentPath) return false;
  const normChild = childPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const normParent = parentPath.replace(/\\/g, '/').replace(/\/+$/, '');
  return normChild === normParent || normChild.startsWith(normParent + '/');
}

// Clear active editor when currently opened file or its containing folder is deleted
function clearActiveEditor() {
  if (state.saveTimeout) {
    clearTimeout(state.saveTimeout);
    state.saveTimeout = null;
  }
  if (state.maxSaveTimeout) {
    clearTimeout(state.maxSaveTimeout);
    state.maxSaveTimeout = null;
  }
  state.isDirty = false;
  state.lastSavedContent = null;
  state.currentFilePath = null;

  memoTextarea.value = '';
  memoTextarea.classList.add('hidden');
  if (editorWorkspace) editorWorkspace.classList.add('hidden');
  emptyState.classList.remove('hidden');

  fileTitle.textContent = '선택된 메모 없음';
  fileTitle.classList.remove('editable');
  fileTitle.title = '';
  fileTitle.onclick = null;
  filePathDisplay.textContent = '왼쪽 목록에서 메모를 선택하거나 새로 만드세요';
  fileIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-title-svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
  saveStatusBadge.textContent = '';
  saveStatusBadge.className = 'status-badge';

  btnManualSave.disabled = true;
  btnInsertLink.disabled = true;
  if (btnToggleFindReplace) {
    btnToggleFindReplace.disabled = true;
    closeFindPanel();
  }

  updateStats();
  updateCursorPos();
  updateTreeActiveState();
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '삭제 실패');

      // If the currently open file is the deleted item or is inside the deleted folder:
      if (state.currentFilePath && isPathEqualOrInside(state.currentFilePath, targetPath)) {
        clearActiveEditor();
      }

      // Filter out deleted paths from navigation history
      navHistory.past = navHistory.past.filter(p => !isPathEqualOrInside(p, targetPath));
      navHistory.future = navHistory.future.filter(p => !isPathEqualOrInside(p, targetPath));
      updateNavButtons();

      showToast(`🗑️ ${itemType} '${displayTitle}'이(가) 삭제되었습니다.`);
      await loadTree();
    }).catch(err => alert(err.message));
  }
}

function selectRootFolder() {
  state.selectedNodePath = state.rootFolder;
  state.selectedNodeIsDir = true;
  state.isRootTarget = true;

  document.querySelectorAll('.tree-item.selected').forEach(el => el.classList.remove('selected'));
  if (currentFolderCard) {
    currentFolderCard.classList.add('selected-target');
  }
  const rootName = state.rootFolder ? state.rootFolder.split(/[\\/]/).pop() : 'memos';
  showToast(`📁 최상단 폴더 '${rootName}' 선택됨 (여기에 새 메모/폴더 생성)`);
}

function getActiveTargetDir() {
  if (state.isRootTarget || state.selectedNodePath === state.rootFolder) {
    return state.rootFolder;
  }
  if (state.selectedNodePath) {
    if (state.selectedNodeIsDir) {
      return state.selectedNodePath;
    }
    // If selected node is a file, return its parent directory
    const parts = state.selectedNodePath.replace(/\\/g, '/').split('/');
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
          row.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(f.name)}</span>
          `;
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
  if (currentFolderCard) {
    currentFolderCard.onclick = (e) => {
      if (!e.target.closest('#btnChangeFolder')) {
        selectRootFolder();
      }
    };
  }
  btnNewFile.onclick = () => promptNewFile();
  btnNewFolder.onclick = () => promptNewFolder();
  btnRefresh.onclick = loadTree;
  btnManualSave.onclick = () => saveCurrentFile(true);

  // Theme Toggle Button
  if (btnThemeToggle) btnThemeToggle.onclick = toggleTheme;

  // App Exit Power Button
  const btnAppExit = document.getElementById('btnAppExit');
  if (btnAppExit) {
    btnAppExit.onclick = async () => {
      if (confirm('Desktop Memo 프로그램을 완전히 종료하시겠습니까?')) {
        try {
          await fetch('/api/shutdown');
        } catch (e) {}
        window.close();
        setTimeout(() => {
          document.body.innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;font-size:15px;color:var(--text-muted);font-family:sans-serif;text-align:center;line-height:1.6;">Desktop Memo 프로그램이 안전하게 종료되었습니다.<br>이 창을 닫으셔도 됩니다.</div>';
        }, 150);
      }
    };
  }

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
        btnFbNativePicker.innerHTML = '⏳ 탐색기 여는 중... (화면 뒤 확인)';
        btnFbNativePicker.title = '탐색기 창이 메모 앱 뒤에 가려져 있을 수 있습니다. 보이지 않으면 Alt+Tab을 눌러보세요.';
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
        btnFbNativePicker.title = '시스템 탐색기 창으로 직접 선택';
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

  // Find & Replace Toggle Button
  if (btnToggleFindReplace) {
    btnToggleFindReplace.onclick = () => {
      if (frState.isOpen) closeFindPanel();
      else openFindPanel(false);
    };
  }

  // Find & Replace Panel Listeners
  if (findInput) {
    findInput.addEventListener('input', () => executeFind(0));
    findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeFind(e.shiftKey ? -1 : 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeFindPanel();
      }
    });
  }

  if (replaceInput) {
    replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        replaceOne();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeFindPanel();
      }
    });
  }

  if (btnFindPrev) btnFindPrev.onclick = () => executeFind(-1);
  if (btnFindNext) btnFindNext.onclick = () => executeFind(1);
  if (btnToggleReplaceMode) btnToggleReplaceMode.onclick = toggleReplaceMode;
  if (btnFindClose) btnFindClose.onclick = closeFindPanel;
  if (btnReplaceOne) btnReplaceOne.onclick = replaceOne;
  if (btnReplaceAll) btnReplaceAll.onclick = replaceAll;
  if (btnFindMatchCase) {
    btnFindMatchCase.onclick = () => {
      frState.matchCase = !frState.matchCase;
      btnFindMatchCase.classList.toggle('active', frState.matchCase);
      executeFind(0);
    };
  }

  // Link Insertion
  btnInsertLink.onclick = openLinkSelectorModal;
  btnLinkModalCancel.onclick = () => {
    linkModalOverlay.classList.add('hidden');
    memoTextarea.focus();
  };
  linkModalOverlay.onclick = (e) => {
    if (e.target === linkModalOverlay) {
      linkModalOverlay.classList.add('hidden');
      memoTextarea.focus();
    }
  };

  // External File Link Selection in Modal
  if (btnLinkExternalFile && externalFileInput) {
    btnLinkExternalFile.onclick = () => {
      externalFileInput.click();
    };
    externalFileInput.onchange = () => {
      if (externalFileInput.files && externalFileInput.files.length > 0) {
        const links = [];
        for (let i = 0; i < externalFileInput.files.length; i++) {
          const f = externalFileInput.files[i];
          links.push(`[[${f.name}]]`);
        }
        insertLinkIntoTextarea(links.join('\n'));
        linkModalOverlay.classList.add('hidden');
        showToast(`📎 ${links.length}개 파일 링크가 본문에 삽입되었습니다.`);
      }
      externalFileInput.value = '';
    };
  }

  // File Filter Toggle (txt only vs all files)
  if (btnToggleAllFiles) {
    btnToggleAllFiles.onclick = () => {
      state.showAllFiles = !state.showAllFiles;
      localStorage.setItem('memo_show_all_files', state.showAllFiles ? 'true' : 'false');
      updateFileFilterBtn();
      renderTree(state.treeData, treeRoot);
    };
  }

  // Drag and drop files directly onto memo textarea to link
  memoTextarea.addEventListener('dragover', (e) => {
    e.preventDefault();
    memoTextarea.classList.add('drag-over');
  });
  memoTextarea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    memoTextarea.classList.remove('drag-over');
  });
  memoTextarea.addEventListener('drop', (e) => {
    e.preventDefault();
    memoTextarea.classList.remove('drag-over');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const links = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const f = e.dataTransfer.files[i];
        links.push(`[[${f.name}]]`);
      }
      insertLinkIntoTextarea(links.join('\n'));
      showToast(`📎 ${links.length}개 파일 링크가 본문에 삽입되었습니다.`);
    }
  });

  // Tree Root Area Drop Targets (to move files to root folder)
  const treeScrollContainer = document.querySelector('.tree-scroll-container');
  [treeScrollContainer, treeRoot, currentFolderName].forEach(el => {
    if (!el) return;
    el.addEventListener('dragover', (e) => {
      if (!state.draggedTreeItem) return;
      if (e.target === treeScrollContainer || e.target === treeRoot || e.target === currentFolderName) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('drag-over-root');
      }
    });
    el.addEventListener('dragleave', (e) => {
      if (e.target === el) {
        el.classList.remove('drag-over-root');
      }
    });
    el.addEventListener('drop', async (e) => {
      el.classList.remove('drag-over-root');
      if (state.draggedTreeItem && (e.target === treeScrollContainer || e.target === treeRoot || e.target === currentFolderName)) {
        e.preventDefault();
        e.stopPropagation();
        await moveTreeItem(state.draggedTreeItem.path, state.rootFolder);
      }
    });
  });

  // Clicking empty space in tree deselects subfolder and targets root folder
  if (treeScrollContainer) {
    treeScrollContainer.addEventListener('click', (e) => {
      if (!e.target.closest('.tree-item')) {
        selectRootFolder();
      }
    });
  }

  // Line Numbers Toggle
  if (btnToggleLineNumbers) {
    btnToggleLineNumbers.onclick = () => {
      toggleLineNumbers();
    };
  }
  if (btnFooterLineNumbers) {
    btnFooterLineNumbers.onclick = () => {
      toggleLineNumbers();
    };
  }

  // Word Wrap Toggle
  if (btnFooterWordWrap) {
    btnFooterWordWrap.onclick = () => {
      toggleWordWrap();
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

  // Scroll sync: textarea scrolls gutter and highlights overlay
  memoTextarea.addEventListener('scroll', () => {
    if (state.showLineNumbers && editorGutter) {
      editorGutter.scrollTop = memoTextarea.scrollTop;
    }
    if (editorHighlights) {
      editorHighlights.scrollTop = memoTextarea.scrollTop;
      editorHighlights.scrollLeft = memoTextarea.scrollLeft;
    }
    if (colMode.active) {
      renderColumnSelection();
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
    renderTextHighlights();
    if (colMode && colMode.active && !colMode.isApplyingEdit) {
      renderColumnSelection();
    }

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

  // Column Selection: Alt + Mouse Click & Drag
  memoTextarea.addEventListener('mousedown', (e) => {
    if (e.altKey && e.button === 0) {
      e.preventDefault();
      memoTextarea.focus();
      const coords = getLineColFromMouse(e);
      colMode.active = true;
      colMode.isDragging = true;
      colMode.anchorLine = coords.line;
      colMode.anchorCol = coords.col;
      colMode.headLine = coords.line;
      colMode.headCol = coords.col;
      renderColumnSelection();
      updateColumnModeStatus();
    } else {
      if (colMode.active) {
        exitColumnMode();
      }
    }
  });

  let colDragRaf = null;
  let lastColDragEvent = null;

  window.addEventListener('mousemove', (e) => {
    if (!colMode.isDragging) return;
    lastColDragEvent = e;
    if (!colDragRaf) {
      colDragRaf = requestAnimationFrame(() => {
        colDragRaf = null;
        if (colMode.isDragging && lastColDragEvent) {
          const coords = getLineColFromMouse(lastColDragEvent);
          colMode.headLine = coords.line;
          colMode.headCol = coords.col;
          renderColumnSelection();
          updateColumnModeStatus();
        }
      });
    }
  });

  window.addEventListener('mouseup', () => {
    if (colMode.isDragging) {
      if (colDragRaf) {
        cancelAnimationFrame(colDragRaf);
        colDragRaf = null;
      }
      colMode.isDragging = false;
      if (colMode.anchorLine === colMode.headLine && colMode.anchorCol === colMode.headCol) {
        exitColumnMode();
      } else {
        memoTextarea.focus();
        setNativeCursorAt(colMode.headLine, colMode.headCol);
        renderColumnSelection();
        updateColumnModeStatus();
      }
    }
  });

  // Click & Double-Click to open link directly in textarea
  memoTextarea.addEventListener('click', (e) => {
    updateCursorPos();
    highlightActiveLine();
    renderTextHighlights();
  if (colMode && colMode.active) {
    renderColumnSelection();
  }
    if (e.metaKey || e.ctrlKey) {
      handleTextareaLinkClick();
    }
  });

  // Double-Click to toggle checklist todo checkbox: - [ ] <-> - [x]
  memoTextarea.addEventListener('dblclick', () => {
    const pos = memoTextarea.selectionStart;
    const val = memoTextarea.value;
    const lineStart = val.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = val.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = val.length;
    const line = val.substring(lineStart, lineEnd);

    let toggledLine = null;
    if (/^(\s*[-*+]|\s*\d+\.)\s*\[ \]/i.test(line)) {
      toggledLine = line.replace(/^(\s*[-*+]|\s*\d+\.)\s*\[ \]/i, '$1 [x]');
    } else if (/^(\s*[-*+]|\s*\d+\.)\s*\[x\]/i.test(line)) {
      toggledLine = line.replace(/^(\s*[-*+]|\s*\d+\.)\s*\[x\]/i, '$1 [ ]');
    }

    if (toggledLine !== null) {
      memoTextarea.focus();
      memoTextarea.setSelectionRange(lineStart, lineEnd);
      if (!document.execCommand('insertText', false, toggledLine)) {
        memoTextarea.value = val.substring(0, lineStart) + toggledLine + val.substring(lineEnd);
      }
      memoTextarea.setSelectionRange(pos, pos);
      memoTextarea.dispatchEvent(new Event('input'));
      return;
    }

    handleTextareaLinkClick();
    renderTextHighlights();
  if (colMode && colMode.active) {
    renderColumnSelection();
  }
  });

  // Keyboard handlers for Tab, Shift+Tab, and Column Selection mode
  memoTextarea.addEventListener('keydown', (e) => {
    // 1. Alt + Shift + Arrows: Notepad++ style column selection
    if (e.altKey && e.shiftKey) {
      const text = memoTextarea.value;
      const lines = text.split('\n');
      if (e.key === 'ArrowDown' || e.key === 'Down') {
        e.preventDefault();
        if (!colMode.active) {
          const cur = getLineAndColFromPos(text, memoTextarea.selectionStart);
          colMode.active = true;
          colMode.anchorLine = cur.line;
          colMode.anchorCol = cur.col;
          colMode.headLine = Math.min(lines.length - 1, cur.line + 1);
          colMode.headCol = cur.col;
        } else {
          colMode.headLine = Math.min(lines.length - 1, colMode.headLine + 1);
        }
        setNativeCursorAt(colMode.headLine, colMode.headCol);
        renderColumnSelection();
        updateColumnModeStatus();
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'Up') {
        e.preventDefault();
        if (!colMode.active) {
          const cur = getLineAndColFromPos(text, memoTextarea.selectionStart);
          colMode.active = true;
          colMode.anchorLine = cur.line;
          colMode.anchorCol = cur.col;
          colMode.headLine = Math.max(0, cur.line - 1);
          colMode.headCol = cur.col;
        } else {
          colMode.headLine = Math.max(0, colMode.headLine - 1);
        }
        setNativeCursorAt(colMode.headLine, colMode.headCol);
        renderColumnSelection();
        updateColumnModeStatus();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'Right') {
        e.preventDefault();
        if (colMode.active) {
          colMode.headCol++;
          setNativeCursorAt(colMode.headLine, colMode.headCol);
          renderColumnSelection();
          updateColumnModeStatus();
        }
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'Left') {
        e.preventDefault();
        if (colMode.active) {
          colMode.headCol = Math.max(0, colMode.headCol - 1);
          setNativeCursorAt(colMode.headLine, colMode.headCol);
          renderColumnSelection();
          updateColumnModeStatus();
        }
        return;
      }
    }

    // 2. Intercept keys when Column Mode is active
    if (colMode.active) {
      if (e.key === 'Escape') {
        e.preventDefault();
        exitColumnMode();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        handleColumnBackspace();
        return;
      }
      if (e.key === 'Delete') {
        e.preventDefault();
        handleColumnDelete();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        handleColumnInsert('  ');
        return;
      }
      // Arrow keys without Alt/Shift cancel column mode
      if (!e.altKey && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End')) {
        exitColumnMode();
        return;
      }
      // Copy selected block
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        const minLine = Math.min(colMode.anchorLine, colMode.headLine);
        const maxLine = Math.max(colMode.anchorLine, colMode.headLine);
        const minCol = Math.min(colMode.anchorCol, colMode.headCol);
        const maxCol = Math.max(colMode.anchorCol, colMode.headCol);
        if (minCol !== maxCol) {
          const lines = memoTextarea.value.split('\n');
          const copied = [];
          for (let i = minLine; i <= maxLine; i++) {
            const l = lines[i] || '';
            copied.push(l.slice(minCol, maxCol));
          }
          navigator.clipboard.writeText(copied.join('\n'));
          e.preventDefault();
          return;
        }
      }
    }

    // 3. Tab & Shift+Tab indentation support
    if (e.key === 'Tab') {
      e.preventDefault();
      const text = memoTextarea.value;
      const start = memoTextarea.selectionStart;
      const end = memoTextarea.selectionEnd;

      if (start === end) {
        if (!e.shiftKey) {
          // Single cursor: insert 2 spaces
          if (!document.execCommand('insertText', false, '  ')) {
            memoTextarea.value = text.substring(0, start) + '  ' + text.substring(end);
            memoTextarea.selectionStart = memoTextarea.selectionEnd = start + 2;
          }
        } else {
          // Shift+Tab: unindent current line
          const lineStart = text.lastIndexOf('\n', start - 1) + 1;
          if (text.substring(lineStart, lineStart + 2) === '  ') {
            memoTextarea.setSelectionRange(lineStart, lineStart + 2);
            document.execCommand('delete');
            const newPos = Math.max(lineStart, start - 2);
            memoTextarea.setSelectionRange(newPos, newPos);
          }
        }
      } else {
        // Multi-line selection: indent / unindent all intersecting lines
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
        let lineEnd = text.indexOf('\n', end);
        if (lineEnd === -1) lineEnd = text.length;

        const block = text.substring(lineStart, lineEnd);
        const lines = block.split('\n');
        let delta = 0;
        const newLines = lines.map((line) => {
          if (!e.shiftKey) {
            delta += 2;
            return '  ' + line;
          } else {
            if (line.startsWith('  ')) {
              delta -= 2;
              return line.substring(2);
            } else if (line.startsWith(' ') || line.startsWith('\t')) {
              delta -= 1;
              return line.substring(1);
            }
            return line;
          }
        });
        const newBlock = newLines.join('\n');
        memoTextarea.focus();
        memoTextarea.setSelectionRange(lineStart, lineEnd);
        if (!document.execCommand('insertText', false, newBlock)) {
          memoTextarea.value = text.substring(0, lineStart) + newBlock + text.substring(lineEnd);
        }
        memoTextarea.setSelectionRange(lineStart, Math.max(lineStart, end + delta));
      }
      memoTextarea.dispatchEvent(new Event('input'));
    }
  });

  // Intercept typed characters and IME in Column Mode
  memoTextarea.addEventListener('beforeinput', (e) => {
    if (colMode.active) {
      if (colMode.isApplyingEdit || e.isComposing) return;
      if (e.inputType === 'insertText' && e.data) {
        e.preventDefault();
        handleColumnInsert(e.data);
      } else if (e.inputType === 'deleteContentBackward') {
        e.preventDefault();
        handleColumnBackspace();
      } else if (e.inputType === 'deleteContentForward') {
        e.preventDefault();
        handleColumnDelete();
      } else if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
        e.preventDefault();
        exitColumnMode();
      }
    }
  });

  memoTextarea.addEventListener('compositionend', (e) => {
    if (colMode.active && e.data) {
      if (colMode.isApplyingEdit) return;
      // In textarea, the browser already inserted e.data at current cursor during composition.
      // Revert that single-cursor insertion so handleColumnInsert applies e.data across all lines cleanly.
      const selEnd = memoTextarea.selectionEnd;
      const text = memoTextarea.value;
      if (selEnd >= e.data.length && text.slice(selEnd - e.data.length, selEnd) === e.data) {
        memoTextarea.value = text.slice(0, selEnd - e.data.length) + text.slice(selEnd);
        memoTextarea.setSelectionRange(selEnd - e.data.length, selEnd - e.data.length);
      }
      handleColumnInsert(e.data);
    }
  });

  // Ctrl + Mouse Wheel Zoom
  memoTextarea.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn();
      } else if (e.deltaY > 0) {
        zoomOut();
      }
    }
  }, { passive: false });

  memoTextarea.addEventListener('mouseup', () => {
    updateCursorPos();
    highlightActiveLine();
    renderTextHighlights();
  if (colMode && colMode.active) {
    renderColumnSelection();
  }
  });

  memoTextarea.addEventListener('keyup', () => {
    updateCursorPos();
    highlightActiveLine();
    renderTextHighlights();
  if (colMode && colMode.active) {
    renderColumnSelection();
  }
  });

  memoTextarea.addEventListener('select', () => {
    highlightActiveLine();
    renderTextHighlights();
  if (colMode && colMode.active) {
    renderColumnSelection();
  }
  });

  // Smart paste: if clipboard contains a URL and text is selected in memoTextarea, convert to [selectedText](URL)
  memoTextarea.addEventListener('paste', (e) => {
    const start = memoTextarea.selectionStart;
    const end = memoTextarea.selectionEnd;
    if (start !== end) {
      const pasteText = (e.clipboardData || window.clipboardData).getData('text');
      const detected = detectUrl(pasteText);
      if (detected) {
        e.preventDefault();
        const selectedText = memoTextarea.value.substring(start, end);
        const mdLink = `[${selectedText}](${detected})`;
        if (!document.execCommand('insertText', false, mdLink)) {
          memoTextarea.value = memoTextarea.value.substring(0, start) + mdLink + memoTextarea.value.substring(end);
          memoTextarea.selectionStart = memoTextarea.selectionEnd = start + mdLink.length;
        }
        state.isDirty = true;
        updateSaveStatus('editing');
        updateStats();
        if (state.saveTimeout) clearTimeout(state.saveTimeout);
        state.saveTimeout = setTimeout(() => saveCurrentFile(false), 1000);
      }
    }
  });

  // Search Mode Tabs & Clear Button
  if (tabSearchFiles) {
    tabSearchFiles.addEventListener('click', () => setSearchMode('files'));
  }
  if (tabSearchContent) {
    tabSearchContent.addEventListener('click', () => setSearchMode('content'));
  }
  if (btnTreeSearchClear) {
    btnTreeSearchClear.addEventListener('click', clearTreeSearch);
  }

  // Search Filter & Content Search
  treeSearchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (btnTreeSearchClear) {
      btnTreeSearchClear.style.display = val ? 'flex' : 'none';
    }
    if (state.searchMode === 'files') {
      filterTree(val);
    } else {
      if (state.searchDebounceTimer) clearTimeout(state.searchDebounceTimer);
      state.searchDebounceTimer = setTimeout(() => {
        performContentSearch(val);
      }, 300);
    }
  });

  treeSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (state.searchMode === 'content') {
        if (state.searchDebounceTimer) clearTimeout(state.searchDebounceTimer);
        performContentSearch(treeSearchInput.value);
      }
    } else if (e.key === 'Escape') {
      clearTreeSearch();
      treeSearchInput.blur();
    }
  });

  // Modal actions
  btnModalCancel.onclick = closeModal;

  async function submitCustomModal() {
    if (!modalCallback) {
      closeModal();
      return;
    }
    const val = modalInput.value;
    if (modalValidationType) {
      const v = validateItemName(val, modalValidationType);
      if (!v.valid) {
        setModalError(`⚠️ ${v.error}`);
        modalInput.focus();
        return;
      }
    }
    try {
      btnModalConfirm.disabled = true;
      const result = await modalCallback(val);
      if (result !== false) {
        closeModal();
      }
    } catch (err) {
      setModalError(`❌ ${err.message}`);
      modalInput.focus();
    } finally {
      btnModalConfirm.disabled = false;
    }
  }

  btnModalConfirm.onclick = submitCustomModal;

  modalInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitCustomModal();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
  };

  modalInput.addEventListener('input', () => {
    if (!modalValidationType) {
      setModalError(null);
      return;
    }
    const val = modalInput.value;
    if (val.includes('/') || val.includes('\\')) {
      setModalError(`⚠️ ${modalValidationType} 이름에 슬래시(/)나 역슬래시(\\)는 사용할 수 없습니다.\n(운영체제 경로 구분 기호입니다. 대신 '-' 또는 '_' 등을 사용해주세요.)`);
      return;
    }
    const forbiddenMatch = val.match(/[:*?"<>|]/);
    if (forbiddenMatch) {
      setModalError(`⚠️ ${modalValidationType} 이름에 특수문자('${forbiddenMatch[0]}')는 사용할 수 없습니다.\n(사용 불가 특수문자: / \\ : * ? " < > |)`);
      return;
    }
    setModalError(null);
  });
}

// Detect [[link]], [label](target), or path under cursor on double-click or Cmd/Ctrl+Click
function handleTextareaLinkClick() {
  const pos = memoTextarea.selectionStart;
  const val = memoTextarea.value;
  const before = val.substring(0, pos);
  const after = val.substring(pos);

  // 1. [[target]] Wiki link
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

  // 2. Markdown link [title](target)
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

  // 3. Plain URL or file path/name under cursor
  const lineStart = before.lastIndexOf('\n') + 1;
  const nextNewline = after.indexOf('\n');
  const lineEnd = nextNewline === -1 ? val.length : pos + nextNewline;
  const lineText = val.substring(lineStart, lineEnd);
  const colInLine = pos - lineStart;

  const words = lineText.split(/\s+/);
  let charCount = 0;
  for (const w of words) {
    const wStart = lineText.indexOf(w, charCount);
    const wEnd = wStart + w.length;
    charCount = wEnd;
    if (colInLine >= wStart && colInLine <= wEnd) {
      const cleanW = w.replace(/^[<("'{\[]+|[>)"'}\],.]+$/g, '');
      if (/^https?:\/\//i.test(cleanW) || /^www\./i.test(cleanW) || /\.(xlsx?|csv|pdf|docx?|pptx?|hwp|hwpx|png|jpe?g|gif|webp|svg|zip)$/i.test(cleanW)) {
        jumpToMemo(cleanW);
        return;
      }
    }
  }
}

// Search Mode Switcher (Files vs Content)
function setSearchMode(mode) {
  state.searchMode = mode;
  if (tabSearchFiles && tabSearchContent) {
    if (mode === 'content') {
      tabSearchFiles.classList.remove('active');
      tabSearchFiles.setAttribute('aria-selected', 'false');
      tabSearchContent.classList.add('active');
      tabSearchContent.setAttribute('aria-selected', 'true');
      treeSearchInput.placeholder = '모든 메모에서 본문 검색... (Enter)';
      treeRoot.style.display = 'none';
      contentSearchResults.style.display = 'flex';

      const q = treeSearchInput.value.trim();
      if (q) {
        performContentSearch(q);
      } else {
        renderContentSearchInitial();
      }
    } else {
      tabSearchContent.classList.remove('active');
      tabSearchContent.setAttribute('aria-selected', 'false');
      tabSearchFiles.classList.add('active');
      tabSearchFiles.setAttribute('aria-selected', 'true');
      treeSearchInput.placeholder = '파일 및 폴더 검색...';
      contentSearchResults.style.display = 'none';
      treeRoot.style.display = '';

      filterTree(treeSearchInput.value);
    }
  }
}

// Clear Search Query
function clearTreeSearch() {
  treeSearchInput.value = '';
  if (btnTreeSearchClear) btnTreeSearchClear.style.display = 'none';
  if (state.searchMode === 'files') {
    filterTree('');
  } else {
    renderContentSearchInitial();
  }
  treeSearchInput.focus();
}

// Highlight matched substring in tree label safely
function highlightMatchText(text, query) {
  if (!query) return escapeHtml(text);
  const normText = (text || '').normalize('NFC');
  const lowerText = normText.toLowerCase();
  const lowerQuery = query.normalize('NFC').toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return escapeHtml(text);

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);
  return `${escapeHtml(before)}<mark class="tree-search-mark">${escapeHtml(match)}</mark>${escapeHtml(after)}`;
}

// Recursive Tree Filtering (Keeps ancestors visible & expanded when a child matches)
function filterTree(query) {
  const normalizedQuery = (query || '').trim().normalize('NFC').toLowerCase();
  const root = document.getElementById('treeRoot');
  if (!root) return;

  // Remove any previous no-results message
  const oldNoResults = document.getElementById('treeNoResultsMsg');
  if (oldNoResults) oldNoResults.remove();

  if (!normalizedQuery) {
    root.querySelectorAll('.tree-node-wrapper').forEach(wrapper => {
      wrapper.style.display = '';
      const label = wrapper.querySelector('.tree-item-label');
      if (label && label.dataset.rawName) {
        label.textContent = label.dataset.rawName;
      }
    });
    return;
  }

  function processNode(wrapper) {
    const row = wrapper.querySelector(':scope > .tree-item');
    const label = row ? row.querySelector('.tree-item-label') : null;
    const rawName = label ? (label.dataset.rawName || label.textContent || '') : '';
    const fullName = label ? (label.dataset.fullName || rawName) : rawName;
    const itemPath = row ? (row.getAttribute('data-path') || '') : '';

    const normRaw = rawName.normalize('NFC').toLowerCase();
    const normFull = fullName.normalize('NFC').toLowerCase();
    const normPath = itemPath.replace(/\\/g, '/').normalize('NFC').toLowerCase();

    const isSelfMatch = normRaw.includes(normalizedQuery) ||
                        normFull.includes(normalizedQuery) ||
                        normPath.includes(normalizedQuery);

    if (label) {
      if (isSelfMatch) {
        label.innerHTML = highlightMatchText(rawName, normalizedQuery);
      } else {
        label.textContent = rawName;
      }
    }

    const childrenContainer = wrapper.querySelector(':scope > .tree-children');
    let hasMatchingChild = false;
    if (childrenContainer) {
      const childWrappers = childrenContainer.querySelectorAll(':scope > .tree-node-wrapper');
      childWrappers.forEach(childWrap => {
        const childMatched = processNode(childWrap);
        if (childMatched) hasMatchingChild = true;
      });
    }

    const isVisible = isSelfMatch || hasMatchingChild;
    wrapper.style.display = isVisible ? '' : 'none';

    // Auto-expand folder if any child item matches so user can see it
    if (childrenContainer && hasMatchingChild) {
      childrenContainer.classList.remove('collapsed');
      const chevron = row ? row.querySelector('.tree-item-chevron') : null;
      if (chevron) chevron.classList.add('open');
      const icon = row ? row.querySelector('.tree-item-icon') : null;
      if (icon) icon.innerHTML = getFileIcon(rawName, true, true);
    }

    return isVisible;
  }

  let totalVisible = 0;
  const topWrappers = root.querySelectorAll(':scope > .tree-node-wrapper');
  topWrappers.forEach(topWrap => {
    if (processNode(topWrap)) {
      totalVisible++;
    }
  });

  if (totalVisible === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.id = 'treeNoResultsMsg';
    emptyMsg.className = 'tree-no-results';
    emptyMsg.innerHTML = `
      <div class="tree-no-results-icon">🔍</div>
      <div class="tree-no-results-text">'${escapeHtml(query)}' 일치하는 파일 없음</div>
    `;
    root.appendChild(emptyMsg);
  }
}

// Initial state guide for content search view
function renderContentSearchInitial() {
  if (!contentSearchResults) return;
  contentSearchResults.innerHTML = `
    <div class="content-search-empty">
      <div class="content-search-empty-icon">🔍</div>
      <div style="font-weight:600;margin-bottom:4px;">전체 본문 내용 검색</div>
      <div style="font-size: 11px; opacity: 0.8; line-height: 1.5;">
        검색어를 입력하면 작업 폴더 내 모든 텍스트 파일의 본문을 검색하여 일치하는 파일과 문장을 찾아줍니다.
      </div>
    </div>
  `;
}

// Highlight snippet matched text
function highlightSnippetMatch(snippet, query) {
  if (!query) return escapeHtml(snippet);
  const normSnip = (snippet || '').normalize('NFC');
  const lowerSnip = normSnip.toLowerCase();
  const lowerQ = query.normalize('NFC').toLowerCase();
  const idx = lowerSnip.indexOf(lowerQ);
  if (idx === -1) return escapeHtml(snippet);

  const before = snippet.slice(0, idx);
  const match = snippet.slice(idx, idx + query.length);
  const after = snippet.slice(idx + query.length);
  return `${escapeHtml(before)}<mark class="content-search-mark">${escapeHtml(match)}</mark>${escapeHtml(after)}`;
}

// Perform full-text search across all text files
async function performContentSearch(query) {
  const q = (query || '').trim();
  if (!q) {
    renderContentSearchInitial();
    return;
  }

  contentSearchResults.innerHTML = `
    <div class="content-search-loading">
      <div class="content-search-empty-icon">⏳</div>
      <div>'<strong>${escapeHtml(q)}</strong>' 본문 검색 중...</div>
    </div>
  `;

  try {
    const root = state.rootFolder || '';
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&path=${encodeURIComponent(root)}`);
    if (!res.ok) throw new Error('검색 중 서버 오류가 발생했습니다.');
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      contentSearchResults.innerHTML = `
        <div class="content-search-empty">
          <div class="content-search-empty-icon">📂</div>
          <div>'<strong>${escapeHtml(q)}</strong>' 일치하는 본문 내용이 없습니다.</div>
        </div>
      `;
      return;
    }

    let html = `
      <div class="content-search-summary">
        <span>총 <strong>${data.totalFiles}</strong>개 파일, <strong>${data.totalMatches}</strong>건 일치</span>
        ${data.truncated ? '<span style="color:var(--text-warning);font-size:10.5px;">(최대 한도 도달)</span>' : ''}
      </div>
    `;

    data.results.forEach((file, fIdx) => {
      html += `
        <div class="content-search-file-group" data-file-idx="${fIdx}">
          <div class="content-search-file-header" title="${escapeHtml(file.filePath)}">
            <div class="content-search-file-title">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span>${escapeHtml(file.relativePath || file.fileName)}</span>
            </div>
            <span class="content-search-file-count">${file.matchCount}건</span>
          </div>
          <div class="content-search-matches-list">
      `;

      file.matches.forEach((m) => {
        const snipHtml = highlightSnippetMatch(m.snippet, q);
        html += `
          <div class="content-search-match-item" data-file-path="${escapeHtml(file.filePath)}" data-line="${m.line}" data-col="${m.column}" data-match-len="${m.matchLength}">
            <span class="content-search-line-badge">${m.line}줄</span>
            <span class="content-search-snippet">${snipHtml}</span>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    contentSearchResults.innerHTML = html;

    // Toggle collapse on file header click
    contentSearchResults.querySelectorAll('.content-search-file-header').forEach(hdr => {
      hdr.addEventListener('click', () => {
        const list = hdr.nextElementSibling;
        if (list) {
          list.style.display = list.style.display === 'none' ? 'flex' : 'none';
        }
      });
    });

    // Match item click -> open file and jump to match
    contentSearchResults.querySelectorAll('.content-search-match-item').forEach(item => {
      item.addEventListener('click', async () => {
        contentSearchResults.querySelectorAll('.content-search-match-item.active').forEach(el => el.classList.remove('active'));
        item.classList.add('active');

        const filePath = item.getAttribute('data-file-path');
        const line = parseInt(item.getAttribute('data-line'), 10);
        const col = parseInt(item.getAttribute('data-col'), 10);
        const matchLen = parseInt(item.getAttribute('data-match-len'), 10) || q.length;

        const success = await loadFile(filePath);
        if (success !== false) {
          jumpToContentMatch(line, col, matchLen, q);
        }
      });
    });

  } catch (err) {
    contentSearchResults.innerHTML = `
      <div class="content-search-empty" style="color:var(--text-danger);">
        <div class="content-search-empty-icon">⚠️</div>
        <div>검색 실패: ${escapeHtml(err.message)}</div>
      </div>
    `;
  }
}

// Jump to line and select matching keyword in memo textarea
function jumpToContentMatch(lineNum, column, matchLen, query) {
  if (!memoTextarea) return;
  const text = memoTextarea.value;
  const lines = text.split('\n');
  if (lineNum < 1 || lineNum > lines.length) return;

  let lineStartOffset = 0;
  for (let i = 0; i < lineNum - 1; i++) {
    lineStartOffset += lines[i].length + 1;
  }

  const targetLine = lines[lineNum - 1];
  let colOffset = targetLine.toLowerCase().indexOf(query.toLowerCase());
  if (colOffset === -1) {
    colOffset = Math.max(0, (column || 1) - 1);
  }

  const selStart = lineStartOffset + colOffset;
  const selEnd = selStart + (matchLen || query.length || 1);

  memoTextarea.focus();
  memoTextarea.setSelectionRange(selStart, selEnd);

  // Scroll smoothly to line
  const cs = window.getComputedStyle(memoTextarea);
  const lh = Math.round(parseFloat(cs.lineHeight) || 24);
  const targetScrollTop = Math.max(0, (lineNum - 4) * lh);
  memoTextarea.scrollTop = targetScrollTop;

  renderLineNumbers();
  renderTextHighlights();
  if (colMode && colMode.active) {
    renderColumnSelection();
  }
}

/* ==========================================================
   COLUMN MODE / BLOCK SELECTION (Notepad++ / VS Code style)
   ========================================================== */
let colMode = {
  active: false,
  isDragging: false,
  anchorLine: 0,
  anchorCol: 0,
  headLine: 0,
  headCol: 0,
  isApplyingEdit: false
};
// Ultra-High-Performance Canvas Text Measurement for Column Mode (Zero DOM reflows)
let colMeasureCanvas = null;
let colMeasureCtx = null;
let colFontKey = '';
const colWidthCache = new Map();

function getColMeasureContext() {
  if (!colMeasureCtx) {
    colMeasureCanvas = document.createElement('canvas');
    colMeasureCtx = colMeasureCanvas.getContext('2d');
  }
  const cs = window.getComputedStyle(memoTextarea);
  const fontStr = `${cs.fontWeight || '400'} ${cs.fontSize || '14.5px'} ${cs.fontFamily || 'sans-serif'}`;
  if (colFontKey !== fontStr) {
    colFontKey = fontStr;
    colWidthCache.clear();
    colMeasureCtx.font = fontStr;
  }
  return { ctx: colMeasureCtx, cs };
}

function measureColTextWidth(text) {
  if (!text) return 0;
  const cached = colWidthCache.get(text);
  if (cached !== undefined) return cached;
  const { ctx } = getColMeasureContext();
  const w = ctx.measureText(text).width;
  if (colWidthCache.size > 2000) colWidthCache.clear();
  colWidthCache.set(text, w);
  return w;
}

function getLineAndColFromPos(text, pos) {
  const safePos = Math.max(0, Math.min(text.length, pos));
  const before = text.slice(0, safePos);
  const lines = before.split('\n');
  const line = lines.length - 1;
  const col = lines[line].length;
  return { line, col };
}

function getLineColFromMouse(e) {
  const rect = memoTextarea.getBoundingClientRect();
  const cs = window.getComputedStyle(memoTextarea);
  const paddingTop = parseFloat(cs.paddingTop) || 24;
  const paddingLeft = parseFloat(cs.paddingLeft) || 32;
  const lineHeight = parseFloat(cs.lineHeight) || 24;
  const scrollTop = memoTextarea.scrollTop;
  const scrollLeft = memoTextarea.scrollLeft;

  const text = memoTextarea.value;
  const lines = text.split('\n');

  // Line index
  const relY = e.clientY - rect.top + scrollTop - paddingTop;
  let line = Math.floor(relY / lineHeight);
  line = Math.max(0, Math.min(lines.length - 1, line));

  // Column index
  const relX = e.clientX - rect.left + scrollLeft - paddingLeft;
  if (relX <= 0) {
    return { line, col: 0 };
  }

  const lineText = lines[line] || '';
  let bestCol = 0;

  // Fast binary search using cached measureColTextWidth
  let low = 0;
  let high = lineText.length;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const w = measureColTextWidth(lineText.slice(0, mid));
    if (w < relX) {
      bestCol = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const w1 = measureColTextWidth(lineText.slice(0, bestCol));
  const w2 = measureColTextWidth(lineText.slice(0, Math.min(lineText.length, bestCol + 1)));
  if (Math.abs(relX - w2) < Math.abs(relX - w1)) {
    bestCol = Math.min(lineText.length, bestCol + 1);
  }

  const endWidth = measureColTextWidth(lineText);
  if (relX > endWidth) {
    const spaceWidth = Math.max(6, measureColTextWidth(' '));
    const extra = Math.round((relX - endWidth) / spaceWidth);
    bestCol = lineText.length + extra;
  }

  return { line, col: Math.max(0, bestCol) };
}

function exitColumnMode() {
  colMode.active = false;
  colMode.isDragging = false;
  colMode.isApplyingEdit = false;
  if (editorColumnOverlay) {
    editorColumnOverlay.innerHTML = '';
  }
  updateColumnModeStatus();
}

function updateColumnModeStatus() {
  if (!columnModeStatus || !columnModeSep) return;
  if (!colMode.active) {
    columnModeStatus.style.display = 'none';
    columnModeSep.style.display = 'none';
    return;
  }
  const minLine = Math.min(colMode.anchorLine, colMode.headLine);
  const maxLine = Math.max(colMode.anchorLine, colMode.headLine);
  const lineCount = maxLine - minLine + 1;
  const minCol = Math.min(colMode.anchorCol, colMode.headCol);
  const maxCol = Math.max(colMode.anchorCol, colMode.headCol);

  columnModeStatus.style.display = 'inline-flex';
  columnModeSep.style.display = 'inline';
  if (minCol === maxCol) {
    columnModeStatus.textContent = `열 모드: ${lineCount}줄 (열 ${minCol + 1})`;
  } else {
    columnModeStatus.textContent = `열 모드: ${lineCount}줄 × ${Math.abs(maxCol - minCol)}자`;
  }
}

function renderColumnSelection() {
  if (!editorColumnOverlay) return;
  if (!colMode.active) {
    editorColumnOverlay.innerHTML = '';
    return;
  }

  const text = memoTextarea.value;
  const lines = text.split('\n');
  const minLine = Math.min(colMode.anchorLine, colMode.headLine);
  const maxLine = Math.max(colMode.anchorLine, colMode.headLine);
  const minCol = Math.min(colMode.anchorCol, colMode.headCol);
  const maxCol = Math.max(colMode.anchorCol, colMode.headCol);

  const cs = window.getComputedStyle(memoTextarea);
  const paddingTop = parseFloat(cs.paddingTop) || 24;
  const paddingLeft = parseFloat(cs.paddingLeft) || 32;
  const lineHeight = parseFloat(cs.lineHeight) || 24;
  const scrollTop = memoTextarea.scrollTop;
  const scrollLeft = memoTextarea.scrollLeft;
  const clientHeight = memoTextarea.clientHeight || 600;

  // Viewport optimization: only render lines currently visible in viewport
  const firstVisibleLine = Math.max(minLine, Math.floor((scrollTop - paddingTop) / lineHeight) - 1);
  const lastVisibleLine = Math.min(maxLine, Math.ceil((scrollTop - paddingTop + clientHeight) / lineHeight) + 1);

  const charCellWidth = Math.max(8, measureColTextWidth('M') * 0.7);

  let html = '';

  for (let L = firstVisibleLine; L <= lastVisibleLine; L++) {
    const y = paddingTop + L * lineHeight - scrollTop;
    const line = lines[L] || '';

    if (minCol === maxCol) {
      // Single Column Cursor: Show both a bright caret AND a dashed column highlight track!
      const textBefore = (line.length >= minCol) ? line.slice(0, minCol) : line + ' '.repeat(minCol - line.length);
      const textWidth = measureColTextWidth(textBefore);
      const x = paddingLeft + textWidth - scrollLeft;

      html += `<div class="column-cell-highlight" style="top:${y}px;left:${x}px;width:${charCellWidth}px;height:${lineHeight}px;"></div>`;
      html += `<div class="column-caret" style="top:${y}px;left:${x - 1}px;height:${lineHeight}px;"></div>`;
    } else {
      // Rectangular Block Selection
      const textBefore1 = (line.length >= minCol) ? line.slice(0, minCol) : line + ' '.repeat(minCol - line.length);
      const textBefore2 = (line.length >= maxCol) ? line.slice(0, maxCol) : line + ' '.repeat(maxCol - line.length);
      const x1 = paddingLeft + measureColTextWidth(textBefore1) - scrollLeft;
      const x2 = paddingLeft + measureColTextWidth(textBefore2) - scrollLeft;
      const boxX = Math.min(x1, x2);
      const boxW = Math.max(4, Math.abs(x2 - x1));
      html += `<div class="column-block-sel" style="top:${y}px;left:${boxX}px;width:${boxW}px;height:${lineHeight}px;"></div>`;
    }
  }

  // Also render head caret if in block mode
  if (minCol !== maxCol) {
    if (colMode.headLine >= firstVisibleLine && colMode.headLine <= lastVisibleLine) {
      const headY = paddingTop + colMode.headLine * lineHeight - scrollTop;
      const headLineText = lines[colMode.headLine] || '';
      const textBefore = (headLineText.length >= colMode.headCol) ? headLineText.slice(0, colMode.headCol) : headLineText + ' '.repeat(colMode.headCol - headLineText.length);
      const headX = paddingLeft + measureColTextWidth(textBefore) - scrollLeft;
      html += `<div class="column-caret" style="top:${headY}px;left:${headX - 1}px;height:${lineHeight}px;"></div>`;
    }
  }

  editorColumnOverlay.innerHTML = html;
}

function applyColumnInsert(line, minCol, maxCol, insertText) {
  let paddedLine = line;
  if (paddedLine.length < minCol) {
    paddedLine = paddedLine + ' '.repeat(minCol - paddedLine.length);
  }
  const before = paddedLine.slice(0, minCol);
  const after = paddedLine.slice(Math.max(minCol, maxCol));
  return before + insertText + after;
}

function applyColumnBackspace(line, minCol, maxCol) {
  let paddedLine = line;
  if (minCol !== maxCol) {
    if (paddedLine.length < minCol) return paddedLine;
    const before = paddedLine.slice(0, minCol);
    const after = paddedLine.slice(Math.max(minCol, maxCol));
    return before + after;
  } else {
    if (minCol <= 0) return paddedLine;
    if (paddedLine.length < minCol) {
      paddedLine = paddedLine + ' '.repeat(minCol - paddedLine.length);
    }
    const before = paddedLine.slice(0, minCol - 1);
    const after = paddedLine.slice(minCol);
    return before + after;
  }
}

function applyColumnDelete(line, minCol, maxCol) {
  let paddedLine = line;
  if (minCol !== maxCol) {
    if (paddedLine.length < minCol) return paddedLine;
    const before = paddedLine.slice(0, minCol);
    const after = paddedLine.slice(Math.max(minCol, maxCol));
    return before + after;
  } else {
    if (paddedLine.length <= minCol) return paddedLine;
    const before = paddedLine.slice(0, minCol);
    const after = paddedLine.slice(minCol + 1);
    return before + after;
  }
}

function setNativeCursorAt(lineNum, colNum) {
  const text = memoTextarea.value;
  const lines = text.split('\n');
  if (lineNum < 0 || lineNum >= lines.length) return;
  let offset = 0;
  for (let i = 0; i < lineNum; i++) {
    offset += lines[i].length + 1;
  }
  const col = Math.min(lines[lineNum].length, colNum);
  offset += col;
  memoTextarea.setSelectionRange(offset, offset);
}

function handleColumnInsert(insertStr) {
  if (colMode.isApplyingEdit) return;
  colMode.isApplyingEdit = true;
  try {
    const minLine = Math.min(colMode.anchorLine, colMode.headLine);
    const maxLine = Math.max(colMode.anchorLine, colMode.headLine);
    const minCol = Math.min(colMode.anchorCol, colMode.headCol);
    const maxCol = Math.max(colMode.anchorCol, colMode.headCol);

    const text = memoTextarea.value;
    const lines = text.split('\n');

    let startOffset = 0;
    for (let i = 0; i < minLine; i++) {
      startOffset += lines[i].length + 1;
    }
    let endOffset = startOffset;
    for (let i = minLine; i <= maxLine; i++) {
      endOffset += lines[i].length + (i < lines.length - 1 ? 1 : 0);
    }
    if (maxLine === lines.length - 1) {
      endOffset = text.length;
    }

    const newLines = [];
    for (let i = minLine; i <= maxLine; i++) {
      const line = lines[i] || '';
      const newLine = applyColumnInsert(line, minCol, maxCol, insertStr);
      newLines.push(newLine);
    }
    const newBlock = newLines.join('\n');

    memoTextarea.focus();
    memoTextarea.setSelectionRange(startOffset, endOffset);
    if (!document.execCommand('insertText', false, newBlock)) {
      memoTextarea.value = text.slice(0, startOffset) + newBlock + text.slice(endOffset);
    }

    const newCol = minCol + insertStr.length;
    colMode.anchorCol = newCol;
    colMode.headCol = newCol;

    setNativeCursorAt(colMode.headLine, newCol);

    state.isDirty = true;
    updateSaveStatus('editing');
    updateStats();
    if (state.saveTimeout) clearTimeout(state.saveTimeout);
    state.saveTimeout = setTimeout(() => saveCurrentFile(false), 1000);

    renderColumnSelection();
    updateColumnModeStatus();
  } finally {
    colMode.isApplyingEdit = false;
  }
}

function handleColumnBackspace() {
  if (colMode.isApplyingEdit) return;
  colMode.isApplyingEdit = true;
  try {
    const minLine = Math.min(colMode.anchorLine, colMode.headLine);
    const maxLine = Math.max(colMode.anchorLine, colMode.headLine);
    const minCol = Math.min(colMode.anchorCol, colMode.headCol);
    const maxCol = Math.max(colMode.anchorCol, colMode.headCol);

    if (minCol === maxCol && minCol <= 0) return;

    const text = memoTextarea.value;
    const lines = text.split('\n');

    let startOffset = 0;
    for (let i = 0; i < minLine; i++) {
      startOffset += lines[i].length + 1;
    }
    let endOffset = startOffset;
    for (let i = minLine; i <= maxLine; i++) {
      endOffset += lines[i].length + (i < lines.length - 1 ? 1 : 0);
    }
    if (maxLine === lines.length - 1) {
      endOffset = text.length;
    }

    const newLines = [];
    for (let i = minLine; i <= maxLine; i++) {
      const line = lines[i] || '';
      const newLine = applyColumnBackspace(line, minCol, maxCol);
      newLines.push(newLine);
    }
    const newBlock = newLines.join('\n');

    memoTextarea.focus();
    memoTextarea.setSelectionRange(startOffset, endOffset);
    if (!document.execCommand('insertText', false, newBlock)) {
      memoTextarea.value = text.slice(0, startOffset) + newBlock + text.slice(endOffset);
    }

    const newCol = (minCol !== maxCol) ? minCol : Math.max(0, minCol - 1);
    colMode.anchorCol = newCol;
    colMode.headCol = newCol;

    setNativeCursorAt(colMode.headLine, newCol);

    state.isDirty = true;
    updateSaveStatus('editing');
    updateStats();
    if (state.saveTimeout) clearTimeout(state.saveTimeout);
    state.saveTimeout = setTimeout(() => saveCurrentFile(false), 1000);

    renderColumnSelection();
    updateColumnModeStatus();
  } finally {
    colMode.isApplyingEdit = false;
  }
}

function handleColumnDelete() {
  if (colMode.isApplyingEdit) return;
  colMode.isApplyingEdit = true;
  try {
    const minLine = Math.min(colMode.anchorLine, colMode.headLine);
    const maxLine = Math.max(colMode.anchorLine, colMode.headLine);
    const minCol = Math.min(colMode.anchorCol, colMode.headCol);
    const maxCol = Math.max(colMode.anchorCol, colMode.headCol);

    const text = memoTextarea.value;
    const lines = text.split('\n');

    let startOffset = 0;
    for (let i = 0; i < minLine; i++) {
      startOffset += lines[i].length + 1;
    }
    let endOffset = startOffset;
    for (let i = minLine; i <= maxLine; i++) {
      endOffset += lines[i].length + (i < lines.length - 1 ? 1 : 0);
    }
    if (maxLine === lines.length - 1) {
      endOffset = text.length;
    }

    const newLines = [];
    for (let i = minLine; i <= maxLine; i++) {
      const line = lines[i] || '';
      const newLine = applyColumnDelete(line, minCol, maxCol);
      newLines.push(newLine);
    }
    const newBlock = newLines.join('\n');

    memoTextarea.focus();
    memoTextarea.setSelectionRange(startOffset, endOffset);
    if (!document.execCommand('insertText', false, newBlock)) {
      memoTextarea.value = text.slice(0, startOffset) + newBlock + text.slice(endOffset);
    }

    colMode.anchorCol = minCol;
    colMode.headCol = minCol;

    setNativeCursorAt(colMode.headLine, minCol);

    state.isDirty = true;
    updateSaveStatus('editing');
    updateStats();
    if (state.saveTimeout) clearTimeout(state.saveTimeout);
    state.saveTimeout = setTimeout(() => saveCurrentFile(false), 1000);

    renderColumnSelection();
    updateColumnModeStatus();
  } finally {
    colMode.isApplyingEdit = false;
  }
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

// Move current line(s) Up or Down
function moveCurrentLines(direction) {
  if (document.activeElement !== memoTextarea && !memoTextarea.matches(':focus')) {
    return false;
  }
  if (!state.currentFilePath || memoTextarea.disabled || memoTextarea.readOnly) {
    return false;
  }
  const text = memoTextarea.value;
  if (!text) return false;

  const start = memoTextarea.selectionStart;
  const end = memoTextarea.selectionEnd;

  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const effectiveEnd = (end > start && text[end - 1] === '\n') ? end - 1 : end;
  let lineEnd = text.indexOf('\n', effectiveEnd);
  if (lineEnd === -1) lineEnd = text.length;

  const startOffset = start - lineStart;
  const endOffset = end - lineStart;
  const selectedBlock = text.substring(lineStart, lineEnd);

  if (direction === -1) {
    // Move UP
    if (lineStart === 0) return true; // Top boundary
    const prevLineStart = text.lastIndexOf('\n', lineStart - 2) + 1;
    const prevLineEnd = lineStart - 1;
    const prevLine = text.substring(prevLineStart, prevLineEnd);

    const swapped = selectedBlock + '\n' + prevLine;
    memoTextarea.focus();
    memoTextarea.setSelectionRange(prevLineStart, lineEnd);
    if (!document.execCommand('insertText', false, swapped)) {
      memoTextarea.value = text.substring(0, prevLineStart) + swapped + text.substring(lineEnd);
    }
    const newStart = prevLineStart + startOffset;
    const newEnd = prevLineStart + endOffset;
    memoTextarea.setSelectionRange(newStart, newEnd);
    memoTextarea.dispatchEvent(new Event('input'));
    return true;
  } else if (direction === 1) {
    // Move DOWN
    if (lineEnd === text.length) return true; // Bottom boundary
    const nextLineStart = lineEnd + 1;
    let nextLineEnd = text.indexOf('\n', nextLineStart);
    if (nextLineEnd === -1) nextLineEnd = text.length;
    const nextLine = text.substring(nextLineStart, nextLineEnd);

    const swapped = nextLine + '\n' + selectedBlock;
    memoTextarea.focus();
    memoTextarea.setSelectionRange(lineStart, nextLineEnd);
    if (!document.execCommand('insertText', false, swapped)) {
      memoTextarea.value = text.substring(0, lineStart) + swapped + text.substring(nextLineEnd);
    }
    const newBlockStart = lineStart + nextLine.length + 1;
    const newStart = newBlockStart + startOffset;
    const newEnd = newBlockStart + endOffset;
    memoTextarea.setSelectionRange(newStart, newEnd);
    memoTextarea.dispatchEvent(new Event('input'));
    return true;
  }

  return false;
}

// Delete current line(s)
function deleteCurrentLines() {
  if (document.activeElement !== memoTextarea && !memoTextarea.matches(':focus')) {
    if (!state.currentFilePath || memoTextarea.disabled || memoTextarea.readOnly) return false;
    memoTextarea.focus();
  }
  if (!state.currentFilePath || memoTextarea.disabled || memoTextarea.readOnly) return false;

  const text = memoTextarea.value;
  if (!text && text !== '') return false;
  if (text.length === 0) return false;

  const start = memoTextarea.selectionStart;
  const end = memoTextarea.selectionEnd;

  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const effectiveEnd = (end > start && text[end - 1] === '\n') ? end - 1 : end;
  let lineEnd = text.indexOf('\n', effectiveEnd);

  let deleteFrom, deleteTo;
  if (lineEnd !== -1) {
    deleteFrom = lineStart;
    deleteTo = lineEnd + 1;
  } else {
    if (lineStart > 0) {
      deleteFrom = lineStart - 1;
      deleteTo = text.length;
    } else {
      deleteFrom = 0;
      deleteTo = text.length;
    }
  }

  memoTextarea.focus();
  memoTextarea.setSelectionRange(deleteFrom, deleteTo);
  if (!document.execCommand('delete', false, null) && !document.execCommand('insertText', false, '')) {
    memoTextarea.value = text.substring(0, deleteFrom) + text.substring(deleteTo);
  }
  const newCursor = Math.min(lineStart, memoTextarea.value.length);
  memoTextarea.setSelectionRange(newCursor, newCursor);
  memoTextarea.dispatchEvent(new Event('input'));
  return true;
}

// Keyboard Shortcuts
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const mod = isMac ? e.metaKey : e.ctrlKey;

    // Move current line(s) Up: Ctrl+Alt+ArrowUp (Win) or Option+ArrowUp (Mac) / Alt+ArrowUp
    if (!e.shiftKey && e.altKey && (e.key === 'ArrowUp' || e.key === 'Up')) {
      if (moveCurrentLines(-1)) {
        e.preventDefault();
        return;
      }
    }
    // Move current line(s) Down: Ctrl+Alt+ArrowDown (Win) or Option+ArrowDown (Mac) / Alt+ArrowDown
    if (!e.shiftKey && e.altKey && (e.key === 'ArrowDown' || e.key === 'Down')) {
      if (moveCurrentLines(1)) {
        e.preventDefault();
        return;
      }
    }

    // F1: Open Help Guide
    if (e.key === 'F1') {
      e.preventDefault();
      openHelpModal();
      return;
    }

    // Escape: Close modals / panels
    if (e.key === 'Escape') {
      if (document.activeElement === treeSearchInput) {
        if (treeSearchInput.value) {
          clearTreeSearch();
        } else {
          treeSearchInput.blur();
        }
        return;
      }
      if (frState.isOpen) {
        closeFindPanel();
        return;
      }
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

    // Cmd/Ctrl + Shift + F: Search all files content
    if (mod && e.shiftKey && (e.key === 'f' || e.key === 'F' || e.code === 'KeyF')) {
      e.preventDefault();
      setSearchMode('content');
      if (treeSearchInput) {
        treeSearchInput.focus();
        treeSearchInput.select();
      }
      return;
    }

    // Cmd/Ctrl + F: Find in current memo
    if (mod && !e.shiftKey && (e.key === 'f' || e.key === 'F' || e.code === 'KeyF')) {
      e.preventDefault();
      openFindPanel(false);
      return;
    }
    // Cmd/Ctrl + H: Find & Replace
    if (mod && (e.key === 'h' || e.key === 'H' || e.code === 'KeyH')) {
      e.preventDefault();
      openFindPanel(true);
      return;
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
    // Alt + Z (without Ctrl/Cmd): Toggle Word Wrap
    if (e.altKey && !mod && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ')) {
      e.preventDefault();
      toggleWordWrap();
      return;
    }
    // Cmd/Ctrl + D or Cmd/Ctrl + Shift + K: Delete Current Line(s)
    if ((mod && !e.shiftKey && (e.key === 'd' || e.key === 'D' || e.code === 'KeyD')) ||
        (mod && e.shiftKey && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK'))) {
      if (deleteCurrentLines()) {
        e.preventDefault();
        return;
      }
    }

    // Cmd/Ctrl + K (without Shift): Insert Memo Link
    if (mod && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
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
    // Cmd/Ctrl + P: Print Memo / Export to PDF
    if (mod && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      printCurrentMemo();
      return;
    }

    // Cmd/Ctrl + Plus / Equal: Zoom In
    if (mod && (e.key === '+' || e.key === '=')) {
      e.preventDefault();
      zoomIn();
      return;
    }

    // Cmd/Ctrl + Minus: Zoom Out
    if (mod && (e.key === '-' || e.key === '_')) {
      e.preventDefault();
      zoomOut();
      return;
    }

    // Cmd/Ctrl + 0: Zoom Reset
    if (mod && e.key === '0') {
      e.preventDefault();
      zoomReset();
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

// Header Dropdown Menus (Edit & Tools)
function setupDropdownMenus() {
  const editWrapper = document.getElementById('editMenuWrapper');
  const btnEditMenu = document.getElementById('btnEditMenu');
  const editPanel = document.getElementById('editMenuPanel');

  const toolsWrapper = document.getElementById('toolsMenuWrapper');
  const btnToolsMenu = document.getElementById('btnToolsMenu');
  const toolsPanel = document.getElementById('toolsMenuPanel');

  function closeAllMenus() {
    if (editPanel) editPanel.classList.add('hidden');
    if (editWrapper) editWrapper.classList.remove('open');
    if (toolsPanel) toolsPanel.classList.add('hidden');
    if (toolsWrapper) toolsWrapper.classList.remove('open');
  }

  function toggleMenu(wrapper, panel, otherWrapper, otherPanel) {
    const isHidden = panel.classList.contains('hidden');
    if (otherPanel) otherPanel.classList.add('hidden');
    if (otherWrapper) otherWrapper.classList.remove('open');
    if (isHidden) {
      panel.classList.remove('hidden');
      wrapper.classList.add('open');
    } else {
      panel.classList.add('hidden');
      wrapper.classList.remove('open');
    }
  }

  if (btnEditMenu && editPanel && editWrapper) {
    btnEditMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu(editWrapper, editPanel, toolsWrapper, toolsPanel);
    });
  }

  if (btnToolsMenu && toolsPanel && toolsWrapper) {
    btnToolsMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu(toolsWrapper, toolsPanel, editWrapper, editPanel);
    });
  }

  window.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-dropdown-wrapper')) {
      closeAllMenus();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllMenus();
    }
  });

  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllMenus();
      const action = item.getAttribute('data-action');
      handleMenuAction(action);
    });
  });

  updateMenuShortcutsDisplay();
}

function updateMenuShortcutsDisplay() {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const mod = isMac ? 'Cmd' : 'Ctrl';
  const alt = isMac ? 'Option' : 'Alt';
  document.querySelectorAll('.menu-item-shortcut').forEach(el => {
    let text = el.textContent;
    text = text.replace(/Ctrl/g, mod).replace(/Alt/g, alt);
    el.textContent = text;
  });
}

function handleMenuAction(action) {
  switch (action) {
    case 'undo':
      memoTextarea.focus();
      document.execCommand('undo');
      break;
    case 'redo':
      memoTextarea.focus();
      document.execCommand('redo');
      break;
    case 'move-up':
      moveCurrentLines(-1);
      break;
    case 'move-down':
      moveCurrentLines(1);
      break;
    case 'delete-line':
      deleteCurrentLines();
      break;
    case 'toggle-column-mode': {
      const text = memoTextarea.value;
      const lines = text.split('\n');
      const cur = getLineAndColFromPos(text, memoTextarea.selectionStart);
      colMode.active = true;
      colMode.anchorLine = cur.line;
      colMode.anchorCol = cur.col;
      colMode.headLine = Math.min(lines.length - 1, cur.line + 1);
      colMode.headCol = cur.col;
      memoTextarea.focus();
      setNativeCursorAt(colMode.headLine, colMode.headCol);
      renderColumnSelection();
      updateColumnModeStatus();
      break;
    }
    case 'find':
      openFindPanel(false);
      break;
    case 'replace':
      openFindPanel(true);
      break;
    case 'search-all-content':
      setSearchMode('content');
      if (treeSearchInput) {
        treeSearchInput.focus();
        treeSearchInput.select();
      }
      break;
    case 'select-all':
      memoTextarea.focus();
      memoTextarea.select();
      break;
    case 'insert-link':
      if (!btnInsertLink.disabled) openLinkSelectorModal();
      break;
    case 'toggle-line-numbers':
      toggleLineNumbers();
      break;
    case 'toggle-word-wrap':
      toggleWordWrap();
      break;
    case 'zoom-in':
      zoomIn();
      break;
    case 'zoom-out':
      zoomOut();
      break;
    case 'zoom-reset':
      zoomReset();
      break;
    case 'print-memo':
      printCurrentMemo();
      break;
    case 'toggle-file-filter':
      state.showAllFiles = !state.showAllFiles;
      localStorage.setItem('memo_show_all_files', state.showAllFiles ? 'true' : 'false');
      updateFileFilterBtn();
      loadTree();
      break;
    case 'change-folder':
      handleChangeFolder();
      break;
    case 'toggle-theme':
      toggleTheme();
      break;
    case 'show-help':
      openHelpModal();
      break;
  }
}

// Heartbeat & Auto-shutdown client
function startHeartbeat() {
  function ping() {
    fetch('/api/heartbeat', { method: 'POST' }).catch(() => {});
  }
  ping();
  setInterval(ping, 3000);

  // Ping immediately when user returns to window, switches tab, or wakes from sleep
  window.addEventListener('focus', ping);
  window.addEventListener('pageshow', ping);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') ping();
  });

  // Also ping on user interaction (throttled to at most once per 2 seconds)
  let lastActivityPing = 0;
  const onActivity = () => {
    const now = Date.now();
    if (now - lastActivityPing > 2000) {
      lastActivityPing = now;
      ping();
    }
  };
  window.addEventListener('pointerdown', onActivity, { passive: true });
  window.addEventListener('keydown', onActivity, { passive: true });

  // Send shutdown beacon when window closes
  const sendShutdown = () => {
    try {
      const payload = new Blob(['1'], { type: 'text/plain' });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/shutdown', payload);
      }
      fetch('/api/shutdown', { method: 'POST', keepalive: true, body: '1' }).catch(() => {});
    } catch (e) {}
  };

  window.addEventListener('beforeunload', sendShutdown);
  window.addEventListener('pagehide', sendShutdown);
  window.addEventListener('unload', sendShutdown);
}

// Launch
window.addEventListener('DOMContentLoaded', init);
