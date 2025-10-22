import { app, ipcMain, globalShortcut } from 'electron';
import window from './Window.js';

ipcMain.on('close-client', (event) => {
    app.quit();
});

ipcMain.on('toggle-global-shortcuts', (event, enabled) => {
    if (enabled) {
        import('./shortcuts.js').then(({ registerMove, registerResize }) => {
            registerMove();
            registerResize();
        });
    } else {
        globalShortcut.unregister('Control+Shift+Up');
        globalShortcut.unregister('Control+Shift+Down');
        globalShortcut.unregister('Control+Shift+Left');
        globalShortcut.unregister('Control+Shift+Right');
        globalShortcut.unregister('Control+Alt+Up');
        globalShortcut.unregister('Control+Alt+Down');
        globalShortcut.unregister('Control+Alt+Left');
        globalShortcut.unregister('Control+Alt+Right');
    }
});

ipcMain.on('set-window-size', (event, payload = {}) => {
    try {
        const win = window.getWindow?.();
        if (!win) {
            return;
        }

        const currentBounds = win.getBounds();
        const [minWidth, minHeight] = win.getMinimumSize();

        const requestedWidth =
            typeof payload.width === 'number' && !Number.isNaN(payload.width)
                ? Math.max(minWidth, Math.round(payload.width))
                : currentBounds.width;
        const requestedHeight =
            typeof payload.height === 'number' && !Number.isNaN(payload.height)
                ? Math.max(minHeight, Math.round(payload.height))
                : currentBounds.height;

        if (requestedWidth === currentBounds.width && requestedHeight === currentBounds.height) {
            return;
        }

        win.setSize(requestedWidth, requestedHeight);
    } catch (error) {
        console.error('Failed to resize window from renderer request:', error);
    }
});

// Version query for renderer
ipcMain.handle('get-app-version', () => {
    try {
        return app.getVersion?.() || '';
    } catch (e) {
        return '';
    }
});
