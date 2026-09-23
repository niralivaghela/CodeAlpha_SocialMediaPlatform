/**
 * VIBELY Desktop Preload Script
 * Secure contextBridge exposing strictly approved native desktop capabilities.
 * Fully compliant with Electron Sandboxing and Context Isolation.
 */
const { contextBridge, ipcRenderer } = require('electron');

// Safe Desktop API exposed to Renderer
contextBridge.exposeInMainWorld('vibelyDesktop', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizeChange: (callback) => {
    ipcRenderer.on('window-maximized-change', (_event, isMax) => callback(isMax));
  },
  openExternal: (url) => ipcRenderer.send('open-external', url),
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  retryConnection: () => ipcRenderer.send('retry-connection'),
  showNotification: (options) => ipcRenderer.send('show-notification', options),
  platform: process.platform,
  version: '1.0.0',
});
