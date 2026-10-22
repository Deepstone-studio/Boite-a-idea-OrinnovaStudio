const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Auth
  register: (data) => ipcRenderer.invoke('auth:register', data),
  login: (data) => ipcRenderer.invoke('auth:login', data),
  me: () => ipcRenderer.invoke('auth:me'),
  logout: () => ipcRenderer.invoke('auth:logout'),

  // Ideas
  listIdeas: (q) => ipcRenderer.invoke('ideas:list', q),
  createIdea: (data) => ipcRenderer.invoke('ideas:create', data),
  updateIdea: (id, data) => ipcRenderer.invoke('ideas:update', { id, data }),
  deleteIdea: (id) => ipcRenderer.invoke('ideas:delete', id),
  pinIdea: (id) => ipcRenderer.invoke('ideas:pin', id),

  // Updater
  checkUpdate: () => ipcRenderer.invoke('updater:check'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, info) => cb(info)),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_, percent) => cb(percent)),
});