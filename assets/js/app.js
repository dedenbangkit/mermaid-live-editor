// Mermaid Live Editor - Main Application
// IndexedDB Database Management
const DB_NAME = 'MermaidEditorDB';
const DB_VERSION = 1;
const STORE_NAME = 'diagrams';
let db = null;

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose'
});

// Application State
let currentFileId = null;
let currentZoom = 1;
let isPanning = false;
let panStart = { x: 0, y: 0 };
let isResizing = false;
let editor = null;

// DOM Elements
const textArea = document.getElementById("mermaid-code");
const preview = document.getElementById("preview");
const previewContent = document.getElementById("preview-content");
const previewContainer = document.getElementById("preview-container");
const fileName = document.getElementById("file-name");
const fileList = document.getElementById("file-list");
const fileCount = document.getElementById("file-count");
const resizer = document.getElementById("resizer");
const editorSection = document.getElementById("editor-section");
const previewSection = document.getElementById("preview-section");
const sidebar = document.getElementById("sidebar");

// ================== IndexedDB Functions ==================

async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Database failed to open');
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('Database opened successfully');
      resolve(db);
    };

    request.onupgradeneeded = (e) => {
      db = e.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('name', 'name', { unique: false });
        objectStore.createIndex('created', 'created', { unique: false });
        console.log('Object store created');
      }
    };
  });
}

async function saveToIndexedDB(fileData) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.put(fileData);

    request.onsuccess = () => {
      console.log('File saved to IndexedDB');
      resolve(fileData.id);
    };

    request.onerror = () => {
      console.error('Error saving file');
      reject(request.error);
    };
  });
}

