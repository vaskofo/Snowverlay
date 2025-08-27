/*
================================================================================
| FILENAME: preload.js (The secure bridge)
| DESCRIPTION:
| This script is kept for good practice. You can use it to expose secure
| functions from the main process to your UI if needed in the future.
================================================================================
*/
const { contextBridge } = require('electron');

// No APIs need to be exposed for the automatic startup flow.
contextBridge.exposeInMainWorld('electronAPI', {
  // Example: you could add a function to close the app from a UI button
  // closeApp: () => ipcRenderer.send('close-app')
});
