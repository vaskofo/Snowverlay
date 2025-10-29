import express from 'express';
import path from 'path';
import logger from '../services/Logger.js';
import { promises as fsPromises } from 'fs';
import userDataManager from '../services/UserDataManager.js';
import { PacketProcessor } from '../services/PacketProcessor.js';
import { config } from '../config.js';

export function createApiRouter(SETTINGS_PATH, globalSettings = {}) {
    const router = express.Router();

    // Middleware to parse JSON requests
    router.use(express.json());

    // GET all user data
    router.get('/data', (req, res) => {
        const userData = userDataManager.getAllUsersData();
        const meta = userDataManager.getMeta();
        const data = {
            code: 0,
            user: userData,
            meta: { ...meta, paused: !!config.IS_PAUSED },
        };
        res.json(data);
    });

    // GET all enemy data
    router.get('/enemies', (req, res) => {
        const enemiesData = userDataManager.getAllEnemiesData();
        const data = {
            code: 0,
            enemy: enemiesData,
        };
        res.json(data);
    });

    // Clear all statistics
    router.get('/clear', (req, res) => {
        userDataManager.clearAll('manual');
        logger.info('Statistics have been cleared!');
        res.json({
            code: 0,
            msg: 'Statistics have been cleared!',
        });
    });

    // Pause/Resume statistics
    router.post('/pause', (req, res) => {
        const { paused } = req.body || {};
        const next = !!paused;
        config.IS_PAUSED = next;
        logger.info(`Statistics ${next ? 'paused' : 'resumed'}!`);
        res.json({
            code: 0,
            msg: `Statistics ${next ? 'paused' : 'resumed'}!`,
            paused: next,
        });
    });

    // Get pause state
    router.get('/pause', (req, res) => {
        res.json({
            code: 0,
            paused: !!config.IS_PAUSED,
        });
    });

    // Get skill data for a specific user ID
    router.get('/skill/:uid', (req, res) => {
        const uid = parseInt(req.params.uid);
        const skillData = userDataManager.getUserSkillData(uid);

        if (!skillData) {
            return res.status(404).json({
                code: 1,
                msg: 'User not found',
            });
        }

        const meta = userDataManager.getMeta();
        res.json({
            code: 0,
            data: skillData,
            meta: { ...meta, paused: !!config.IS_PAUSED },
        });
    });

    // Get history summary for a specific timestamp
    router.get('/history/:timestamp/summary', async (req, res) => {
        const { timestamp } = req.params;
        const historyFilePath = path.join('./logs', timestamp, 'summary.json');

        try {
            const data = await fsPromises.readFile(historyFilePath, 'utf8');
            const summaryData = JSON.parse(data);
            res.json({
                code: 0,
                data: summaryData,
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn('History summary file not found:', error);
                res.status(404).json({
                    code: 1,
                    msg: 'History summary file not found',
                });
            } else {
                logger.error('Failed to read history summary file:', error);
                res.status(500).json({
                    code: 1,
                    msg: 'Failed to read history summary file',
                });
            }
        }
    });

    // Get history data for a specific timestamp
    router.get('/history/:timestamp/data', async (req, res) => {
        const { timestamp } = req.params;
        const historyFilePath = path.join('./logs', timestamp, 'allUserData.json');

        try {
            const data = await fsPromises.readFile(historyFilePath, 'utf8');
            const userData = JSON.parse(data);
            res.json({
                code: 0,
                user: userData,
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn('History data file not found:', error);
                res.status(404).json({
                    code: 1,
                    msg: 'History data file not found',
                });
            } else {
                logger.error('Failed to read history data file:', error);
                res.status(500).json({
                    code: 1,
                    msg: 'Failed to read history data file',
                });
            }
        }
    });

    // Get history skill data for a specific timestamp and user
    router.get('/history/:timestamp/skill/:uid', async (req, res) => {
        const { timestamp, uid } = req.params;
        const historyFilePath = path.join('./logs', timestamp, 'users', `${uid}.json`);

        try {
            const data = await fsPromises.readFile(historyFilePath, 'utf8');
            const skillData = JSON.parse(data);
            res.json({
                code: 0,
                data: skillData,
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn('History skill file not found:', error);
                res.status(404).json({
                    code: 1,
                    msg: 'History skill file not found',
                });
            } else {
                logger.error('Failed to read history skill file:', error);
                res.status(500).json({
                    code: 1,
                    msg: 'Failed to read history skill file',
                });
            }
        }
    });

    // Download historical fight log
    router.get('/history/:timestamp/download', (req, res) => {
        const { timestamp } = req.params;
        const historyFilePath = path.join('./logs', timestamp, 'fight.log');
        res.download(historyFilePath, `fight_${timestamp}.log`);
    });

    // Get a list of available history timestamps
    router.get('/history/list', async (req, res) => {
        try {
            const data = (await fsPromises.readdir('./logs', { withFileTypes: true }))
                .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
                .map((e) => e.name);
            res.json({
                code: 0,
                data: data,
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn('History path not found:', error);
                res.status(404).json({
                    code: 1,
                    msg: 'History path not found',
                });
            } else {
                logger.error('Failed to load history path:', error);
                res.status(500).json({
                    code: 1,
                    msg: 'Failed to load history path',
                });
            }
        }
    });

    // Get current settings
    router.get('/settings', (req, res) => {
        res.json({ code: 0, data: globalSettings });
    });

    // Get current player UID
    router.get('/current-player', (req, res) => {
        const currentPlayerUid = PacketProcessor.getCurrentPlayerUid();
        res.json({
            code: 0,
            uid: currentPlayerUid,
        });
    });

    // Update settings
    router.post('/settings', async (req, res) => {
        try {
            const newSettings = req.body || {};

            // Basic validation for known settings
            if (newSettings.hideHpsBar !== undefined) {
                newSettings.hideHpsBar = !!newSettings.hideHpsBar;
            }
            if (newSettings.hideMitigationBar !== undefined) {
                newSettings.hideMitigationBar = !!newSettings.hideMitigationBar;
            }
            if (newSettings.windowHeightMode !== undefined) {
                const allowedModes = ['static', 'auto'];
                if (!allowedModes.includes(newSettings.windowHeightMode)) {
                    delete newSettings.windowHeightMode;
                }
            }
            if (newSettings.autoPlayerCount !== undefined) {
                const parsedCount = Number.parseInt(newSettings.autoPlayerCount, 10);
                if (Number.isNaN(parsedCount)) {
                    delete newSettings.autoPlayerCount;
                } else {
                    const clamped = Math.min(24, Math.max(1, parsedCount));
                    newSettings.autoPlayerCount = clamped;
                }
            }

            const clampInt = (v) => (Number.isFinite(v) ? Math.round(v) : null);
            if (newSettings.staticHeightDps !== undefined) {
                const h = clampInt(newSettings.staticHeightDps);
                if (h === null) delete newSettings.staticHeightDps;
                else newSettings.staticHeightDps = Math.max(42, h);
            }
            if (newSettings.staticHeightSettings !== undefined) {
                const h = clampInt(newSettings.staticHeightSettings);
                if (h === null) delete newSettings.staticHeightSettings;
                else newSettings.staticHeightSettings = Math.max(150, h);
            }
            if (newSettings.staticHeightSkills !== undefined) {
                const h = clampInt(newSettings.staticHeightSkills);
                if (h === null) delete newSettings.staticHeightSkills;
                else newSettings.staticHeightSkills = Math.max(150, h);
            }

            // New simple settings
            if (newSettings.useClassColors !== undefined) {
                newSettings.useClassColors = !!newSettings.useClassColors;
            }
            if (newSettings.backgroundOpacity !== undefined) {
                const op = Number.parseFloat(newSettings.backgroundOpacity);
                if (Number.isFinite(op) && op >= 0 && op <= 1) {
                    newSettings.backgroundOpacity = op;
                } else {
                    delete newSettings.backgroundOpacity;
                }
            }
            if (newSettings.enableGlobalShortcuts !== undefined) {
                newSettings.enableGlobalShortcuts = !!newSettings.enableGlobalShortcuts;
            }
            if (newSettings.disableUiFreezeOnInactivity !== undefined) {
                newSettings.disableUiFreezeOnInactivity = !!newSettings.disableUiFreezeOnInactivity;
            }
            if (newSettings.autoClearOnServerChange !== undefined) {
                newSettings.autoClearOnServerChange = !!newSettings.autoClearOnServerChange;
            }
            if (newSettings.autoClearTimeoutSeconds !== undefined) {
                const timeout = Number.parseInt(newSettings.autoClearTimeoutSeconds, 10);
                if (Number.isNaN(timeout) || timeout < 0) {
                    delete newSettings.autoClearTimeoutSeconds;
                } else {
                    newSettings.autoClearTimeoutSeconds = Math.min(300, Math.max(0, timeout));
                }
            }

            if (newSettings.disableUserTimeout !== undefined) {
                newSettings.disableUserTimeout = !!newSettings.disableUserTimeout;
            }

            Object.assign(globalSettings, newSettings);

            // Persist to disk
            await fsPromises.writeFile(SETTINGS_PATH, JSON.stringify(globalSettings, null, 2), 'utf8');

            res.json({ code: 0, data: globalSettings });
        } catch (error) {
            logger.error('Failed to update settings:', error);
            res.status(500).json({ code: 1, msg: 'Failed to update settings' });
        }
    });

    return router;
}
