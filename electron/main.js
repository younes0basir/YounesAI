const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// The installed app is a thin client: it never embeds a backend (there is no
// local DB / scheduler). All API traffic goes to the cloud backend baked into
// the frontend build via VITE_API_URL. Keeping a backend out of the package
// avoids duplicate cron jobs, secret leakage, and bundle weight.

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

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