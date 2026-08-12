const { ipcMain, dialog } = require('electron');
const path = require('path');
const fileScanner = require('../../backend/src/desktop/fileScanner');
const folderWatcher = require('../../backend/src/desktop/folderWatcher');
const { retrieveDocuments } = require('../../backend/src/retrieval/retrieveDocuments');
const pool = require('../../backend/src/db');

function setupIpcHandlers(mainWindow, { backendStarted = true } = {}) {
  // Only accept invocations coming from this app's own window.
  const isTrustedSender = (event) =>
    Boolean(mainWindow) && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents;

  // Coerce + validate user ids to prevent injection / type confusion.
  const sanitizeUserId = (value) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  };

  // Accept only non-empty strings and normalize to an absolute path.
  const asAbsolutePath = (value) => {
    if (typeof value !== 'string' || !value.trim()) return null;
    return path.resolve(value.trim());
  };

  const guarded = (handler) => async (event, payload = {}) => {
    if (!isTrustedSender(event)) {
      return { success: false, error: 'Untrusted sender' };
    }
    try {
      return await handler(event, payload);
    } catch (error) {
      console.error('[IPC] handler error:', error);
      return { success: false, error: error.message };
    }
  };

  // 1. Select Folder dialog
  ipcMain.handle('select-folder', guarded(async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select a folder to monitor',
      buttonLabel: 'Monitor folder',
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, cancelled: true };
    }

    return { success: true, folderPath: result.filePaths[0] };
  }));

  // 2. Scan folder recursively and register it as monitored
  ipcMain.handle('scan-folder', guarded(async (_event, { folderPath, userId }) => {
    const uid = sanitizeUserId(userId);
    const folder = asAbsolutePath(folderPath);

    if (!uid) return { success: false, error: 'A valid userId is required' };
    if (!folder) return { success: false, error: 'folderPath is required' };

    console.log(`[IPC] Scanning folder for user ${uid}: ${folder}`);
    const indexed = await fileScanner.scanAndIndex({ userId: uid, folderPath: folder });

    // Register folder as monitored
    await pool.query(
      `INSERT INTO indexed_folders (user_id, folder_path, is_active, last_scan)
       VALUES ($1, $2, TRUE, NOW())
       ON CONFLICT (user_id, folder_path)
       DO UPDATE SET last_scan = NOW(), is_active = TRUE`,
      [uid, folder]
    );

    // Start watching folder for live changes
    folderWatcher.watchFolder(folder, uid);

    return { success: true, filesCount: indexed };
  }));

  // 3. Read file content safely
  ipcMain.handle('read-file', guarded(async (_event, { filePath }) => {
    const file = asAbsolutePath(filePath);
    if (!file) return { success: false, error: 'filePath is required' };
    return await fileScanner.readFile(file);
  }));

  // 4. Watch a folder for live changes
  ipcMain.handle('watch-folder', guarded(async (_event, { folderPath, userId }) => {
    const uid = sanitizeUserId(userId);
    const folder = asAbsolutePath(folderPath);

    if (!uid) return { success: false, error: 'A valid userId is required' };
    if (!folder) return { success: false, error: 'folderPath is required' };

    folderWatcher.watchFolder(folder, uid);
    return { success: true };
  }));

  // 5. Search files using hybrid retrieval
  ipcMain.handle('search-files', guarded(async (_event, { userId, query }) => {
    const uid = sanitizeUserId(userId);
    if (!uid) return { success: false, error: 'A valid userId is required' };

    const trimmedQuery = String(query || '').trim();
    const results = await retrieveDocuments({ userId: uid, query: trimmedQuery, limit: 20 });
    return { success: true, results, semantic: true };
  }));

  // Expose backend boot state to the renderer for connection diagnostics.
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('backend-status', { started: backendStarted });
  }
}

module.exports = { setupIpcHandlers };