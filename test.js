console.log('starting');
const { app } = require('electron');
app.whenReady().then(() => {
  console.log('ready');
  try {
    const D = require('better-sqlite3');
    console.log('required', typeof D);
  } catch (e) {
    console.error('ERR', e && e.stack ? e.stack : e);
    require('fs').writeFileSync('crash.log', String(e && e.stack ? e.stack : e));
  }
  app.quit();
});
