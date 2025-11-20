const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const fsp = fs.promises;
const windowCloseGuards = new WeakMap();

const FILE_FILTERS = [
  { name: 'NS2 Stories', extensions: ['ns2'] },
  { name: 'All Files', extensions: ['*'] }
];

let fileWatcher = null;
let watchingPath = null;
let watchingWebContents = null;
let diskChangeTimer = null;
const RECENT_SECTION = 'recentstories';

const safeLower = (str) => (typeof str === 'string' ? str.toLowerCase() : '');

const sanitizePathValue = (value) => {
  if (!value) return '';
  return String(value).replace(/[\r\n]/g, '').trim();
};

function getRecentFilePath() {
  try {
    const userDir = app.getPath('userData');
    return path.join(userDir, 'recent-stories.ini');
  } catch (err) {
    return path.join(__dirname, 'recent-stories.ini');
  }
}

function parseRecentIni(content) {
  if (!content || typeof content !== 'string') return [];
  const lines = content.split(/\r?\n/);
  let inSection = false;
  const items = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      inSection = line.slice(1, -1).trim().toLowerCase() === RECENT_SECTION;
      continue;
    }
    if (!inSection) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const value = sanitizePathValue(line.slice(idx + 1));
    if (value) items.push(value);
    if (items.length >= RECENT_MAX) break;
  }
  return items;
}

function serializeRecentIni(list) {
  const lines = ['[RecentStories]'];
  list.slice(0, RECENT_MAX).forEach((entry, index) => {
    const cleaned = sanitizePathValue(entry);
    lines.push(`item${index}=${cleaned}`);
  });
  return lines.join(os.EOL);
}

async function ensureRecentStoriesLoaded() {
  if (recentStoriesLoaded) return;
  recentStoriesLoaded = true;
  try {
    const filePath = getRecentFilePath();
    const data = await fsp.readFile(filePath, 'utf8');
    recentStories = parseRecentIni(data);
  } catch (err) {
    recentStories = [];
  }
}

async function persistRecentStories() {
  try {
    const target = getRecentFilePath();
    const dir = path.dirname(target);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(target, serializeRecentIni(recentStories), 'utf8');
  } catch (err) {
    console.warn('Failed to persist recent stories', err);
  }
}

async function addRecentStory(filePath) {
  if (!filePath) return;
  await ensureRecentStoriesLoaded();
  const normalized = sanitizePathValue(path.normalize(filePath));
  if (!normalized) return;
  const currentIndex = recentStories.findIndex((entry) => safeLower(entry) === safeLower(normalized));
  if (currentIndex >= 0) {
    recentStories.splice(currentIndex, 1);
  }
  recentStories.unshift(normalized);
  if (recentStories.length > RECENT_MAX) {
    recentStories.length = RECENT_MAX;
  }
  await persistRecentStories();
}

async function clearRecentStories() {
  await ensureRecentStoriesLoaded();
  recentStories = [];
  await persistRecentStories();
}

async function getRecentStoriesResponse() {
  await ensureRecentStoriesLoaded();
  return recentStories.map((entry) => ({
    path: entry,
    name: path.basename(entry) || entry
  }));
}
const RECENT_MAX = 10;
let recentStories = [];
let recentStoriesLoaded = false;

ipcMain.handle('file:set-active', async (event, filePath) => {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
    watchingPath = null;
  }
  if (diskChangeTimer) {
    clearTimeout(diskChangeTimer);
    diskChangeTimer = null;
  }
  watchingWebContents = null;

  if (filePath) {
    watchingPath = filePath;
    watchingWebContents = event.sender;
    try {
      fileWatcher = fs.watch(watchingPath, (eventType) => {
        if (!['change', 'rename'].includes(eventType)) return;
        if (diskChangeTimer) clearTimeout(diskChangeTimer);
        diskChangeTimer = setTimeout(async () => {
          diskChangeTimer = null;
          try {
            const [content, stats] = await Promise.all([
              fsp.readFile(watchingPath, 'utf8'),
              fsp.stat(watchingPath).catch(() => null)
            ]);
            if (watchingWebContents && !watchingWebContents.isDestroyed()) {
              watchingWebContents.send('file:disk-changed', {
                path: watchingPath,
                content,
                mtime: stats && stats.mtime ? stats.mtime.toISOString() : null
              });
            }
          } catch (err) {
            console.warn(`Could not process disk change for ${watchingPath}`, err);
          }
        }, 150);
      });
      fileWatcher.on('error', (e) => {
        console.error(`File watcher error for ${watchingPath}:`, e);
        if (fileWatcher) fileWatcher.close();
        fileWatcher = null;
        watchingPath = null;
        watchingWebContents = null;
      });
    } catch (e) {
      console.error(`Failed to start watching file: ${filePath}`, e);
      watchingPath = null;
      watchingWebContents = null;
    }
  }
  return { watching: watchingPath || null };
});

