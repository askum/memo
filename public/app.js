/**
 * Desktop Memo Frontend Client
 */
let state = {
  rootFolder: '',
  currentFilePath: null,
  treeData: [],
  selectedNodePath: null,
  saveTimeout: null,
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

// Init Application
async function init() {
  setupSplitter();
  setupKeyboardShortcuts();
  setupEventListeners();

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

  // Label
  const label = document.createElement('span');
  label.className = 'tree-item-label';
  label.textContent = item.name;
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
  if (state.isDirty && state.currentFilePath) {
    await saveCurrentFile(false);
  }

  try {
    const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error('파일을 읽을 수 없습니다.');
    const data = await res.json();

    state.currentFilePath = filePath;
    state.isDirty = false;

    // Update Header
    const fileName = filePath.split(/[\\/]/).pop();
    fileIcon.textContent = '📝';
    fileTitle.textContent = fileName;
    filePathDisplay.textContent = filePath.replace(state.rootFolder, '').replace(/^[\\/]/, '') || fileName;

    // Show Editor
    emptyState.classList.add('hidden');
    memoTextarea.classList.remove('hidden');
    memoTextarea.value = data.content || '';
    btnManualSave.disabled = false;

    updateSaveStatus('saved');
    updateStats();
    updateCursorPos();

    // Re-highlight active tree node
    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
    // Mark config
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastOpenedFile: filePath })
    });
  } catch (err) {
    console.error('Error loading file:', err);
    alert('파일을 불러오지 못했습니다: ' + err.message);
  }
}

// Save Current File
async function saveCurrentFile(showNotification = true) {
  if (!state.currentFilePath) return;

  if (state.saveTimeout) {
    clearTimeout(state.saveTimeout);
    state.saveTimeout = null;
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
    updateSaveStatus('saved');
    lastSavedTime.textContent = `저장됨: ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    console.error('Save error:', err);
    updateSaveStatus('error');
    if (showNotification) alert('저장 실패: ' + err.message);
  }
}

function updateSaveStatus(status) {
  saveStatusBadge.className = 'status-badge ' + status;
  if (status === 'saved') {
    saveStatusBadge.textContent = '💾 저장됨';
  } else if (status === 'saving') {
    saveStatusBadge.textContent = '✏️ 저장 중...';
  } else if (status === 'error') {
    saveStatusBadge.textContent = '❌ 저장 실패';
  }
}

function updateStats() {
  const text = memoTextarea.value;
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
    '새 메모 파일 만들기',
    `생성할 파일 이름을 입력하세요 (예: 회의록.md, 아이디어.txt):`,
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
  showModal(
    '이름 변경',
    `새로운 이름을 입력하세요:`,
    currName,
    async (newName) => {
      if (!newName.trim() || newName.trim() === currName) return;
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

function promptDelete(targetPath, name, isDir) {
  const itemType = isDir ? '폴더' : '파일';
  if (confirm(`정말로 ${itemType} '${name}'을(를) 삭제하시겠습니까?`)) {
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

  // Auto-Save Debounce
  memoTextarea.addEventListener('input', () => {
    state.isDirty = true;
    updateSaveStatus('saving');
    updateStats();
    updateCursorPos();

    if (state.saveTimeout) clearTimeout(state.saveTimeout);
    state.saveTimeout = setTimeout(() => {
      saveCurrentFile(false);
    }, 500);
  });

  memoTextarea.addEventListener('click', updateCursorPos);
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

// Launch
window.addEventListener('DOMContentLoaded', init);
