import { app } from 'electron';
import { createMainWindow, mainWindow } from './window.js';
import path from 'path';
import { exec } from 'child_process';

app.on('ready', async () => {
    try {
        await createMainWindow();
    } catch (error) {
        console.error('Failed to start server:', error);
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', async () => {
    if (mainWindow === null) {
        await createMainWindow();
    }
});
