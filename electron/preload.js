const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFolder: (payload) => ipcRenderer.invoke('scan-folder', payload),
  readFile: (filePath) => ipcRenderer.invoke('read-file', { filePath }),
  watchFolder: (folderPath, userId) => ipcRenderer.invoke('watch-folder', { folderPath, userId }),
  searchFiles: (userId, query) => ipcRenderer.invoke('search-files', { userId, query }),
});