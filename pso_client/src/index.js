import { app } from 'electron';
import { createMainWindow, mainWindow } from './window.js';
import path from 'path';
import { exec } from 'child_process';

app.on('ready', async () => {
    try {
        startServer();
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

function startServer() {
  // Use path.join to create a cross-platform path to the server executable.
  // We assume the executable is named 'server_executable' and is bundled at the app root.
  const serverPath = path.join(app.getAppPath(), 'star-resonance-damage-counter.exe');
  const args = ['auto', 'info'];

  exec(`${serverPath} ${args.join(' ')}`, (error, stdout, stderr) => {
    // This callback is executed when the process exits.
    if (error) {
      console.error(`Server process error: ${error.message}`);
      return;
    }
    if (stdout) {
      console.log(`Server stdout: ${stdout}`);
    }
    if (stderr) {
      console.error(`Server stderr: ${stderr}`);
    }
  });
}