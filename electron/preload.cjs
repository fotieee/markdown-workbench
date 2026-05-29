const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('markdownApi', {
  openFile: () => ipcRenderer.invoke('markdown:openFile'),
  openFolder: () => ipcRenderer.invoke('markdown:openFolder'),
  readPath: (filePath) => ipcRenderer.invoke('markdown:readPath', filePath),
  readFolderPath: (folderPath) => ipcRenderer.invoke('markdown:readFolderPath', folderPath),
  setNativeTheme: (themeName) => ipcRenderer.invoke('markdown:setNativeTheme', themeName),
  openExternal: (linkHref) => ipcRenderer.invoke('markdown:openExternal', linkHref),
  showContextMenu: (context) => ipcRenderer.invoke('markdown:showContextMenu', context),
  onMenuCommand: (callback) => {
    const listener = (_event, command, payload) => callback(command, payload);
    ipcRenderer.on('menu:command', listener);
    return () => ipcRenderer.removeListener('menu:command', listener);
  }
});
