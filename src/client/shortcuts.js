import { globalShortcut } from 'electron';
import window from './Window.js';

const RESIZE_INCREMENT = 20;
const MOVE_INCREMENT = 20;

export function registerShortcuts() {
    registerPassthrough();
    registerMinimize();
    registerClearDps();
}

function registerPassthrough() {
    globalShortcut.register('Control+Alt+`', () => {
        window.togglePassthrough();
    });
}

export function registerResize() {
    globalShortcut.register('Control+Shift+Up', () => {
        const [width, height] = window.getSize();
        const newHeight = Math.max(40, height - RESIZE_INCREMENT);
        window.setSize(width, newHeight);
    });

    globalShortcut.register('Control+Shift+Down', () => {
        const [width, height] = window.getSize();
        window.setSize(width, height + RESIZE_INCREMENT);
    });

    globalShortcut.register('Control+Shift+Left', () => {
        const [width, height] = window.getSize();
        const newWidth = Math.max(280, width - RESIZE_INCREMENT);
        window.setSize(newWidth, height);
    });

    globalShortcut.register('Control+Shift+Right', () => {
        const [width, height] = window.getSize();
        window.setSize(width + RESIZE_INCREMENT, height);
    });
}

export function registerMove() {
    globalShortcut.register('Control+Alt+Up', () => {
        const [x, y] = window.getPosition();
        window.setPosition(x, y - MOVE_INCREMENT);
    });

    globalShortcut.register('Control+Alt+Down', () => {
        const [x, y] = window.getPosition();
        window.setPosition(x, y + MOVE_INCREMENT);
    });

    globalShortcut.register('Control+Alt+Left', () => {
        const [x, y] = window.getPosition();
        window.setPosition(x - MOVE_INCREMENT, y);
    });

    globalShortcut.register('Control+Alt+Right', () => {
        const [x, y] = window.getPosition();
        window.setPosition(x + MOVE_INCREMENT, y);
    });
}

function registerMinimize() {
    globalShortcut.register('Control+Alt+Z', () => {
        window.minimizeOrRestore();
    });
}

function registerClearDps() {
    globalShortcut.register('Control+Alt+C', () => {
        try {
            const win = window.getWindow();
            if (win && win.webContents) {
                win.webContents.send('clear-dps');
            }
        } catch (err) {
            console.error('Failed to send clear-dps to renderer', err);
        }
    });
}