async function loadFromIndexedDB(fileId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.get(fileId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllFilesFromIndexedDB() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteFromIndexedDB(fileId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.delete(fileId);

    request.onsuccess = () => {
      console.log('File deleted from IndexedDB');
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// ================== File Management Functions ==================

async function loadFiles() {
  try {
    const files = await getAllFilesFromIndexedDB();
    fileList.innerHTML = "";
    fileCount.textContent = files.length;

    // Sort by lastModified (most recent first), fallback to created
    files.sort((a, b) => {
      const aDate = new Date(a.lastModified || a.created);
      const bDate = new Date(b.lastModified || b.created);
      return bDate - aDate;
    });

    if (files.length === 0) {
      fileList.innerHTML = `
        <div class="text-center py-8 text-slate-400">
          <svg class="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <p class="text-sm">No diagrams yet</p>
          <p class="text-xs mt-1">Create your first one!</p>
        </div>
      `;
      return;
    }

    files.forEach((file) => {
      const fileItem = document.createElement("div");
      const isActive = file.id === currentFileId;

      fileItem.className = `file-item group px-3 py-2.5 border-b border-slate-200 transition-all duration-200 cursor-pointer ${
        isActive
          ? 'bg-indigo-50 border-l-2 border-l-indigo-500'
          : 'hover:bg-slate-50 border-l-2 border-l-transparent'
      }`;

      // Format detailed timestamp
      const date = new Date(file.lastModified || file.created);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      let timeAgo;
      if (diffMins < 1) {
        timeAgo = 'Just now';
      } else if (diffMins < 60) {
        timeAgo = `${diffMins}m ago`;
      } else if (diffHours < 24) {
        timeAgo = `${diffHours}h ago`;
      } else if (diffDays < 7) {
        timeAgo = `${diffDays}d ago`;
      } else {
        timeAgo = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
      }

      const fullDate = date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      fileItem.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="flex-1 min-w-0 cursor-pointer" onclick="loadFile('${file.id}')">
            <div class="font-medium text-sm text-slate-900 truncate ${isActive ? 'text-indigo-700' : ''}">${file.name}</div>
            <div class="text-xs text-slate-500 mt-0.5" title="${fullDate}">${timeAgo}</div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            ${isActive ? `
              <svg class="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
              </svg>
            ` : ''}
            <button
              onclick="event.stopPropagation(); deleteFile('${file.id}', '${file.name.replace(/'/g, "\\'")}')"
              class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 transition-all duration-200"
              title="Delete diagram"
            >
              <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </div>
      `;

      fileList.appendChild(fileItem);
    });
  } catch (err) {
    console.error("Error loading files:", err);
    showNotification('Error loading files', 'error');
  }
}

async function loadFile(fileId) {
  try {
    const file = await loadFromIndexedDB(fileId);

    if (file) {
      currentFileId = fileId;
      fileName.value = file.name;
      updateDiagramTitle();
      editor.setValue(file.content);

      setTimeout(() => {
        updatePreview();
      }, 100);

      updateSaveButton();
      loadFiles();
      showNotification(`Opened "${file.name}"`, 'success');
    }
  } catch (err) {
    console.error("Error loading file:", err);
    showNotification('Error loading file', 'error');
  }
}

async function saveFile() {
  const diagramName = fileName.value || 'Untitled Diagram';
  const isUpdate = !!currentFileId;

  // Check if updating existing file with name change
  if (currentFileId) {
    const existingFile = await loadFromIndexedDB(currentFileId);
    if (existingFile && existingFile.name !== diagramName) {
      const confirmed = confirm(`Update diagram "${existingFile.name}" to "${diagramName}"?`);
      if (!confirmed) return;
    }
  }

  const existingFile = currentFileId ? await loadFromIndexedDB(currentFileId) : null;
  const now = new Date().toISOString();

  const fileData = {
    id: currentFileId || `file_${Date.now()}`,
    name: diagramName,
    content: editor.getValue(),
    created: existingFile?.created || now,
    lastModified: now
  };

  try {
    const savedId = await saveToIndexedDB(fileData);
    currentFileId = savedId;
    updateSaveButton();
    loadFiles();
    showNotification(isUpdate ? 'Diagram updated!' : 'Diagram saved!', 'success');
  } catch (err) {
    console.error("Error saving file:", err);
    showNotification('Error saving diagram', 'error');
  }
}

async function saveAsNew() {
  const diagramName = fileName.value || 'Untitled Diagram';
  const baseName = diagramName.replace(/ \(copy\)$/, '');
  const newName = `${baseName} (copy)`;

  const now = new Date().toISOString();

  const fileData = {
    id: `file_${Date.now()}`,
    name: newName,
    content: editor.getValue(),
    created: now,
    lastModified: now
  };

  try {
    const savedId = await saveToIndexedDB(fileData);
    currentFileId = savedId;
    fileName.value = newName;
    updateSaveButton();
    loadFiles();
    showNotification('Saved as new diagram!', 'success');
  } catch (err) {
    console.error("Error saving as new:", err);
    showNotification('Error saving diagram', 'error');
  }
}

function updateSaveButton() {
  const saveBtn = document.getElementById('save-btn-text');
  if (saveBtn) {
    saveBtn.textContent = currentFileId ? 'Update' : 'Save';
  }
}

async function deleteFile(fileId, fileName) {
  if (!confirm(`Delete diagram "${fileName}"?\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    await deleteFromIndexedDB(fileId);

    // If we deleted the currently open file, create a new one
    if (fileId === currentFileId) {
      newFile();
    }

    loadFiles();
    showNotification('Diagram deleted', 'success');
  } catch (err) {
    console.error("Error deleting file:", err);
    showNotification('Error deleting diagram', 'error');
  }
}

async function deleteCurrentFile() {
  if (!currentFileId) return;

  const file = await loadFromIndexedDB(currentFileId);
  if (file) {
    await deleteFile(currentFileId, file.name);
  }
}

function newFile() {
  currentFileId = null;
  fileName.value = "Untitled Diagram";
  updateDiagramTitle();
  editor.setValue(`graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Fix it]
    D --> B`);

  setTimeout(() => {
    updatePreview();
  }, 100);

  updateSaveButton();
  loadFiles();
}

// ================== Preview Functions ==================

function updatePreview() {
  const code = editor.getValue();

  if (!code || !code.trim()) {
    previewContent.innerHTML = `
      <div class="text-center text-slate-400">
        <svg class="w-20 h-20 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <p class="text-lg font-medium">Start typing to see your diagram</p>
        <p class="text-sm mt-2">Use Mermaid syntax in the editor</p>
      </div>
    `;
    return;
  }

  previewContent.innerHTML = `
    <div class="flex items-center gap-3 text-slate-400">
      <div class="spinner w-6 h-6 border-3 border-slate-300 border-t-indigo-600 rounded-full"></div>
      <span>Rendering diagram...</span>
    </div>
  `;

  try {
    const existingDiagram = document.getElementById('mermaid-diagram');
    if (existingDiagram) {
      existingDiagram.remove();
    }

    mermaid
      .render("mermaid-diagram", code)
      .then(({ svg }) => {
        previewContent.innerHTML = svg;
      })
      .catch((err) => {
        console.error("Mermaid render error:", err);
        previewContent.innerHTML = `
          <div class="max-w-lg text-center">
            <div class="bg-red-50 border border-red-200 rounded-lg p-6">
              <svg class="w-12 h-12 text-red-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <h3 class="text-lg font-semibold text-red-900 mb-2">Syntax Error</h3>
              <p class="text-sm text-red-700 font-mono">${err.message}</p>
              <a href="cheatsheet.html" class="inline-block mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                View Examples →
              </a>
            </div>
          </div>
        `;
      });
  } catch (err) {
    console.error("Preview error:", err);
    showNotification('Error rendering preview', 'error');
  }
}

// ================== Zoom/Pan Functions ==================

function zoomIn() {
  currentZoom = Math.min(currentZoom * 1.2, 5);
  updateTransform();
}

function zoomOut() {
  currentZoom = Math.max(currentZoom / 1.2, 0.1);
  updateTransform();
}

function resetZoom() {
  currentZoom = 1;
  previewContent.style.transform = `scale(${currentZoom})`;
  previewContainer.scrollTop = 0;
  previewContainer.scrollLeft = 0;
}

function updateTransform() {
  previewContent.style.transform = `scale(${currentZoom})`;
}

// ================== Resizer Functions ==================

function initResizer() {
  if (!resizer) return;

  resizer.addEventListener("mousedown", (e) => {
    isResizing = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;

    const containerRect = editorSection.parentElement.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

    if (newWidth >= 20 && newWidth <= 80) {
      editorSection.style.flex = `1 1 ${newWidth}%`;
      previewSection.style.flex = `1 1 ${100 - newWidth}%`;
    }
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });
}

// ================== Panning Functions ==================

function initPanning() {
  previewContainer.addEventListener("mousedown", (e) => {
    isPanning = true;
    panStart.x = e.clientX - previewContainer.offsetLeft;
    panStart.y = e.clientY - previewContainer.offsetTop;
    previewContainer.style.cursor = "grabbing";
  });

  previewContainer.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    e.preventDefault();

    const x = e.clientX - previewContainer.offsetLeft;
    const y = e.clientY - previewContainer.offsetTop;

    const walkX = (x - panStart.x) * 2;
    const walkY = (y - panStart.y) * 2;

    previewContainer.scrollLeft -= walkX;
    previewContainer.scrollTop -= walkY;

    panStart.x = x;
    panStart.y = y;
  });

  previewContainer.addEventListener("mouseup", () => {
    isPanning = false;
    previewContainer.style.cursor = "grab";
  });

  previewContainer.addEventListener("mouseleave", () => {
    isPanning = false;
    previewContainer.style.cursor = "grab";
  });

  previewContainer.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
  });
}

// ================== Sidebar Functions ==================

function toggleSidebar() {
  sidebar.classList.toggle("collapsed");
}

function toggleRename() {
  const titleElement = document.getElementById('diagram-title');
  const inputElement = document.getElementById('file-name');

  if (inputElement.classList.contains('hidden')) {
    // Show input, hide title
    titleElement.classList.add('hidden');
    inputElement.classList.remove('hidden');
    inputElement.focus();
    inputElement.select();
  } else {
    // Hide input, show title
    inputElement.classList.add('hidden');
    titleElement.classList.remove('hidden');
    updateDiagramTitle();
  }
}

function updateDiagramTitle() {
  const titleElement = document.getElementById('diagram-title');
  const inputElement = document.getElementById('file-name');
  const diagramName = inputElement.value || 'Untitled Diagram';
  titleElement.textContent = diagramName;
}

// ================== Notification System ==================

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  const bgColor = type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-red-500' : 'bg-indigo-500';

  notification.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in-right flex items-center gap-3`;

  const icon = type === 'success'
    ? '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>'
    : type === 'error'
    ? '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>'
    : '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>';

  notification.innerHTML = `
    ${icon}
    <span class="font-medium">${message}</span>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ================== Keyboard Shortcuts ==================

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S: Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveFile();
    }

    // Ctrl/Cmd + N: New file
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      newFile();
    }

    // Ctrl/Cmd + B: Toggle sidebar
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      toggleSidebar();
    }
  });
}

