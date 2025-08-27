/**
 * @file Main process script for a small, always-on-top Electron utility window.
 * @description
 * This script creates a simple, frameless, and always-on-top window that can be
 * dragged by the user. It is no longer tied to a specific game process.
 */

import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
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
      devTools: false
    },
    autoHideMenuBar: true,
  });

  mainWindow.setAlwaysOnTop(true, 'normal');
  mainWindow.setMovable(true);
  
  // This function is for handling environment-specific tools like DevTools.
  const handleEnvironmentTools = () => {
      Menu.setApplicationMenu(null);
  };

  // ----------------------------------------------------------------------
  // MODIFIED SECTION
  // The primary goal is to load the local server URL first.
  // The local index.html is now the fallback.
  // ----------------------------------------------------------------------
  const indexPath = path.join(__dirname, 'index.html');

  // Attempt to load the local server URL first.
  mainWindow.loadURL(APP_URL)
    .then(() => {
      // If successful, handle tools and return.
      handleEnvironmentTools();
    })
    .catch((error) => {
      // If the server fails to load, try the local index.html as a fallback.
      console.error(`[Electron] Failed to load ${APP_URL}:`, error.message);
      
      mainWindow.loadFile(indexPath)
        .then(() => {
          handleEnvironmentTools();
        });
    });

  // ----------------------------------------------------------------------
  // END OF MODIFIED SECTION
  // ----------------------------------------------------------------------

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}
