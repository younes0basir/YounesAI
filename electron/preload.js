const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFolder: (path) => ipcRenderer.invoke('scan-folder', path),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  watchFolder: (path) => ipcRenderer.invoke('watch-folder', path),
  searchFiles: (query) => ipcRenderer.invoke('search-files', query)
});
