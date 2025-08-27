/**
 * @file Main process script for a small, always-on-top Electron utility window.
 * @description
 * This script creates a simple, frameless, and always-on-top window that can be
 * dragged by the user. It is no longer tied to a specific game process.
 */

import { app, BrowserWindow, Menu, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

export let mainWindow;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_URL = "http://localhost:8990";
const IS_DEV = true; // Use an environment variable in a real app

/**
 * Creates the main application window.
 * This function creates a small, frameless, and always-on-top window.
 */
export async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 500,        // Set a small, fixed width
    height: 360,       // Set a small, fixed height
    transparent: true, // Enable transparency
    frame: false,      // Remove the window frame for a custom look
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    autoHideMenuBar: true,
  });

  mainWindow.setAlwaysOnTop(true, 'normal');
  mainWindow.setMovable(true);
  
  const handleEnvironmentTools = () => {
    if (IS_DEV) {
      mainWindow?.webContents.openDevTools();
    } else {
      Menu.setApplicationMenu(null);
    }
  };

  mainWindow.loadURL(APP_URL)
    .then(async () => {
      await session.defaultSession.clearCache();
      mainWindow?.webContents.reloadIgnoringCache();
      handleEnvironmentTools();
    })
    .catch((error) => {
      console.error(`[Electron] Failed to load ${APP_URL}:`, error.message);
      const errorHtmlPath = path.join(__dirname, 'error.html');
      if (fs.existsSync(errorHtmlPath)) {
        mainWindow?.loadFile(errorHtmlPath)
          .then(() => {
            handleEnvironmentTools();
          })
          .catch((loadError) => {
            console.error(`[Electron] Failed to load fallback error page:`, loadError.message);
            mainWindow?.loadURL('about:blank');
          });
      } else {
        console.error(`[Electron] Fallback error.html not found at: ${errorHtmlPath}. Loading blank page.`);
        mainWindow?.loadURL('about:blank');
      }
    });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}
