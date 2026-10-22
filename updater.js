const { autoUpdater } = require('electron-updater');
const { BrowserWindow, dialog } = require('electron');
const log = require('electron-log'); // optionnel mais recommandé

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

let mainWindow = null;

function setupAutoUpdater(win) {
  mainWindow = win;

  // Vérifier au démarrage
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Vérification des mises à jour...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`[Updater] Mise à jour disponible: ${info.version}`);
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] Aucune mise à jour disponible');
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Erreur:', err.message);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const msg = `Téléchargement: ${Math.round(progressObj.percent)}%`;
    console.log(`[Updater] ${msg}`);
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', progressObj.percent);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[Updater] Mise à jour téléchargée: ${info.version}`);
    
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Mise à jour disponible',
      message: `La version ${info.version} a été téléchargée.`,
      detail: 'L\'application va redémarrer pour appliquer la mise à jour.',
      buttons: ['Redémarrer maintenant', 'Plus tard'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });
}

// Force check manuel (appelable depuis le renderer)
function forceCheck() {
  autoUpdater.checkForUpdatesAndNotify();
}

module.exports = { setupAutoUpdater, forceCheck };