import cors from 'cors';
import express from 'express';
import http from 'http';
import net from 'net';
import path from 'path';
import fsPromises from 'fs/promises';
import { fileURLToPath } from 'url';
import { createApiRouter } from './routes/api.js';
import { PacketInterceptor } from './services/PacketInterceptor.js';
import userDataManager from './services/UserDataManager.js';
import socket from './services/Socket.js';
import logger from './services/Logger.js';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SETTINGS_PATH = path.join(__dirname, 'settings.json');
const globalSettings = config.GLOBAL_SETTINGS;

class Server {
    start = async () =>
        new Promise(async (resolve, reject) => {
            try {
                this.resolve = resolve;
                this.reject = reject;

                await this._loadGlobalSettings();

                const app = express();
                app.use(cors());
                app.use(express.static(path.join(__dirname, 'public')));

                const apiRouter = createApiRouter(SETTINGS_PATH, globalSettings);
                app.use('/api', apiRouter);

                this.server = http.createServer(app);
                this.server.on('error', (err) => reject(err));

                socket.init(this.server);
                userDataManager.init();

                this._configureProcessEvents();
                this._configureSocketEmitter();
                this._configureSocketListener();
                await this._startPacketInterceptor();
            } catch (error) {
                console.error('Error during server startup:', error);
                reject(error);
            }
        });

    _configureProcessEvents() {
        process.on('SIGINT', () => {
            userDataManager.forceUserCacheSave().then(() => {
                process.exit(0);
            });
        });
        process.on('SIGTERM', () => {
            userDataManager.forceUserCacheSave().then(() => {
                process.exit(0);
            });
        });
    }

    _configureSocketEmitter() {
        setInterval(() => {
            userDataManager.updateAllRealtimeDps();
            const userData = userDataManager.getAllUsersData();
            const meta = userDataManager.getMeta();
            socket.emit('data', {
                code: 0,
                user: userData,
                meta: { ...meta, paused: !!config.IS_PAUSED, backgroundOpacity: globalSettings.backgroundOpacity },
            });
        }, 100);
    }

    _configureSocketListener() {
        socket.on('connection', (sock) => {
            logger.info(`WebSocket client connected: ${sock.id}`);
            sock.on('disconnect', () => {
                logger.info(`WebSocket client disconnected: ${sock.id}`);
            });
        });
    }

    async _startPacketInterceptor() {
        const checkPort = (port) =>
            new Promise((resolve) => {
                const s = net.createServer();
                s.once('error', () => resolve(false));
                s.once('listening', () => s.close(() => resolve(true)));
                s.listen(port);
            });

        let server_port = 8990;
        while (!(await checkPort(server_port))) {
            logger.warn(`port ${server_port} is already in use`);
            server_port++;
        }

        PacketInterceptor.start(this.server, server_port, this.resolve, this.reject);
    }

    async _loadGlobalSettings() {
        try {
            const data = await fsPromises.readFile(SETTINGS_PATH, 'utf8');
            const loaded = JSON.parse(data);
            Object.assign(globalSettings, loaded);
        } catch (e) {
            if (e.code !== 'ENOENT') {
                logger.error('Failed to load settings:', e);
            }
        }
    }
}

const server = new Server();
export default server;
