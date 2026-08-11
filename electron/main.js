const { app, BrowserWindow } = require('electron');
const path = require('path');

// 1. Start the Express Backend in the same Node process
try {
  console.log('[Electron Main] Launching Express Backend...');
  require('../backend/src/index.js');
  
  // Initialize existing watched folders from the DB
  const folderWatcher = require('../backend/src/desktop/folderWatcher');
  // Wait a short delay to ensure DB pool is initialized
  setTimeout(() => {
    folderWatcher.initializeWatchers()
      .then(() => console.log('[Electron Main] Initialized active folder watchers.'))
      .catch(err => console.error('[Electron Main] Watcher initialization failed:', err));
  }, 1000);
} catch (error) {
  console.error('[Electron Main] Failed to start Express backend:', error);
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  // During development, load from Vite dev server.
  // In production, we'd load the built index.html.
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  // Setup IPC handlers
  const { setupIpcHandlers } = require('./ipc');
  setupIpcHandlers(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

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
