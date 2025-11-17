const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    backgroundColor: '#121212',
    // Prefer dedicated reader icon; fallback handled by OS if missing
    icon: path.join(__dirname, '..', 'icon_reader.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  try { win.setMenuBarVisibility(false); } catch (e) {}

  // Forward maximize/unmaximize events to renderer for icon toggling
  try {
    win.on('maximize', () => { win.webContents.send('window:maximized', true); });
    win.on('unmaximize', () => { win.webContents.send('window:maximized', false); });
  } catch(e){}

  // Load the shared reader.html from parent ns2 folder
  const sharedReader = path.join(__dirname, '..', 'reader.html');
  try {
    await fs.access(sharedReader);
    await win.loadFile(sharedReader);
  } catch (err) {
    // Fallback to local reader.html if someone copies it here later
    const localReader = path.join(__dirname, 'reader.html');
    try {
      await fs.access(localReader);
      await win.loadFile(localReader);
    } catch (err2) {
      console.error('No reader.html found (parent or local)');
      await win.loadURL('data:text/html,<h1>reader.html not found</h1>');
    }
  }
}

app.whenReady().then(() => {
  try {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.martinpetkovski.ns2.reader');
    }
  } catch (e) {}
  return createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// Window control IPC for frameless window
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
