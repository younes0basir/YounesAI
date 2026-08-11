const { ipcMain, dialog } = require('electron');
const path = require('path');
const fileScanner = require('../../backend/src/desktop/fileScanner');
const folderWatcher = require('../../backend/src/desktop/folderWatcher');
const { retrieveDocuments } = require('../../backend/src/retrieval/retrieveDocuments');
const pool = require('../../backend/src/db');

function setupIpcHandlers(mainWindow) {
  // 1. Select Folder dialog
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, cancelled: true };
    }
    
    return { success: true, folderPath: result.filePaths[0] };
  });

  // 2. Scan folder recursively
  ipcMain.handle('scan-folder', async (event, { folderPath, userId }) => {
    try {
      if (!folderPath || !userId) {
        return { success: false, error: 'folderPath and userId are required' };
      }

      const pathVal = path.resolve(folderPath);

      // Scan, register in files table, and trigger processing
      const indexed = await fileScanner.scanAndIndex({ userId, folderPath: pathVal });

      // Register folder as monitored
      await pool.query(
        `INSERT INTO indexed_folders (user_id, folder_path, is_active, last_scan)
         VALUES ($1, $2, TRUE, NOW())
         ON CONFLICT (user_id, folder_path) 
         DO UPDATE SET last_scan = NOW(), is_active = TRUE`,
        [userId, pathVal]
      );

      // Start watching folder for live changes
      folderWatcher.watchFolder(pathVal, userId);

      return { success: true, filesCount: indexed };
    } catch (error) {
      console.error('IPC scan-folder error:', error);
      return { success: false, error: error.message };
    }
  });

  // 3. Read file content safely
  ipcMain.handle('read-file', async (event, { filePath }) => {
    try {
      if (!filePath) return { success: false, error: 'filePath is required' };
      // basic path safety
      const pathVal = path.resolve(filePath);
      return await fileScanner.readFile(pathVal);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 4. Watch folder
  ipcMain.handle('watch-folder', async (event, { folderPath, userId }) => {
    try {
      if (!folderPath || !userId) return { success: false, error: 'folderPath and userId are required' };
      const pathVal = path.resolve(folderPath);
      folderWatcher.watchFolder(pathVal, userId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 5. Search files using hybrid retrieval
  ipcMain.handle('search-files', async (event, { userId, query }) => {
    try {
      if (!userId) return { success: false, error: 'userId is required' };
      const trimmedQuery = String(query || '').trim();
      const results = await retrieveDocuments({ userId, query: trimmedQuery, limit: 20 });
      return { success: true, results, semantic: true };
    } catch (error) {
      console.error('IPC search-files error:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { setupIpcHandlers };
