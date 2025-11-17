// Reader preload exposes window control APIs for custom title bar
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close')
});

// Forward maximize/unmaximize to renderer to toggle icons
ipcRenderer.on('window:maximized', (event, isMax) => {
  if (window && window.__onWindowMaximized) {
    try { window.__onWindowMaximized(isMax); } catch(e){}
  }
});

contextBridge.exposeInMainWorld('electronWindowEvents', {
  onMaximize: (cb) => { window.__onWindowMaximized = cb; }
});
