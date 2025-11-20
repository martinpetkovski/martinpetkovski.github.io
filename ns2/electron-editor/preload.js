// Editor preload exposes window control APIs for custom title bar
const { contextBridge, ipcRenderer } = require('electron');
const closeAttemptCallbacks = new Set();

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  resolveCloseRequest: (payload) => ipcRenderer.invoke('window:close-result', payload || {}),
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (content, filePath) => ipcRenderer.invoke('file:save', { content, filePath }),
  saveAs: (content, suggestedPath) => ipcRenderer.invoke('file:save-as', { content, suggestedPath }),
  getRecentStories: () => ipcRenderer.invoke('recent:list'),
  clearRecentStories: () => ipcRenderer.invoke('recent:clear'),
  openRecentStory: (targetPath) => ipcRenderer.invoke('file:open-path', targetPath)
});

// Forward maximize/unmaximize to renderer to toggle icons
ipcRenderer.on('window:maximized', (event, isMax) => {
  if (window && window.__onWindowMaximized) {
    try { window.__onWindowMaximized(isMax); } catch(e){}
  }
});

contextBridge.exposeInMainWorld('electronWindowEvents', {
  onMaximize: (cb) => { window.__onWindowMaximized = cb; },
  onCloseRequest: (cb) => {
    if (typeof cb !== 'function') return () => {};
    closeAttemptCallbacks.add(cb);
    return () => closeAttemptCallbacks.delete(cb);
  }
});

contextBridge.exposeInMainWorld('electronFile', {
  setActive: (filePath) => ipcRenderer.invoke('file:set-active', filePath),
  onFileContentChanged: (callback) => ipcRenderer.on('file:disk-changed', (event, payload) => callback(payload))
});

ipcRenderer.on('window:attempt-close', () => {
  closeAttemptCallbacks.forEach((cb) => {
    try {
      cb();
    } catch (err) {
      console.warn('Close request callback failed', err);
    }
  });
});
