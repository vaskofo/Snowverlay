import { BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module polyfill for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

export function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 500,
        height: 365,
        minWidth: 280,
        minHeight: 40,
        transparent: true,
        frame: false,
        title: 'BPSR-PSO',
        icon: path.join(__dirname, '..', 'resources', 'ico.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        autoMenuBar: true,
    });

    mainWindow.setAlwaysOnTop(true, 'normal');
    mainWindow.setMovable(true);

    // Load the launcher UI first
    mainWindow.loadFile(path.join(__dirname, './public/index.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    return mainWindow;
}

export const mainWindowRef = () => mainWindow;
