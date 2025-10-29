import { BrowserWindow, screen } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const preloadPath = path.join(__dirname, '../preload.js');
const skillHtmlPath = path.join(__dirname, '../public/skill.html');

class SkillWindows {
    constructor() {
        /** @type {Map<number, BrowserWindow>} */
        this.windows = new Map();
    }

    /**
     * Open a per-user skill breakdown window. If one already exists for the uid, focus it.
     * @param {number} uid
     */
    open(uid) {
        const key = Number(uid);
        if (this.windows.has(key)) {
            const win = this.windows.get(key);
            if (win && !win.isDestroyed()) {
                win.show();
                win.focus();
                return win;
            }
            this.windows.delete(key);
        }

        const win = new BrowserWindow({
            show: false,
            useContentSize: true,
            width: 520,
            height: 600,
            minWidth: 420,
            minHeight: 300,
            transparent: true,
            frame: false,
            title: `Skills - ${key}`,
            webPreferences: {
                preload: preloadPath,
                contextIsolation: true,
                nodeIntegration: false,
            },
            autoMenuBar: true,
        });

        win.loadFile(skillHtmlPath, { query: { uid: String(key) } });

        win.webContents.once('did-finish-load', async () => {
            try {
                const size = await win.webContents.executeJavaScript(`(function(){
                    const body=document.body, html=document.documentElement;
                    const w = Math.max(body.scrollWidth, body.offsetWidth, html.clientWidth, html.scrollWidth, html.offsetWidth);
                    const h = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
                    return {w,h};
                })();`);

                const padding = 24;
                const desiredW = Math.ceil(size && size.w ? size.w + padding : 520);
                const desiredH = Math.ceil(size && size.h ? size.h + padding : 600);

                const display = screen.getDisplayMatching(win.getBounds());
                const maxW = Math.max(300, Math.min(display.workArea.width - 40, 1400));
                const maxH = Math.max(200, Math.min(display.workArea.height - 40, 1200));

                const finalW = Math.max(win.getMinimumSize()[0] || 420, Math.min(desiredW, maxW));
                const finalH = Math.max(win.getMinimumSize()[1] || 300, Math.min(desiredH, maxH));

                try {
                    win.setContentSize(finalW, finalH);
                } catch (e) {
                    win.setSize(finalW, finalH);
                }
            } catch (err) {
                console.warn('Skill window auto-size failed:', err && err.message);
            }

            win.setAlwaysOnTop(true, 'normal');
            win.setMovable(true);
            win.show();
        });

        win.on('closed', () => {
            this.windows.delete(key);
        });

        this.windows.set(key, win);
        return win;
    }
}

const skillWindows = new SkillWindows();
export default skillWindows;
