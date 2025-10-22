import { UserData } from '../models/UserData.js';
import { Lock } from '../models/Lock.js';
import { config } from '../config.js';
import socket from './Socket.js';
import logger from './Logger.js';
import fsPromises from 'fs/promises';
import path from 'path';

class UserDataManager {
    constructor() {
        this.users = new Map();
        this.userCache = new Map();
        this.cacheFilePath = './users.json';

        this.saveThrottleDelay = 2000;
        this.saveThrottleTimer = null;
        this.pendingSave = false;

        this.hpCache = new Map();
        this.startTime = Date.now();

        this.logLock = new Lock();
        this.logDirExist = new Set();

        this.enemyCache = {
            name: new Map(),
            hp: new Map(),
            maxHp: new Map(),
        };

        this.lastAutoSaveTime = 0;
        this.lastLogTime = 0;
        // Group activity clock: paused when no one deals DPS, resumes when any DPS occurs
        this.groupStartTimeMs = Date.now();
        this.groupEffectiveElapsedMs = 0; // accumulates only while group considered "active"
        this.lastGroupActiveAtMs = 0; // last time any DPS occurred
        this._lastGroupTickMs = Date.now();
        this.inactivityGraceMs = 5000; // matches frontend INACTIVITY_GRACE_MS
        setInterval(() => {
            if (this.lastLogTime < this.lastAutoSaveTime) return;
            this.lastAutoSaveTime = Date.now();
            this.saveAllUserData();
        }, 10 * 1000);

        setInterval(() => {
            this.cleanUpInactiveUsers();
        }, 30 * 1000);

        this.timeoutCheckInterval = setInterval(() => {
            try {
                this.checkTimeoutClear();
            } catch (error) {
                logger.warn('Timeout clear check failed: ' + error.message);
            }
        }, 1000);
    }

    cleanUpInactiveUsers() {
        const inactiveThreshold = 60 * 1000;
        const currentTime = Date.now();

        for (const [uid, user] of this.users.entries()) {
            if (currentTime - user.lastUpdateTime > inactiveThreshold) {
                socket.emit('user_deleted', { uid });

                this.users.delete(uid);
                logger.info(`Removed inactive user with uid ${uid}`);
            }
        }
    }

    async init() {
        await this.loadUserCache();
    }

    async loadUserCache() {
        try {
            await fsPromises.access(this.cacheFilePath);
            const data = await fsPromises.readFile(this.cacheFilePath, 'utf8');
            const cacheData = JSON.parse(data);
            this.userCache = new Map(Object.entries(cacheData));
            logger.info(`Loaded ${this.userCache.size} user cache entries`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger.error('Failed to load user cache:', error);
            }
        }
    }

    async saveUserCache() {
        try {
            const cacheData = Object.fromEntries(this.userCache);
            await fsPromises.writeFile(this.cacheFilePath, JSON.stringify(cacheData, null, 2), 'utf8');
        } catch (error) {
            logger.error('Failed to save user cache:', error);
        }
    }

    saveUserCacheThrottled() {
        this.pendingSave = true;
        if (this.saveThrottleTimer) {
            clearTimeout(this.saveThrottleTimer);
        }
        this.saveThrottleTimer = setTimeout(async () => {
            if (this.pendingSave) {
                await this.saveUserCache();
                this.pendingSave = false;
                this.saveThrottleTimer = null;
            }
        }, this.saveThrottleDelay);
    }

    async forceUserCacheSave() {
        await this.saveAllUserData(this.users, this.startTime);
        if (this.saveThrottleTimer) {
            clearTimeout(this.saveThrottleTimer);
            this.saveThrottleTimer = null;
        }
        if (this.pendingSave) {
            await this.saveUserCache();
            this.pendingSave = false;
        }
    }

    getUser(uid) {
        if (!this.users.has(uid)) {
            const user = new UserData(uid);
            const cachedData = this.userCache.get(String(uid));
            if (cachedData) {
                if (cachedData.name) {
                    user.setName(cachedData.name);
                }
                if (cachedData.profession) {
                    user.setProfession(cachedData.profession);
                }
                if (cachedData.fightPoint !== undefined && cachedData.fightPoint !== null) {
                    user.setFightPoint(cachedData.fightPoint);
                }
                if (cachedData.maxHp !== undefined && cachedData.maxHp !== null) {
                    user.setAttrKV('max_hp', cachedData.maxHp);
                }
            }
            if (this.hpCache.has(uid)) {
                user.setAttrKV('hp', this.hpCache.get(uid));
            }
            this.users.set(uid, user);
        }
        return this.users.get(uid);
    }

    addDamage(uid, skillId, element, damage, isCrit, isLucky, isCauseLucky, hpLessenValue = 0, targetUid) {
        if (config.IS_PAUSED) return;
        if (config.GLOBAL_SETTINGS.onlyRecordEliteDummy && targetUid !== 75) return;
        this.checkTimeoutClear();
        // Mark group as active (DPS happened now)
        this.lastGroupActiveAtMs = Date.now();
        const user = this.getUser(uid);
        // logger.info(`User ${uid} used skill ${skillId} dealing ${damage} ${element} damage${isCrit ? ' (crit)' : ''}${isLucky ? ' (lucky)' : ''}${isCauseLucky ? ' (cause lucky)' : ''}${hpLessenValue ? `, HP lessen value: ${hpLessenValue}` : ''}`);
        user.addDamage(skillId, element, damage, isCrit, isLucky, isCauseLucky, hpLessenValue);
    }

