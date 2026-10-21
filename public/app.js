/**
 * Desktop Memo Frontend Client
 */
let state = {
  rootFolder: '',
  currentFilePath: null,
  treeData: [],
  selectedNodePath: null,
  saveTimeout: null,
  maxSaveTimeout: null,
  isDirty: false
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

const fileIcon = document.getElementById('fileIcon');
const fileTitle = document.getElementById('fileTitle');
const filePathDisplay = document.getElementById('filePathDisplay');
const saveStatusBadge = document.getElementById('saveStatusBadge');
const btnManualSave = document.getElementById('btnManualSave');
const btnInsertLink = document.getElementById('btnInsertLink');
const emptyState = document.getElementById('emptyState');
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

// Helper to hide file extension in UI
function getDisplayName(name, isDir) {
  if (isDir || !name) return name || '';
  return name.replace(/\.(txt|md|markdown)$/i, '');
}

// Init Application
async function init() {
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
}

function createTreeNode(item) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tree-node-wrapper';

  const row = document.createElement('div');
  row.className = 'tree-item';
  if (state.currentFilePath === item.path) {
    row.classList.add('active');
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
  const label = document.createElement('span');
  label.className = 'tree-item-label';
  label.textContent = getDisplayName(item.name, item.isDir);
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
async function loadFile(filePath) {
  if (!filePath) return;

  // Don't reload if already open and clean
  if (state.currentFilePath === filePath && !state.isDirty) {
    return;
  }

  // Auto-save existing file if dirty before loading new one
  if (state.isDirty && state.currentFilePath) {
    try {
      await saveCurrentFile(false);
    } catch (e) {
      console.warn('Auto-save prior to load failed:', e);
    }
  }

  // 1. Fetch file content from server
  let fileData = null;
  try {
    const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || '파일을 읽을 수 없습니다.');
    }
    fileData = await res.json();
  } catch (err) {
    console.error('Error fetching file:', err);
    alert('파일을 불러오지 못했습니다: ' + err.message);
    return;
  }

  // 2. Safely update UI with loaded content
  try {
    state.currentFilePath = filePath;
    state.isDirty = false;

    // Update Header (hide extension)
    const fileName = filePath.split(/[\\/]/).pop();
    fileIcon.textContent = '📝';
    fileTitle.textContent = getDisplayName(fileName, false);
    const relPath = filePath.replace(state.rootFolder, '').replace(/^[\\/]/, '') || fileName;
    filePathDisplay.textContent = getDisplayName(relPath, false);

    // Show Editor
    emptyState.classList.add('hidden');
    memoTextarea.classList.remove('hidden');

    memoTextarea.value = fileData.content || '';
    btnManualSave.disabled = false;
    btnInsertLink.disabled = false;

    updateSaveStatus('saved');
    updateStats();
    updateCursorPos();

    // Re-highlight active tree node
    document.querySelectorAll('.tree-item').forEach(el => {
      const label = el.querySelector('.tree-item-label');
      if (label && label.textContent === fileName) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Mark config
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastOpenedFile: filePath })
    }).catch(() => {});
  } catch (uiErr) {
    console.error('UI update error after file load:', uiErr);
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
  updateSaveStatus('saving');

  try {
    const res = await fetch('/api/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: state.currentFilePath, content })
    });

    if (!res.ok) throw new Error('저장 실패');
    state.isDirty = false;
    const nowTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    updateSaveStatus('saved', nowTime);
    lastSavedTime.textContent = `마지막 저장: ${nowTime}`;
  } catch (err) {
    console.error('Save error:', err);
    updateSaveStatus('error');
    if (showNotification) alert('저장 실패: ' + err.message);
  }
}

function updateSaveStatus(status, detail = '') {
  saveStatusBadge.className = 'status-badge ' + status;
  if (status === 'saved') {
    const timeStr = detail || new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    saveStatusBadge.textContent = `💾 저장됨 (${timeStr})`;
  } else if (status === 'saving') {
    saveStatusBadge.textContent = '⏳ 저장 중...';
  } else if (status === 'editing') {
    saveStatusBadge.textContent = '✏️ 작성 중...';
  } else if (status === 'error') {
    saveStatusBadge.textContent = '❌ 저장 실패';
  }
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
  const cleanTarget = target.trim().replace(/^\[\[/, '').replace(/\]\]$/, '');
  const targetLower = cleanTarget.toLowerCase();
  const targetWithoutExt = targetLower.replace(/\.(md|txt)$/, '');

  // 1. Exact path match
  const matchPath = allFiles.find(f => f.path.toLowerCase().endsWith(targetLower));
  if (matchPath) return matchPath.path;

  // 2. Exact file name match (e.g. '회의록.md')
  const matchName = allFiles.find(f => f.name.toLowerCase() === targetLower);
  if (matchName) return matchName.path;

  // 3. Name without extension match (e.g. '회의록' -> '회의록.md')
  const matchNoExt = allFiles.find(f => f.name.toLowerCase().replace(/\.(md|txt)$/, '') === targetWithoutExt);
  if (matchNoExt) return matchNoExt.path;

  return null;
}

