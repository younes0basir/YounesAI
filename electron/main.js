const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const BACKEND_PORT = Number(process.env.PORT) || 3000;

// Probe whether a backend is already listening (e.g. started separately via
// `node src/index.js`). If it is, skip booting the embedded copy to avoid an
// EADDRINUSE crash and a duplicate scheduler.
function isBackendRunning() {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    const onDone = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(1500);
    socket.once('connect', () => onDone(true));
    socket.once('timeout', () => onDone(false));
    socket.once('error', () => onDone(false));
    socket.connect(BACKEND_PORT, '127.0.0.1');
  });
}

// 1. Start the Express Backend in the same Node process (unless it is already
// running externally).
let backendStarted = false;
(async () => {
  if (await isBackendRunning()) {
    console.log(`[Electron Main] Backend already running on port ${BACKEND_PORT} — skipping embedded boot.`);
    backendStarted = true;
    return;
  }

  try {
    console.log('[Electron Main] Launching Express Backend...');
    require('../backend/src/index.js');
    backendStarted = true;
  } catch (error) {
    console.error('[Electron Main] Failed to start Express backend:', error);
    return;
  }

  try {
    // Initialize existing watched folders from the DB
    const folderWatcher = require('../backend/src/desktop/folderWatcher');
    await folderWatcher.initializeWatchers();
    console.log('[Electron Main] Initialized active folder watchers.');
  } catch (error) {
    console.error('[Electron Main] Watcher initialization failed:', error);
  }
})();

const isDev = () => process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#f7f6ff',
    autoHideMenuBar: true,
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  });

  // Reveal only once the page has rendered to avoid a white flash
  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev()) {
    mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Hardening: never create new Electron windows, and open external
// links in the system browser instead.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (isDev() && url.startsWith(DEV_SERVER_URL)) {
      return { action: 'allow' };
    }
    if (/^https?:/.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    const allowed = isDev() && url.startsWith(DEV_SERVER_URL);
    if (allowed || url === contents.getURL()) return;
    event.preventDefault();
    if (/^https?:/.test(url)) {
      shell.openExternal(url);
    }
  });
});

// Enforce a single running instance of the app
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Register IPC handlers once (they close over the module-level `mainWindow`),
    // then create the first window.
    const { setupIpcHandlers } = require('./ipc');
    setupIpcHandlers(mainWindow, { backendStarted });

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

module.exports = { isDev };