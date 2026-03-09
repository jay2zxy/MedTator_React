const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'public', 'vite.svg'),
  });

  // Ask renderer if there are unsaved files before closing
  win.on('close', async (e) => {
    e.preventDefault();
    const hasUnsaved = await win.webContents.executeJavaScript(
      'window.__hasUnsavedAnns ? window.__hasUnsavedAnns() : false'
    );
    if (hasUnsaved) {
      const { response } = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: ['Close without Saving', 'Cancel'],
        defaultId: 1,
        title: 'Unsaved Changes',
        message: 'There are unsaved annotation files. Close anyway?',
      });
      if (response === 0) {
        win.destroy();
      }
      // response === 1 → Cancel, do nothing
    } else {
      win.destroy();
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