ipcMain.handle('file:open', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
      title: 'Open Story',
      properties: ['openFile'],
      filters: FILE_FILTERS
    });
    if (!result || result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }
    const filePath = result.filePaths[0];
    const content = await fsp.readFile(filePath, 'utf8');
    addRecentStory(filePath).catch(() => {});
    return { path: filePath, content };
  } catch (error) {
    console.error('file:open failed', error);
    return { error: error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('file:save', async (event, payload) => {
  const { filePath, content } = payload || {};
  if (!filePath) {
    return { error: 'Missing file path' };
  }
  try {
    await fsp.writeFile(filePath, content ?? '', 'utf8');
    addRecentStory(filePath).catch(() => {});
    return { path: filePath };
  } catch (error) {
    console.error('file:save failed', error);
    return { error: error && error.message ? error.message : String(error) };
  }
});

ipcMain.handle('file:save-as', async (event, payload) => {
  const { content, suggestedPath } = payload || {};
  try {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(win, {
      title: 'Save Story As',
      defaultPath: suggestedPath || undefined,
      filters: FILE_FILTERS
    });
    if (!result || result.canceled || !result.filePath) {
      return null;
    }
    await fsp.writeFile(result.filePath, content ?? '', 'utf8');
    addRecentStory(result.filePath).catch(() => {});
    return { path: result.filePath };
  } catch (error) {
    console.error('file:save-as failed', error);
    return { error: error && error.message ? error.message : String(error) };
  }
});

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

  const ensureCloseGuard = () => {
    let guard = windowCloseGuards.get(win);
    if (!guard) {
      guard = { force: false };
      windowCloseGuards.set(win, guard);
      win.on('closed', () => {
        windowCloseGuards.delete(win);
      });
    }
    return guard;
  };

  ensureCloseGuard();
  win.on('close', (event) => {
    const guard = windowCloseGuards.get(win);
    if (guard && guard.force) {
      return;
    }
    event.preventDefault();
    try {
      win.webContents.send('window:attempt-close');
    } catch (err) {
      console.warn('Failed to send close attempt event, forcing close', err);
      if (guard) guard.force = true;
      win.close();
    }
  });

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
    if (!app.isPackaged) {
      win.webContents.openDevTools();
    }
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

ipcMain.handle('window:close-result', (event, payload) => {
  const allow = payload && payload.allow;
  const w = BrowserWindow.fromWebContents(event.sender);
  if (!w) return;
  const guard = windowCloseGuards.get(w);
  if (allow) {
    if (guard) guard.force = true;
    w.close();
  }
});

ipcMain.handle('recent:list', async () => {
  const items = await getRecentStoriesResponse();
  return { items };
});

ipcMain.handle('recent:clear', async () => {
  await clearRecentStories();
  return { items: [] };
});

ipcMain.handle('file:open-path', async (event, targetPath) => {
  if (!targetPath) {
    return { error: 'Missing file path' };
  }
  try {
    const normalized = path.normalize(targetPath);
    const content = await fsp.readFile(normalized, 'utf8');
    addRecentStory(normalized).catch(() => {});
    return { path: normalized, content };
  } catch (error) {
    console.error('file:open-path failed', error);
    return { error: error && error.message ? error.message : String(error) };
  }
});
