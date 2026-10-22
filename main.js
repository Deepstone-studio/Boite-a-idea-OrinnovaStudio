const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const bcrypt = require('bcryptjs');
const store = require('./store');
const { setupAutoUpdater, forceCheck } = require('./updater');

let currentUser = null;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b1020',
    title: 'Boîte à idées',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  
  mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));
  
  setupAutoUpdater(mainWindow);

  return mainWindow;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const dbPath = path.join(app.getPath('userData'), 'boite-a-idees.db');
  const type = store.initStore(dbPath);
  console.log('Storage backend:', type);
  registerHandlers();
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function registerHandlers() {
  // ---------- AUTH ----------
  ipcMain.handle('auth:register', (event, payload) => {
    const { username, email, password } = payload || {};
    if (!username || !email || !password) return { error: 'Tous les champs sont requis' };
    if (String(username).trim().length < 3) return { error: 'Nom d\'utilisateur : 3 caractères minimum' };
    if (String(password).length < 6) return { error: 'Mot de passe : 6 caractères minimum' };
    
    const hash = bcrypt.hashSync(password, 10);
    try {
      const user = store.createUser(String(username).trim(), String(email).trim().toLowerCase(), hash);
      currentUser = { id: user.id, username: user.username, email: user.email };
      return { user: currentUser };
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      if (msg.includes('UNIQUE')) return { error: 'Nom d\'utilisateur ou email déjà utilisé' };
      console.error(e);
      return { error: 'Erreur serveur' };
    }
  });

  ipcMain.handle('auth:login', (event, payload) => {
    const { email, password } = payload || {};
    if (!email || !password) return { error: 'Email et mot de passe requis' };
    const user = store.findUserByEmail(String(email).trim().toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return { error: 'Identifiants invalides' };
    }
    currentUser = { id: user.id, username: user.username, email: user.email };
    return { user: currentUser };
  });

  ipcMain.handle('auth:me', () => {
    if (!currentUser) return { user: null };
    const user = store.findUserById(currentUser.id);
    return { user: user || null };
  });

  ipcMain.handle('auth:logout', () => {
    currentUser = null;
    return { success: true };
  });

  // ---------- IDEAS ----------
  ipcMain.handle('ideas:list', (event, q) => {
    if (!currentUser) return { error: 'Non autorisé' };
    try {
      const ideas = store.listIdeas(currentUser.id, q || {});
      return { ideas };
    } catch (e) {
      console.error(e);
      return { error: 'Erreur serveur' };
    }
  });

  ipcMain.handle('ideas:create', (event, payload) => {
    if (!currentUser) return { error: 'Non autorisé' };
    const { title } = payload || {};
    if (!title || !String(title).trim()) return { error: 'Le titre est requis' };
    try {
      const idea = store.createIdea(currentUser.id, payload);
      return { idea };
    } catch (e) {
      console.error(e);
      return { error: 'Erreur serveur' };
    }
  });

  ipcMain.handle('ideas:update', (event, payload) => {
    if (!currentUser) return { error: 'Non autorisé' };
    const { id, data } = payload || {};
    try {
      const idea = store.updateIdea(currentUser.id, id, data || {});
      if (!idea) return { error: 'Idée introuvable' };
      return { idea };
    } catch (e) {
      console.error(e);
      return { error: 'Erreur serveur' };
    }
  });

  ipcMain.handle('ideas:delete', (event, id) => {
    if (!currentUser) return { error: 'Non autorisé' };
    try {
      const ok = store.deleteIdea(currentUser.id, id);
      if (!ok) return { error: 'Idée introuvable' };
      return { success: true };
    } catch (e) {
      console.error(e);
      return { error: 'Erreur serveur' };
    }
  });

  ipcMain.handle('ideas:pin', (event, id) => {
    if (!currentUser) return { error: 'Non autorisé' };
    try {
      const pinned = store.pinIdea(currentUser.id, id);
      if (pinned === null) return { error: 'Idée introuvable' };
      return { pinned };
    } catch (e) {
      console.error(e);
      return { error: 'Erreur serveur' };
    }
  });
}