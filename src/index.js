/*
================================================================================
| FILENAME: index.js (Your main Electron process, inside src/)
| DESCRIPTION:
| This script automatically starts the backend server when the app is ready,
| and then loads the application's UI from that server.
================================================================================
*/
import { app, BrowserWindow, ipcMain } from 'electron';
import { startServer } from './server.js'; 
import { createMainWindow } from './window.js';

let mainWindow;

// This function will be called once the app is ready
async function initialize() {
    if (process.platform === 'win32') {
    app.setAppUserModelId(app.name);
    }
    
    mainWindow = createMainWindow();
    // This event prevents a blank white screen from showing during startup.
    mainWindow.on('ready-to-show', () => {
        mainWindow.show();
    });

    ipcMain.on('close-client', (event) => {
        app.quit();
    });

    try {
        console.log('[Main Process] Attempting to start server automatically...');
        // Call the server with the 'auto' and 'info' parameters directly
        const serverUrl = await startServer('auto', 'info');
        
        console.log(`[Main Process] Server started. Loading URL: ${serverUrl}`);
        mainWindow.loadURL(serverUrl);

    } catch (error) {
        console.error('[Main Process] CRITICAL: Failed to start server:', error);
        // If the server fails, you can load a local error page or just quit.
        // For example: mainWindow.loadFile('error.html');
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
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        initialize();
    }
});
