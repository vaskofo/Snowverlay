/*
================================================================================
| FILENAME: preload.js (The secure bridge)
| DESCRIPTION:
| This script is kept for good practice. You can use it to expose secure
| functions from the main process to your UI if needed in the future.
================================================================================
*/
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld('electronAPI', {
    closeClient: () => ipcRenderer.send('close-client'),
});