    addHealing(uid, skillId, element, healing, isCrit, isLucky, isCauseLucky, targetUid) {
        if (config.IS_PAUSED) return;
        this.checkTimeoutClear();
        if (uid !== 0) {
            const user = this.getUser(uid);
            user.addHealing(skillId, element, healing, isCrit, isLucky, isCauseLucky);
        }
    }

    addTakenDamage(uid, damage, isDead) {
        if (config.IS_PAUSED) return;
        this.checkTimeoutClear();
        const user = this.getUser(uid);
        user.addTakenDamage(damage, isDead);
    }

    addMitigatedDamage(uid, mitigatedDamage) {
        if (config.IS_PAUSED) return;
        this.checkTimeoutClear();
        const user = this.getUser(uid);
        user.addMitigatedDamage(mitigatedDamage);
    }

    async addLog(log) {
        if (config.IS_PAUSED) return;

        // If debug logs are disabled, skip persistent logging to disk.
        if (!config.ENABLE_DEBUG_LOGS) {
            this.lastLogTime = Date.now();
            return;
        }

        const logDir = path.join('./logs', String(this.startTime));
        const logFile = path.join(logDir, 'fight.log');
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${log}\n`;

        this.lastLogTime = Date.now();

        await this.logLock.acquire();
        try {
            if (!this.logDirExist.has(logDir)) {
                try {
                    await fsPromises.access(logDir);
                } catch (error) {
                    await fsPromises.mkdir(logDir, { recursive: true });
                }
                this.logDirExist.add(logDir);
            }
            await fsPromises.appendFile(logFile, logEntry, 'utf8');
        } catch (error) {
            logger.error('Failed to save log:', error);
        }
        this.logLock.release();
    }

    setProfession(uid, profession) {
        const user = this.getUser(uid);
        if (user.profession !== profession) {
            user.setProfession(profession);
            logger.info(`Found profession ${profession} for uid ${uid}`);
            const uidStr = String(uid);
            if (!this.userCache.has(uidStr)) {
                this.userCache.set(uidStr, {});
            }
            this.userCache.get(uidStr).profession = profession;
            this.saveUserCacheThrottled();
        }
    }

    setName(uid, name) {
        const user = this.getUser(uid);
        if (user.name !== name) {
            user.setName(name);
            logger.info(`Found player name ${name} for uid ${uid}`);
            const uidStr = String(uid);
            if (!this.userCache.has(uidStr)) {
                this.userCache.set(uidStr, {});
            }
            this.userCache.get(uidStr).name = name;
            this.saveUserCacheThrottled();
        }
    }

    setFightPoint(uid, fightPoint) {
        const user = this.getUser(uid);
        if (user.fightPoint != fightPoint) {
            user.setFightPoint(fightPoint);
            logger.info(`Found fight point ${fightPoint} for uid ${uid}`);
            const uidStr = String(uid);
            if (!this.userCache.has(uidStr)) {
                this.userCache.set(uidStr, {});
            }
            this.userCache.get(uidStr).fightPoint = fightPoint;
            this.saveUserCacheThrottled();
        }
    }

    setAttrKV(uid, key, value) {
        const user = this.getUser(uid);
        user.attr[key] = value;
        if (key === 'max_hp') {
            const uidStr = String(uid);
            if (!this.userCache.has(uidStr)) {
                this.userCache.set(uidStr, {});
            }
            this.userCache.get(uidStr).maxHp = value;
            this.saveUserCacheThrottled();
        }
        if (key === 'hp') {
            this.hpCache.set(uid, value);
        }
    }

    updateAllRealtimeDps() {
        // Advance the shared group-effective clock only when we've had DPS within the grace window
        const now = Date.now();
        const delta = Math.max(0, now - (this._lastGroupTickMs || now));
        if (delta > 0) {
            if (this.lastGroupActiveAtMs && now - this.lastGroupActiveAtMs <= this.inactivityGraceMs) {
                this.groupEffectiveElapsedMs += delta;
            }
        }
        this._lastGroupTickMs = now;

        for (const user of this.users.values()) {
            user.updateRealtimeDps();
        }
    }

    getUserSkillData(uid) {
        const user = this.users.get(uid);
        if (!user) return null;
        return {
            uid: user.uid,
            name: user.name,
            profession: user.profession + (user.subProfession ? `-${user.subProfession}` : ''),
            skills: user.getSkillSummary(),
            attr: user.attr,
        };
    }

    getAllUsersData() {
        const result = {};
        const effectiveSeconds = this.groupEffectiveElapsedMs > 0 ? this.groupEffectiveElapsedMs / 1000 : 0;
        for (const [uid, user] of this.users.entries()) {
            const summary = user.getSummary();
            // Preserve personal DPS based on personal activity window, but override total_dps
            // to use the shared group-effective elapsed time so rows update on resume.
            const totalDamage = summary?.total_damage?.total || 0;
            const groupDps = effectiveSeconds > 0 ? totalDamage / effectiveSeconds : 0;
            summary.personal_total_dps = summary.total_dps; // keep original for reference
            summary.total_dps = groupDps;
            result[uid] = summary;
        }
        return result;
    }

    getAllEnemiesData() {
        const result = {};
        const enemyIds = new Set([
            ...this.enemyCache.name.keys(),
            ...this.enemyCache.hp.keys(),
            ...this.enemyCache.maxHp.keys(),
        ]);
        enemyIds.forEach((id) => {
            result[id] = {
                name: this.enemyCache.name.get(id),
                hp: this.enemyCache.hp.get(id),
                max_hp: this.enemyCache.maxHp.get(id),
            };
        });
        return result;
    }

    deleteEnemyData(id) {
        this.enemyCache.name.delete(id);
        this.enemyCache.hp.delete(id);
        this.enemyCache.maxHp.delete(id);
    }

    refreshEnemyCache() {
        this.enemyCache.name.clear();
        this.enemyCache.hp.clear();
        this.enemyCache.maxHp.clear();
    }

    clearAll(reason = 'manual') {
        try {
            const usersToSave = this.users;
            const saveStartTime = this.startTime;

            // Reset runtime state
            this.users = new Map();
            this.hpCache.clear();
            this.refreshEnemyCache();

            this.startTime = Date.now();
            this.lastAutoSaveTime = 0;
            this.lastLogTime = 0;
            // Reset group activity tracking
            this.groupStartTimeMs = Date.now();
            this.groupEffectiveElapsedMs = 0;
            this.lastGroupActiveAtMs = 0;
            this._lastGroupTickMs = Date.now();

            // Persist previous session data asynchronously but do not block
            this.saveAllUserData(usersToSave, saveStartTime).catch((e) => {
                logger.warn('Failed saving user data during clearAll: ' + e.message);
            });

            // Immediately notify UI clients that data is cleared
            const payload = { code: 0, user: {}, reset: true, reason };
            try {
                socket.emit('data', payload);
            } catch (e) {
                logger.debug('Failed to emit cleared user data to socket: ' + e.message);
            }

            try {
                socket.emit('reset', { reason, timestamp: Date.now() });
            } catch (e) {
                logger.debug('Failed to emit reset event to socket: ' + e.message);
            }
        } catch (e) {
            logger.warn('clearAll failed: ' + e.message);
        }
    }

    getUserIds() {
        return Array.from(this.users.keys());
    }

    async saveAllUserData(usersToSave = null, startTime = null) {
        try {
            const endTime = Date.now();
            const users = usersToSave || this.users;
            const timestamp = startTime || this.startTime;
            const logDir = path.join('./logs', String(timestamp));
            const usersDir = path.join(logDir, 'users');
            const summary = {
                startTime: timestamp,
                endTime,
                duration: endTime - timestamp,
                userCount: users.size,
                version: config.VERSION,
            };

            const allUsersData = {};
            const userDatas = new Map();
            for (const [uid, user] of users.entries()) {
                allUsersData[uid] = user.getSummary();
                const userData = {
                    uid: user.uid,
                    name: user.name,
                    profession: user.profession + (user.subProfession ? `-${user.subProfession}` : ''),
                    skills: user.getSkillSummary(),
                    attr: user.attr,
                };
                userDatas.set(uid, userData);
            }

            // Respect global debug flag: only persist session logs when enabled
            if (config.ENABLE_DEBUG_LOGS) {
                try {
                    await fsPromises.access(usersDir);
                } catch (error) {
                    await fsPromises.mkdir(usersDir, { recursive: true });
                }

                const allUserDataPath = path.join(logDir, 'allUserData.json');
                await fsPromises.writeFile(allUserDataPath, JSON.stringify(allUsersData, null, 2), 'utf8');
                for (const [uid, userData] of userDatas.entries()) {
                    const userDataPath = path.join(usersDir, `${uid}.json`);
                    await fsPromises.writeFile(userDataPath, JSON.stringify(userData, null, 2), 'utf8');
                }
                await fsPromises.writeFile(path.join(logDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
                logger.debug(`Saved data for ${summary.userCount} users to ${logDir}`);
            } else {
                logger.debug('Debug logs disabled - skipping saveAllUserData writes');
            }
        } catch (error) {
            logger.error('Failed to save all user data:', error);
            throw error;
        }
    }

    checkTimeoutClear() {
        if (!config.GLOBAL_SETTINGS.autoClearOnTimeout || this.lastLogTime === 0 || this.users.size === 0) return;
        const currentTime = Date.now();
        if (this.lastLogTime && currentTime - this.lastLogTime > 15000) {
            this.clearAll('timeout');
            logger.info('Timeout reached, statistics cleared!');
        }
    }

    getGlobalSettings() {
        return config.GLOBAL_SETTINGS;
    }
}

const userDataManager = new UserDataManager();
export default userDataManager;
