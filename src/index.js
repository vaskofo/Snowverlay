import { app, BrowserWindow, ipcMain } from 'electron';
import { startServer } from './server.js';
import { createMainWindow } from './window.js';

let mainWindow;

async function initialize() {
    if (process.platform === 'win32') {
        app.setAppUserModelId(app.name);
    }

    mainWindow = createMainWindow();

    mainWindow.on('ready-to-show', () => {
        mainWindow.show();
    });

    ipcMain.on('close-client', (event) => {
        app.quit();
    });

    try {
        console.log('[Main Process] Attempting to start server automatically...');
        const serverUrl = await startServer('auto', 'info');

        console.log(`[Main Process] Server started. Loading URL: ${serverUrl}`);
        mainWindow.loadURL(serverUrl);
    } catch (error) {
        console.error('[Main Process] CRITICAL: Failed to start server:', error);
        app.quit();
    }
}

app.on('ready', initialize);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        initialize();
    }
});
