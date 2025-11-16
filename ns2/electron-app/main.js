const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Prefer loading the shared `ns2/editor.html` directly from the parent folder
// This avoids copying assets and preserves correct relative paths for CSS/JS/WASM.

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // frameless window so we can render custom window controls
    backgroundColor: '#121212',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  // Use a frameless window so the app can render custom window controls
  // (we keep a standard background so content looks the same).
  // Note: on macOS you may prefer titleBarStyle: 'hiddenInset' instead.
  try {
    win.setMenuBarVisibility(false);
    // set a frameless window on Windows/Linux to replace default titlebar
    // recreate window with frameless option if not already frameless
  } catch (e) {}

  // Open DevTools for debugging and forward renderer console messages to main process
  try {
    win.webContents.openDevTools({ mode: 'undocked' });
    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[renderer][level=${level}] ${sourceId}:${line} ${message}`);
    });
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('Renderer failed to load:', errorCode, errorDescription, validatedURL);
    });
  } catch (e) {
    console.warn('Could not open DevTools automatically', e);
  }

  // Try to load the shared editor from the parent folder so relative asset paths work
  const sharedEditor = path.join(__dirname, '..', 'editor.html');
  try {
    await fs.access(sharedEditor);
    win.loadFile(sharedEditor);
  } catch (err) {
    // Parent editor not available; fall back to local editor (if present)
    const localEditor = path.join(__dirname, 'editor.html');
    try {
      await fs.access(localEditor);
      win.loadFile(localEditor);
    } catch (err2) {
      console.error('No editor.html found in parent or local folder', err2);
      // As a last resort, attempt to load parent editor (may throw)
      win.loadFile(sharedEditor).catch(e => console.error(e));
    }

    // Forward maximize/unmaximize events to renderer so UI can update maximize icon
    try {
      win.on('maximize', () => { win.webContents.send('window:maximized', true); });
      win.on('unmaximize', () => { win.webContents.send('window:maximized', false); });
    } catch (e) {}
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC handlers
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open NS2 Story',
    properties: ['openFile'],
    filters: [ { name: 'NS2', extensions: ['ns2', 'txt'] }, { name: 'All Files', extensions: ['*'] } ]
  });
  if (canceled || !filePaths || filePaths.length === 0) return null;
  const filePath = filePaths[0];
  try {
    const content = await fs.readFile(filePath, { encoding: 'utf8' });
    return { path: filePath, content };
  } catch (err) {
    return { error: String(err) };
  }
});

// No ensureSelfContained handler when loading shared assets directly

ipcMain.handle('dialog:saveFile', async (event, { content, filePath }) => {
  if (!filePath) return { error: 'no-path' };
  try {
    await fs.writeFile(filePath, content, { encoding: 'utf8' });
    return { path: filePath };
  } catch (err) {
    return { error: String(err) };
  }
});

ipcMain.handle('dialog:saveAs', async (event, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save NS2 Story As',
    defaultPath: 'story.ns2',
    filters: [ { name: 'NS2', extensions: ['ns2', 'txt'] }, { name: 'All Files', extensions: ['*'] } ]
  });
  if (canceled || !filePath) return null;
  try {
    await fs.writeFile(filePath, content, { encoding: 'utf8' });
    return { path: filePath };
  } catch (err) {
    return { error: String(err) };
  }
});

// Window control IPC (for frameless window)
ipcMain.handle('window:minimize', (event) => {
  const w = BrowserWindow.fromWebContents(event.sender);
  if (w) w.minimize();
});
ipcMain.handle('window:toggle-maximize', (event) => {
  const w = BrowserWindow.fromWebContents(event.sender);
  if (!w) return;
  if (w.isMaximized()) w.unmaximize(); else w.maximize();
  return { maximized: w.isMaximized() };
});
ipcMain.handle('window:close', (event) => {
  const w = BrowserWindow.fromWebContents(event.sender);
  if (w) w.close();
});
