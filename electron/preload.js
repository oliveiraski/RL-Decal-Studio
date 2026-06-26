const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rlAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('win-minimize'),
  maximize: () => ipcRenderer.send('win-maximize'),
  close:    () => ipcRenderer.send('win-close'),

  // RL path
  detectRLPath: () => ipcRenderer.invoke('detect-rl-path'),
  browseRLPath: () => ipcRenderer.invoke('browse-rl-path'),

  // Mod operations
  applyMod:   (args) => ipcRenderer.invoke('apply-mod', args),
  restoreMod: (args) => ipcRenderer.invoke('restore-mod', args),

  // Auto updater
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (_e, data) => cb(data)),
  installUpdate:  () => ipcRenderer.send('install-update'),
});
