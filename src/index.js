import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import { createMainWindow } from './window.js';
import server from './server.js';

let mainWindow;
// A state variable to track the pass-through status
let isIgnoringMouseEvents = false;

async function initialize() {
    if (process.platform === 'win32') {
        app.setAppUserModelId(app.name);
    }

    mainWindow = createMainWindow();

    mainWindow.on('ready-to-show', () => {
        mainWindow.show();
    });

    const passThroughShortcut = 'Control+`';
    const ret = globalShortcut.register(passThroughShortcut, () => {
        isIgnoringMouseEvents = !isIgnoringMouseEvents;

        if (isIgnoringMouseEvents) {
            mainWindow.setIgnoreMouseEvents(true, { forward: true });
            console.log('Mouse events are now being ignored (pass-through enabled).');
        } else {
            mainWindow.setIgnoreMouseEvents(false);
            console.log('Mouse events are now being captured (pass-through disabled).');
        }
        // Send a message to the renderer process with the current state
        mainWindow.webContents.send('passthrough-toggled', isIgnoringMouseEvents);
    });

    if (!ret) {
        console.error(`Failed to register global shortcut: ${passThroughShortcut}`);
    }

    // --- Window Resize Shortcuts ---
    const resizeIncrement = 20; // pixels to resize by

    globalShortcut.register('Control+Up', () => {
        const [width, height] = mainWindow.getSize();
        // Prevent window from becoming too small (inverted)
        const newHeight = Math.max(40, height - resizeIncrement);
        mainWindow.setSize(width, newHeight);
    });

    globalShortcut.register('Control+Down', () => {
        const [width, height] = mainWindow.getSize();
        // Inverted arrow - increases height
        mainWindow.setSize(width, height + resizeIncrement);
    });

    globalShortcut.register('Control+Left', () => {
        const [width, height] = mainWindow.getSize();
        // Prevent window from becoming too small
        const newWidth = Math.max(280, width - resizeIncrement);
        mainWindow.setSize(newWidth, height);
    });

    globalShortcut.register('Control+Right', () => {
        const [width, height] = mainWindow.getSize();
        mainWindow.setSize(width + resizeIncrement, height);
    });
    // --- End of Resize Shortcuts ---

    // --- Window Move Shortcuts ---
    const moveIncrement = 20; // pixels to move by

    globalShortcut.register('Control+Alt+Up', () => {
        const [x, y] = mainWindow.getPosition();
        mainWindow.setPosition(x, y - moveIncrement);
    });

    globalShortcut.register('Control+Alt+Down', () => {
        const [x, y] = mainWindow.getPosition();
        mainWindow.setPosition(x, y + moveIncrement);
    });

    globalShortcut.register('Control+Alt+Left', () => {
        const [x, y] = mainWindow.getPosition();
        mainWindow.setPosition(x - moveIncrement, y);
    });

    globalShortcut.register('Control+Alt+Right', () => {
        const [x, y] = mainWindow.getPosition();
        mainWindow.setPosition(x + moveIncrement, y);
    });
    // --- End of Move Shortcuts ---

    ipcMain.on('close-client', (event) => {
        app.quit();
    });

    try {
        console.log('[Main Process] Attempting to start server automatically...');
        const serverUrl = await server.start();

        console.log(`[Main Process] Server started. Loading URL: ${serverUrl}`);
        mainWindow.loadURL(serverUrl);
    } catch (error) {
        console.error('[Main Process] CRITICAL: Failed to start server:', error);
        app.quit();
    }
}

app.on('ready', initialize);

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

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
