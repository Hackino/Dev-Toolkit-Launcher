import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { registerServiceIpc } from './ipc/services';
import { registerWorkspacesIpc } from './ipc/workspaces';
import { attachToWindow, stopAllSync } from './process-manager';
import { getDb, closeDb } from './db/database';

const DEV_SERVER = process.env.ELECTRON_RENDERER_URL;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  if (DEV_SERVER) {
    mainWindow.loadURL(DEV_SERVER);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  attachToWindow(mainWindow);
}

app.whenReady().then(() => {
  // Initialize DB (runs migrations if needed)
  getDb();

  ipcMain.handle('app:relaunch', () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle('app:openExternal', (_e, url: string) => shell.openExternal(url));

  registerServiceIpc();
  registerWorkspacesIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopAllSync();
  closeDb();
});