// ================== Initialization ==================

document.addEventListener("DOMContentLoaded", async function () {
  // Initialize CodeMirror
  editor = CodeMirror.fromTextArea(textArea, {
    mode: "yaml",
    theme: "default",
    lineNumbers: true,
    lineWrapping: false,
    indentWithTabs: false,
    indentUnit: 2,
    tabSize: 2,
    autoCloseBrackets: true,
    matchBrackets: true,
    scrollbarStyle: "native"
  });

  editor.on("change", updatePreview);

  // Initialize other features
  initResizer();
  initPanning();
  initKeyboardShortcuts();

  // Add event listeners for file name input
  fileName.addEventListener('blur', () => {
    const inputElement = document.getElementById('file-name');
    if (!inputElement.classList.contains('hidden')) {
      toggleRename();
    }
  });

  fileName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      toggleRename();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      // Reset to original value
      const titleElement = document.getElementById('diagram-title');
      fileName.value = titleElement.textContent;
      toggleRename();
    }
  });

  // Start with sidebar collapsed on mobile
  if (window.innerWidth < 768) {
    sidebar.classList.add("collapsed");
  }

  // Initialize IndexedDB and load files
  try {
    await initDB();
    await loadFiles();
    updatePreview();
    showNotification('Welcome to Mermaid Editor!', 'info');
  } catch (err) {
    console.error("Error initializing application:", err);
    showNotification('Error initializing app', 'error');
  }
});
