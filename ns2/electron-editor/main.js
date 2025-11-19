const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    backgroundColor: '#121212',
    icon: path.join(__dirname, '..', 'icon_transparent.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: !app.isPackaged
    }
  });

  try { win.setMenuBarVisibility(false); } catch (e) {}

  try {
    win.on('maximize', () => { win.webContents.send('window:maximized', true); });
    win.on('unmaximize', () => { win.webContents.send('window:maximized', false); });
  } catch(e){}

  const devDir = path.join(__dirname, '..');
  const packagedExternal = path.join(process.resourcesPath || '', 'ns2');
  const packagedInternal = path.join(__dirname, 'ns2');
  const pickBase = () => {
    if (app.isPackaged) {
      try { if (fs.existsSync(path.join(packagedExternal, 'editor.html'))) return packagedExternal; } catch {}
      try { if (fs.existsSync(path.join(packagedInternal, 'editor.html'))) return packagedInternal; } catch {}
    }
    return devDir;
  };
  const baseDir = pickBase();
  const entry = path.join(baseDir, 'editor.html');
  try {
    await win.loadFile(entry);
  } catch (err) {
    console.error('Failed to load editor.html from', entry, err);
    await win.loadURL('data:text/html,<h1>editor.html not found</h1>');
  }
}

app.whenReady().then(() => {
  try {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.martinpetkovski.ns2.editor');
    }
  } catch (e) {}
  return createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

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
