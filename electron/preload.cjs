const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openFolderDialog: () => ipcRenderer.invoke('dialog:open-folder'),
  readDirectory: (dirPath) => ipcRenderer.invoke('folder:read-path', dirPath),
  downloadUrl: (url, filename) => ipcRenderer.invoke('download:file', { url, filename }),
})