// Jump to linked memo
async function jumpToMemo(target) {
  const cleanTarget = target.trim();
  const matchedPath = findMemoPath(cleanTarget);

  if (matchedPath) {
    await loadFile(matchedPath);
  } else {
    // Prompt to create target memo if it doesn't exist
    const defaultName = cleanTarget.endsWith('.txt') || cleanTarget.endsWith('.md') ? cleanTarget : `${cleanTarget}.txt`;
    if (confirm(`'${cleanTarget}' 메모를 찾을 수 없습니다.\n새로운 메모로 바로 생성하시겠습니까?`)) {
      const activeDir = getActiveTargetDir();
      try {
        const res = await fetch('/api/create-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dirPath: activeDir, fileName: defaultName })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        await loadTree();
        await loadFile(data.path);
      } catch (err) {
        alert(err.message);
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

  files.forEach(file => {
    const row = document.createElement('div');
    row.className = 'link-item-row';
    const cleanName = getDisplayName(file.name, false);
    const relPath = getDisplayName(file.path.replace(state.rootFolder, '').replace(/^[\\/]/, ''), false);

    row.innerHTML = `
      <span style="font-size: 14px;">📝</span>
      <span class="link-item-name">${escapeHtml(cleanName)}</span>
      <span class="link-item-path">${escapeHtml(relPath)}</span>
    `;

    row.onclick = () => {
      insertLinkIntoTextarea(`[[${cleanName}]]`);
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
  updateSaveStatus('saving');
  updateStats();

  if (state.saveTimeout) clearTimeout(state.saveTimeout);
  state.saveTimeout = setTimeout(() => saveCurrentFile(false), 500);
}

function escapeHtml(text) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function updateCursorPos() {
  const pos = memoTextarea.selectionStart || 0;
  const lines = memoTextarea.value.substring(0, pos).split('\n');
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  cursorPos.textContent = `줄 ${line}, 열 ${col}`;
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
  showModal(
    '새 메모 만들기',
    `생성할 메모 이름을 입력하세요 (예: 회의록, 아이디어):`,
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
  showModal(
    '새 폴더 만들기',
    `생성할 폴더 이름을 입력하세요:`,
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
          await loadFile(data.newPath);
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
      if (state.currentFilePath === targetPath) {
        state.currentFilePath = null;
        emptyState.classList.remove('hidden');
        memoTextarea.classList.add('hidden');
        fileTitle.textContent = '선택된 메모 없음';
        filePathDisplay.textContent = '👈 왼쪽 트리에서 메모 파일을 선택하거나 새로 만드세요';
        btnManualSave.disabled = true;
      }
      await loadTree();
    }).catch(err => alert(err.message));
  }
}

function getActiveTargetDir() {
  if (state.selectedNodePath) {
    return state.selectedNodePath;
  }
  if (state.currentFilePath) {
    const parts = state.currentFilePath.split(/[\\/]/);
    parts.pop();
    return parts.join('/') || state.rootFolder;
  }
  return state.rootFolder;
}

// Change Root Folder
async function handleChangeFolder() {
  try {
    const res = await fetch('/api/browse-folder', { method: 'POST' });
    const data = await res.json();
    if (data.success && data.rootFolder) {
      state.rootFolder = data.rootFolder;
      updateRootFolderDisplay();
      await loadTree();
      return;
    }
  } catch (e) {}

  // Fallback to text prompt
  showModal(
    '작업 폴더 직접 입력',
    '메모를 저장할 로컬 폴더의 전체 경로를 입력하세요:',
    state.rootFolder,
    async (folderPath) => {
      if (!folderPath.trim()) return;
      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rootFolder: folderPath.trim() })
        });
        const cfg = await res.json();
        state.rootFolder = cfg.rootFolder;
        updateRootFolderDisplay();
        await loadTree();
      } catch (err) {
        alert('폴더 설정 실패: ' + err.message);
      }
    }
  );
}

// Event Listeners
function setupEventListeners() {
  btnChangeFolder.onclick = handleChangeFolder;
  currentFolderName.onclick = handleChangeFolder;
  btnNewFile.onclick = () => promptNewFile();
  btnNewFolder.onclick = () => promptNewFolder();
  btnRefresh.onclick = loadTree;
  btnManualSave.onclick = () => saveCurrentFile(true);

  // Link Insertion
  btnInsertLink.onclick = openLinkSelectorModal;
  btnLinkModalCancel.onclick = () => linkModalOverlay.classList.add('hidden');

  // Auto-Save: Debounce (1s idle) + Max Interval (3s continuous)
  memoTextarea.addEventListener('input', () => {
    state.isDirty = true;
    updateSaveStatus('editing');
    updateStats();
    updateCursorPos();

    // 1. Save 1 second after user pauses typing
    if (state.saveTimeout) clearTimeout(state.saveTimeout);
    state.saveTimeout = setTimeout(() => {
      saveCurrentFile(false);
    }, 1000);

    // 2. Even if user types continuously without pausing, save at least every 3 seconds
    if (!state.maxSaveTimeout) {
      state.maxSaveTimeout = setTimeout(() => {
        state.maxSaveTimeout = null;
        if (state.isDirty) {
          saveCurrentFile(false);
        }
      }, 3000);
    }
  });

  // Click & Double-Click to open link directly in textarea
  memoTextarea.addEventListener('click', (e) => {
    updateCursorPos();
    if (e.metaKey || e.ctrlKey) {
      handleTextareaLinkClick();
    }
  });

  memoTextarea.addEventListener('dblclick', () => {
    handleTextareaLinkClick();
  });

  memoTextarea.addEventListener('keyup', updateCursorPos);

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

    // Cmd/Ctrl + S: Save
    if (mod && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      saveCurrentFile(true);
    }
    // Cmd/Ctrl + K: Insert Memo Link
    if (mod && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (!btnInsertLink.disabled) openLinkSelectorModal();
    }
    // Cmd/Ctrl + N: New File
    if (mod && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      promptNewFile();
    }
    // Cmd/Ctrl + O: Change Folder
    if (mod && (e.key === 'o' || e.key === 'O')) {
      e.preventDefault();
      handleChangeFolder();
    }
  });
}

// Heartbeat & Auto-shutdown client
function startHeartbeat() {
  function ping() {
    fetch('/api/heartbeat', { method: 'POST' }).catch(() => {});
  }
  ping();
  setInterval(ping, 2000);

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
