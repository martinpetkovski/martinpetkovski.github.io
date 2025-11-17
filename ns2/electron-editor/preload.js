const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (content, filePath) => ipcRenderer.invoke('dialog:saveFile', { content, filePath }),
  saveAs: (content) => ipcRenderer.invoke('dialog:saveAs', content),
  // Window controls (available when running under Electron)
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close')
});
// Allow renderer to listen for maximize/unmaximize events
ipcRenderer.on('window:maximized', (event, isMax) => {
  // forward via a global callback if set
  if (window && window.__onWindowMaximized) try { window.__onWindowMaximized(isMax); } catch(e){}
});

contextBridge.exposeInMainWorld('electronWindowEvents', {
  onMaximize: (cb) => { window.__onWindowMaximized = cb; }
});
