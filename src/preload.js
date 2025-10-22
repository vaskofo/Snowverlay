const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    closeClient: () => ipcRenderer.send('close-client'),
    onTogglePassthrough: (callback) => ipcRenderer.on('passthrough-toggled', (_event, value) => callback(value)),
    onClearDps: (callback) => ipcRenderer.on('clear-dps', () => callback()),
    requestClear: () => ipcRenderer.send('request-clear'),
    toggleGlobalShortcuts: (enabled) => ipcRenderer.send('toggle-global-shortcuts', enabled),
    setWindowSize: (width, height) => ipcRenderer.send('set-window-size', { width, height }),
    onWindowResized: (callback) => ipcRenderer.on('window-resized', (_event, bounds) => callback(bounds)),
    getVersion: () => ipcRenderer.invoke('get-app-version'),
});
