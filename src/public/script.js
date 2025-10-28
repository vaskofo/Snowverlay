const colorHues = [
    210, // Blue
    30, // Orange
    270, // Purple
    150, // Teal
    330, // Magenta
    60, // Yellow
    180, // Cyan
    0, // Red
    240, // Indigo
];

let colorIndex = 0;

function getNextColorShades() {
    const h = colorHues[colorIndex];
    colorIndex = (colorIndex + 1) % colorHues.length;
    const s = 90;
    const l_dps = 30;
    const l_hps = 20;

    const dpsColor = `hsl(${h}, ${s}%, ${l_dps}%)`;
    const hpsColor = `hsl(${h}, ${s}%, ${l_hps}%)`;
    return { dps: dpsColor, hps: hpsColor };
}

function getClassColor(profession) {
    if (!profession) return null;
    const name = profession.trim().toLowerCase();
    const healers = ['soul musician', 'verdant oracle'];
    const tanks = ['heavy guardian', 'shield knight'];
    const dps = ['frost mage', 'stormblade', 'marksman', 'wind knight'];

    if (healers.includes(name)) {
        return { dps: '#38de49', hps: '#38de49' }; // green
    }
    if (tanks.includes(name)) {
        return { dps: '#45b5fc', hps: '#45b5fc' }; // blue
    }
    if (dps.includes(name)) {
        return { dps: '#ff4269', hps: '#ff4269' }; // red
    }
    return null;
}

function parseProfessionString(profStr) {
    if (!profStr) return { main: '', spec: '' };
    let s = String(profStr).trim();
    if (s.includes('-')) {
        const parts = s.split('-');
        const main = parts[0].trim();
        const rest = parts.slice(1).join('-').trim();
        const m = rest.match(/\(?([^)]*)\)?/);
        const spec = m && m[1] ? m[1].trim() : rest.replace(/[()]/g, '').trim();
        return { main, spec };
    }
    const m = s.match(/^([^()]+)\s*\(?([^)]*)\)?$/);
    if (m) {
        const main = (m[1] || '').trim();
        const spec = (m[2] || '').trim();
        return { main, spec };
    }
    return { main: s, spec: '' };
}

function getCurrentPlayerColor() {
    return { dps: '#fbbf24', hps: '#fbbf24' }; // amber
}

function getGrayColor() {
    return { dps: '#6b7280', hps: '#6b7280' }; // gray
}

function isCurrentPlayer(user) {
    // Check if this user's ID matches the current player UID from the server
    if (currentPlayerUid !== null && Number(user.id) === currentPlayerUid) {
        return true;
    }
    // Fallback for cases where currentPlayerUid is not yet loaded
    return user.isCurrentPlayer === true;
}

const columnsContainer = document.getElementById('columnsContainer');
const dpsListContainer = document.getElementById('dpsList');
const emptyMeterMessage = document.getElementById('emptyMeterMessage');
const skillDetailsContainer = document.getElementById('skillDetailsContainer');
const skillDetailsList = document.getElementById('skillDetailsList');
const skillDetailsUserName = document.getElementById('skillDetailsUserName');
const skillDetailsUserStats = document.getElementById('skillDetailsUserStats');
const skillDetailsClassIcon = document.getElementById('skillDetailsClassIcon');
const skillDetailsClassName = document.getElementById('skillDetailsClassName');
const settingsContainer = document.getElementById('settingsContainer');
const helpContainer = document.getElementById('helpContainer');
const passthroughTitle = document.getElementById('passthroughTitle');
const pauseButton = document.getElementById('pauseButton');
const clearButton = document.getElementById('clearButton');
const helpButton = document.getElementById('helpButton');
const settingsButton = document.getElementById('settingsButton');
const closeButton = document.getElementById('closeButton');
const backButton = document.getElementById('backButton');
const allButtons = [clearButton, pauseButton, helpButton, settingsButton, closeButton];
const serverStatus = document.getElementById('serverStatus');
const opacitySlider = document.getElementById('opacitySlider');
const classColorToggle = document.getElementById('classColorToggle');
const globalShortcutsToggle = document.getElementById('globalShortcutsToggle');
const disableUiFreezeToggle = document.getElementById('disableUiFreezeToggle');
const autoClearServerChangeToggle = document.getElementById('autoClearServerChangeToggle');
const autoClearTimeoutInput = document.getElementById('autoClearTimeoutInput');
const disableUserTimeoutToggle = document.getElementById('disableUserTimeoutToggle');
const hideHpsToggle = document.getElementById('hideHpsToggle');
const hideMitigationToggle = document.getElementById('hideMitigationToggle');
const windowHeightModeStaticRadio = document.getElementById('windowHeightModeStatic');
const windowHeightModeAutoRadio = document.getElementById('windowHeightModeAuto');
const autoPlayerCountInput = document.getElementById('autoPlayerCount');
const autoHeightControls = document.getElementById('autoHeightControls');
const currentDateTime = document.getElementById('currentDateTime');
const dateTimeFormatSelect = document.getElementById('dateTimeFormatSelect');
const fontSizeSelect = document.getElementById('fontSizeSelect');
const statusOverlay = document.getElementById('statusOverlay');
const statusOverlayText = document.getElementById('statusOverlayText');
const statusOverlayTimer = document.getElementById('statusOverlayTimer');
// Totals header elements
const totalsHeaderEl = document.getElementById('totalsHeader');
const totalDamageEl = document.getElementById('totalDamage');
const totalDpsEl = document.getElementById('totalDps');
const dpsDurationEl = document.getElementById('dpsDuration');

let allUsers = {};
let userColors = {};
let userColorSource = {}; // 'random' | 'class' | 'current' | 'gray'
let useClassColors = true; // default to class-based colors
let hideHpsBar = true; // true = hide HPS bar by default
let hideMitigationBar = false; // false = show mitigation bar by default
let windowHeightMode = 'static'; // 'static' or 'auto' - applies to DPS screen only
let autoPlayerCount = 8;
let isPaused = false;
let socket = null;
let isWebSocketConnected = false;
let lastWebSocketMessage = Date.now();
let currentPlayerUid = null; // Will be fetched from server
let isProgrammaticResize = false;
let pendingResizeHeight = null;
let lastRequestedHeight = null;
let isLoadingSettings = false;
let staticHeightDps = null;
let staticHeightSettings = null;
let staticHeightSkills = null;
let enableGlobalShortcuts = false;
let disableUiFreezeOnInactivity = false;
let autoClearOnServerChange = true;
let autoClearTimeoutSeconds = 0;
// Track interval/timer IDs for cleanup on unload
let checkConnectionIntervalId = null;
let playerUidIntervalId = null;
let dateTimeIntervalId = null;
let totalsIntervalId = null; // periodic update for totals header
// DPS timer tracking
let dpsStartTimeMs = null; // when first damage was detected after last clear
let pausedAccumulatedMs = 0; // total paused duration to subtract from elapsed
let pausedStartedAtMs = null; // when current pause started
// Server-provided group clock meta
let serverMeta = {
    groupStartTimeMs: null,
    groupEffectiveElapsedMs: 0,
    lastGroupActiveAtMs: 0,
    inactivityGraceMs: 1000,
    sessionStartTime: null,
    paused: false,
};
// Track last observed activity time (damage/healing increase)
let lastActivityAtMs = null;
// Each screen uses its own static height (staticHeightDps/staticHeightSettings/staticHeightSkills).
// Manual resizes update the static height for the current screen via handleWindowResized.
const WEBSOCKET_RECONNECT_INTERVAL = 5000;

// Pause rendering on hover to allow clicks
let isHoveringMeter = false;

// Skill details auto-refresh state
let currentSkillRefreshTimer = null;
let currentSkillUserId = null;
let currentSkillCpsTimer = null; // Separate timer for CPS calculation
let overlayMessageTimeout = null;
let overlayHideTimeout = null;
let overlayWaitingInterval = null;
let overlayTimerStartMs = null; // When the current timer started
let overlayCurrentMessage = '';
let overlayLastChange = 0;
let hasReceivedServerData = false;

const SERVER_URL = 'localhost:8990';
const OVERLAY_MIN_DURATION = 500;
const FINDING_SERVER_MESSAGE = 'Finding server...';
const MIN_AUTO_PLAYER_COUNT = 1;
const MAX_AUTO_PLAYER_COUNT = 24;
const BASE_WINDOW_HEIGHT = 42;
const ROW_HEIGHT = 50;
const MIN_NON_DPS_HEIGHT = 150; // Minimum height for settings/help/skill screens
const SCREEN_DPS = 'dps';
const SCREEN_SETTINGS = 'settings';
const SCREEN_HELP = 'help';
const SCREEN_SKILLS = 'skills';
const RENDER_THROTTLE_MS = 80; // Throttle interval for UI updates
// Freeze UI updates if no activity for this long (frontend-only)
const INACTIVITY_GRACE_MS = 1000;

// Font size scaling: small (default), normal, large
let _currentFontSize = 'small';

const ResizeController = (function () {
    const debounceMs = 100;
    let timer = null;
    let pending = { reasonSet: new Set(), heightHint: null, screen: null, measure: false };
    let lastSentHeight = null;

    function _clearPending() {
        pending.reasonSet.clear();
        pending.heightHint = null;
        pending.screen = null;
        pending.measure = false;
    }

    function _enqueue(reason, opts = {}) {
        try {
            pending.reasonSet.add(reason || 'unknown');
            if (opts && typeof opts.heightHint === 'number') {
                pending.heightHint = Math.max(pending.heightHint || 0, Math.round(opts.heightHint));
            }
            if (opts && opts.screen) pending.screen = opts.screen;
            if (opts && opts.measure) pending.measure = true;
        } catch (_) {}
        if (timer) clearTimeout(timer);
        if (opts && opts.immediate) {
            timer = null;
            requestAnimationFrame(() => {
                _flush();
            });
            return;
        }
        timer = setTimeout(() => {
            timer = null;
            _flush();
        }, debounceMs);
    }

    function _flush() {
        const hint = pending.heightHint;
        const screen = pending.screen || getCurrentScreen();
        const doMeasure = pending.measure;
        _clearPending();
        if (doMeasure) {
            measureAndSend(screen);
            return;
        }
        if (hint === null || hint === undefined) return;
        _sendHeight(hint, screen);
    }

    function measureAndSend(screen) {
        requestAnimationFrame(() => {
            try {
                const controlsEl = document.querySelector('.controls');
                const footerEl = document.querySelector('.footer');
                const totalsEl = totalsHeaderEl && !totalsHeaderEl.classList.contains('hidden') ? totalsHeaderEl : null;

                const controlsH = controlsEl ? controlsEl.getBoundingClientRect().height : 0;
                const footerH = footerEl ? footerEl.getBoundingClientRect().height : 0;
                const totalsH = totalsEl ? totalsEl.getBoundingClientRect().height : 0;

                if (screen === SCREEN_DPS && windowHeightMode === 'auto') {
                    const items = dpsListContainer ? Array.from(dpsListContainer.querySelectorAll('.data-item')) : [];
                    const playerCount = items.length;
                    const effectiveCount = playerCount === 0 ? 0 : Math.max(0, Math.min(playerCount, autoPlayerCount));

                    let rowsHeight = 0;
                    if (effectiveCount === 0) {
                        if (emptyMeterMessage && !emptyMeterMessage.classList.contains('hidden')) {
                            rowsHeight = emptyMeterMessage.getBoundingClientRect().height;
                        } else {
                            rowsHeight = ROW_HEIGHT * 2;
                        }
                    } else {
                        const count = Math.min(effectiveCount, items.length);
                        if (count > 0) {
                            let total = 0;
                            for (let i = 0; i < count; i++) {
                                total += items[i].offsetHeight || items[i].getBoundingClientRect().height || ROW_HEIGHT;
                            }
                            rowsHeight = total;
                            if (effectiveCount > items.length) {
                                const totalRendered = items.reduce(
                                    (sum, el) =>
                                        sum + (el.offsetHeight || el.getBoundingClientRect().height || ROW_HEIGHT),
                                    0
                                );
                                const avg = items.length > 0 ? totalRendered / items.length : ROW_HEIGHT;
                                rowsHeight += (effectiveCount - items.length) * avg;
                            }
                        } else {
                            rowsHeight = effectiveCount * ROW_HEIGHT;
                        }
                    }

                    const columnsStyle = columnsContainer ? window.getComputedStyle(columnsContainer) : null;
                    let columnsExtra = 0;
                    if (columnsStyle) {
                        const padTop = parseFloat(columnsStyle.paddingTop) || 0;
                        const padBottom = parseFloat(columnsStyle.paddingBottom) || 0;
                        columnsExtra = padTop + padBottom;
                    }

                    const SAFE_BOTTOM_PADDING = 2;
                    const desiredHeight =
                        controlsH + (totalsH + rowsHeight + columnsExtra) + footerH + SAFE_BOTTOM_PADDING;
                    const finalHeight = Math.max(BASE_WINDOW_HEIGHT, Math.round(desiredHeight));
                    _sendHeight(finalHeight, screen);
                    return;
                }

                const stored = getStaticHeightForScreen(screen);
                _sendHeight(stored || MIN_NON_DPS_HEIGHT, screen);
            } catch (e) {
                _sendHeight(BASE_WINDOW_HEIGHT, screen);
            }
        });
    }

    function _sendHeight(height, screen) {
        if (!window.electronAPI || typeof window.electronAPI.setWindowSize !== 'function') return;
        const rounded = Math.round(height);
        if (lastSentHeight !== null && Math.abs(lastSentHeight - rounded) <= 1) return;
        const w = Math.max(1, Math.round(window.innerWidth));
        try {
            isProgrammaticResize = true;
            pendingResizeHeight = rounded;
            lastRequestedHeight = rounded;
        } catch (_) {}
        lastSentHeight = rounded;
        window.electronAPI.setWindowSize(w, rounded);
    }

    function requestHeight(reason, opts = {}) {
        _enqueue(reason, opts);
    }

    function handleNativeResize(bounds) {
        try {
            const reportedHeight = bounds && typeof bounds.height === 'number' ? Math.round(bounds.height) : null;
            if (isProgrammaticResize) {
                if (
                    reportedHeight !== null &&
                    pendingResizeHeight !== null &&
                    Math.abs(reportedHeight - pendingResizeHeight) <= 2
                ) {
                    isProgrammaticResize = false;
                    pendingResizeHeight = null;
                    return;
                }
                isProgrammaticResize = false;
                pendingResizeHeight = null;
                return;
            }
            if (reportedHeight !== null) {
                const screen = getCurrentScreen();
                setStaticHeightForScreen(screen, reportedHeight);
                if (screen === SCREEN_DPS) {
                    if (windowHeightMode === 'auto') {
                        setWindowHeightMode('static');
                    }
                }
                lastRequestedHeight = null;
                return;
            }
            if (windowHeightMode === 'auto') {
                setWindowHeightMode('static');
            }
        } catch (e) {
            console.error('ResizeController.handleNativeResize error', e);
        }
    }

    return {
        requestHeight,
        handleNativeResize,
    };
})();

function setFontSize(size) {
    const valid = ['small', 'normal', 'large'];
    const target = valid.includes(size) ? size : 'small';
    if (_currentFontSize === target) return;
    document.body.classList.remove('font-small', 'font-normal', 'font-large');
    document.body.classList.add(`font-${target}`);
    _currentFontSize = target;
}

function getCurrentFontSize() {
    return _currentFontSize;
}

function formatNumber(num) {
    if (isNaN(num)) return 'NaN';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.round(num).toString();
}

// Convert color string to an alpha variant. Handles hsl(...) and hsla(...).
function toAlpha(color, alpha = 0.5) {
    if (!color) return `rgba(255,255,255,${alpha})`;
    const c = color.trim();
    // handle hsla(...)
    if (c.startsWith('hsla(')) {
        // replace alpha with the requested value
        return c.replace(/hsla\(([^,]+),([^,]+),([^,]+),[^)]+\)/, `hsla($1,$2,$3,${alpha})`);
    }
    if (c.startsWith('hsl(')) {
        // hsl(h, s%, l%) -> hsla(h, s%, l%, alpha)
        return c.replace(/hsl\(([^)]+)\)/, `hsla($1,${alpha})`);
    }
    // Fallback: if rgb(...) or rgba(...), convert rgba with requested alpha
    if (c.startsWith('rgb(')) {
        return c.replace(/rgb\(([^)]+)\)/, `rgba($1,${alpha})`);
    }
    if (c.startsWith('#')) {
        // convert hex to rgba
        const hex = c.slice(1);
        let r = 255,
            g = 255,
            b = 255;
        if (hex.length === 3) {
            r = Number.parseInt(hex[0] + hex[0], 16);
            g = Number.parseInt(hex[1] + hex[1], 16);
            b = Number.parseInt(hex[2] + hex[2], 16);
        } else if (hex.length === 6) {
            r = Number.parseInt(hex.slice(0, 2), 16);
            g = Number.parseInt(hex.slice(2, 4), 16);
            b = Number.parseInt(hex.slice(4, 6), 16);
        }
        return `rgba(${r},${g},${b},${alpha})`;
    }
    // final fallback: return original color (no alpha conversion available)
    return c;
}

function renderDataList(users) {
    if (!dpsListContainer) return;
    dpsListContainer.innerHTML = '';

    // Show/hide empty message based on player count
    if (!emptyMeterMessage) {
        // Element not found, skip empty message handling
    } else if (users.length === 0) {
        emptyMeterMessage.classList.remove('hidden');
    } else {
        emptyMeterMessage.classList.add('hidden');
    }

    const totalDamageOverall = users.reduce((sum, user) => sum + user.total_damage.total, 0);
    const totalHealingOverall = users.reduce((sum, user) => sum + user.total_healing.total, 0);
    // Track group mitigation so each shield bar scales against the party's absorbed total
    const totalMitigationOverall = users.reduce((sum, user) => sum + (user.mitigated_damage || 0), 0);

    users.sort((a, b) => b.total_dps - a.total_dps);

    users.forEach((user, index) => {
        ensureUserColor(user);
        const colors = userColors[user.id];
        const item = document.createElement('li');

        item.className = 'data-item';
        item.dataset.uid = user.id;

        const damagePercent = totalDamageOverall > 0 ? (user.total_damage.total / totalDamageOverall) * 100 : 0;
        const healingPercent = totalHealingOverall > 0 ? (user.total_healing.total / totalHealingOverall) * 100 : 0;

        // We'll render the name safely (no innerHTML interpolation)

        // Determine main profession (strip subprofession in parentheses)
        let classIconHtml = '';
        const professionString = user.profession ? user.profession.trim() : '';
        const mainProfession = professionString ? professionString.split('(')[0].trim() : '';

        // If class-based colors are used, userColors was set using getClassColor(mainProfession) earlier.
        // Only show the class icon when the main profession matches a known class name.
        const knownClassColor = getClassColor(mainProfession);
        // NOTE: We'll insert the class icon programmatically later to avoid HTML injection

        let subBarHtml = '';
        let hpsCompactHtml = '';
        let mitigationCompactHtml = '';

        if (!hideHpsBar) {
            if (user.total_healing.total > 0 || user.total_hps > 0) {
                const hpsHalf = toAlpha(colors.hps, 0.5);
                subBarHtml = `
                    <div class="sub-bar">
                        <div class="hps-bar-fill" style="width: ${healingPercent}%; --fill-color: ${colors.hps}; --fill-color-half: ${hpsHalf};"></div>
                        <div class="hps-stats">
                           ${formatNumber(user.total_healing.total)} (${formatNumber(user.total_hps)} HPS, ${healingPercent.toFixed(1)}%)
                        </div>
                    </div>
                `;
            }
        } else {
            // When HPS bar is hidden, show a compact HPS text to the left of the DPS stats
            if (user.total_healing.total > 0 || user.total_hps > 0) {
                hpsCompactHtml = `<span class="hps-compact">${formatNumber(user.total_healing.total)} (${formatNumber(user.total_hps)} HPS)</span>`;
            }
        }

        // Mitigation bar (shield/absorbed damage)
        let mitigationBarHtml = '';
        const mitigatedDamage = user.mitigated_damage || 0;

        if (!hideMitigationBar && mitigatedDamage > 0) {
            // Visual mitigation bar mirrors DPS/HPS bars, sharing space with the player's main row
            const mitigationColor = '#60a5fa'; // Blue color for mitigation
            const mitigationColorHalf = toAlpha(mitigationColor, 0.5);
            const mitigationPercent = totalMitigationOverall > 0 ? (mitigatedDamage / totalMitigationOverall) * 100 : 0;
            mitigationBarHtml = `
                <div class="sub-bar mitigation-bar">
                    <div class="mitigation-bar-fill" style="width: ${mitigationPercent}%; --fill-color: ${mitigationColor}; --fill-color-half: ${mitigationColorHalf};"></div>
                    <div class="mitigation-stats">
                       ${formatNumber(mitigatedDamage)} mitigated (${mitigationPercent.toFixed(1)}%)
                    </div>
                </div>
            `;
        } else if (hideMitigationBar && mitigatedDamage > 0) {
            // When the bar is hidden, surface mitigation as a compact tag alongside DPS stats
            mitigationCompactHtml = `<span class="mitigation-compact">${formatNumber(mitigatedDamage)} MIT</span>`;
        }

        // Build the row using a template then safely insert user-provided text
        item.innerHTML = `
            <div class="main-bar">
                <div class="dps-bar-fill" style="width: ${damagePercent}%; --fill-color: ${colors.dps}; --fill-color-half: ${toAlpha(colors.dps, 0.5)};"></div>
                <div class="content">
                    <span class="rank">${index + 1}.</span>
                    
                    <span class="name"></span>
                    ${hpsCompactHtml}
                    ${mitigationCompactHtml}
                    <span class="stats">${formatNumber(user.total_damage.total)} (${formatNumber(user.total_dps)} DPS, ${damagePercent.toFixed(1)}%)</span>
                </div>
            </div>
            ${subBarHtml}
            ${mitigationBarHtml}
        `;

        // Optionally insert the class icon before the name, safely
        if (mainProfession && knownClassColor) {
            const iconFileName = mainProfession.toLowerCase().replace(/ /g, '_') + '.png';
            const img = document.createElement('img');
            img.className = 'class-icon';
            img.src = `assets/${iconFileName}`;
            img.alt = String(mainProfession);
            img.onerror = function () {
                this.style.display = 'none';
            };
            const contentEl = item.querySelector('.content');
            const nameEl = item.querySelector('.name');
            if (contentEl && nameEl) {
                contentEl.insertBefore(img, nameEl);
            }
        }

        // Safely populate the name content (text nodes only)
        const nameSpan = item.querySelector('.name');
        if (nameSpan) {
            const baseName = typeof user.name === 'string' ? user.name : '...';
            nameSpan.textContent = baseName;
            if (user.fightPoint) {
                const gear = document.createElement('span');
                gear.className = 'gear-score';
                gear.textContent = String(user.fightPoint);
                nameSpan.appendChild(document.createTextNode(' '));
                nameSpan.appendChild(gear);
            }
        }
        dpsListContainer.appendChild(item);
    });
}

// Ensure a color entry exists for the user and upgrade it to class color if possible
function ensureUserColor(user) {
    if (!user) return;
    const uid = user.id;

    // PRIORITY 1: Check if this is the current player FIRST (overrides everything)
    if (isCurrentPlayer(user)) {
        userColors[uid] = getCurrentPlayerColor();
        userColorSource[uid] = 'current-player';
        return;
    }

    if (!userColors[uid]) {
        // PRIORITY 2: Use class-based colors if enabled
        if (useClassColors) {
            const professionString = user.profession ? user.profession.trim() : '';
            const mainProfession = professionString ? professionString.split('(')[0].trim() : '';
            const classColor = getClassColor(mainProfession);
            if (classColor) {
                userColors[uid] = classColor;
                userColorSource[uid] = 'class';
                return;
            }
            // PRIORITY 3a: Gray fallback when class colors enabled but no match
            userColors[uid] = getGrayColor();
            userColorSource[uid] = 'gray';
            return;
        }
        // PRIORITY 3b: Random color as fallback when class colors disabled
        userColors[uid] = getNextColorShades();
        userColorSource[uid] = 'random';
        return;
    }

    // If color exists but is not current-player, upgrade if needed
    if (userColorSource[uid] !== 'current-player') {
        // Check if this is now the current player (override existing color)
        if (isCurrentPlayer(user)) {
            userColors[uid] = getCurrentPlayerColor();
            userColorSource[uid] = 'current-player';
            return;
        }
        // Try to upgrade to a class color if enabled and we now know the profession.
        // This upgrades gray/random fallbacks to the appropriate class color when available.
        if (useClassColors) {
            const professionString = user.profession ? user.profession.trim() : '';
            const mainProfession = professionString ? professionString.split('(')[0].trim() : '';
            const classColor = getClassColor(mainProfession);
            if (classColor && userColorSource[uid] !== 'class') {
                userColors[uid] = classColor;
                userColorSource[uid] = 'class';
            }
        }
    }
}

function ensureUserColorById(uid) {
    const user = allUsers[uid];
    if (user) ensureUserColor(user);
}

function handleServerReset(reason = 'server') {
    const hadUsers = Object.keys(allUsers).length > 0;
    allUsers = {};
    userColors = {};
    userColorSource = {};
    resetDpsSession();
    lastActivityAtMs = null;
    updateTotalsHeader();
    updateAll();
    if (hadUsers) {
        console.log(`Server reset received (${reason}).`);
    }
    const previousStatus = getServerStatus();
    showServerStatus('cleared');
    setTimeout(() => {
        const fallback = previousStatus && previousStatus !== 'cleared' ? previousStatus : 'connected';
        showServerStatus(fallback);
    }, 1000);

    // Keep hasReceivedServerData as true if we already have player UID
    // (server change scenario - don't show startup overlay again)
    if (currentPlayerUid !== null) {
        hasReceivedServerData = true;
    }
}

// Use event delegation for clicks to ensure clicks always register
dpsListContainer.addEventListener('click', (e) => {
    const item = e.target.closest('.data-item');
    if (!item) return;
    const uid = item.dataset.uid;
    if (!uid) return;
    showSkillDetails(Number(uid));
});

// Pause rendering when hovering over the meter to allow clicks
dpsListContainer.addEventListener('mouseenter', () => {
    isHoveringMeter = true;
});

dpsListContainer.addEventListener('mouseleave', () => {
    isHoveringMeter = false;
    // Trigger an update after hover ends to refresh the display
    updateAll();
});

function updateAll() {
    // Don't re-render if skill details panel is open
    if (!skillDetailsContainer.classList.contains('hidden')) {
        return;
    }

    if (columnsContainer && columnsContainer.classList.contains('hidden')) {
        return;
    }

    // Don't re-render if user is hovering over the meter (allows clicks to register)
    if (isHoveringMeter) {
        return;
    }

    // During inactivity grace period, freeze UI updates (frontend only)
    if (shouldFreezeUi()) {
        return;
    }

    const usersArray = Object.values(allUsers).filter((user) => user.total_dps > 0 || user.total_hps > 0);
    renderDataList(usersArray);
    adjustWindowHeight(usersArray.length);
    // Update totals header immediately on data changes
    updateTotalsHeader();
}

function adjustWindowHeight(playerCount) {
    if (windowHeightMode !== 'auto') return;

    if (settingsContainer && !settingsContainer.classList.contains('hidden')) return;
    if (helpContainer && !helpContainer.classList.contains('hidden')) return;

    if (statusOverlay && !statusOverlay.classList.contains('hidden')) return;
    if (!columnsContainer || columnsContainer.classList.contains('hidden')) return;

    ResizeController.requestHeight('auto', { measure: true, screen: SCREEN_DPS });
}

function requestWindowResize(targetHeight) {
    if (!window.electronAPI || typeof window.electronAPI.setWindowSize !== 'function') {
        return;
    }

    const roundedHeight = Math.round(targetHeight);
    if (lastRequestedHeight !== null && Math.abs(lastRequestedHeight - roundedHeight) <= 1) {
        return;
    }

    ResizeController.requestHeight('manual', { heightHint: roundedHeight, screen: getCurrentScreen() });
}

function getCurrentScreen() {
    if (!columnsContainer.classList.contains('hidden')) return SCREEN_DPS;
    if (!settingsContainer.classList.contains('hidden')) return SCREEN_SETTINGS;
    if (!helpContainer.classList.contains('hidden')) return SCREEN_HELP;
    if (!skillDetailsContainer.classList.contains('hidden')) return SCREEN_SKILLS;
    return SCREEN_DPS;
}

function getStaticHeightForScreen(screen) {
    switch (screen) {
        case SCREEN_SETTINGS:
            return staticHeightSettings ?? MIN_NON_DPS_HEIGHT;
        case SCREEN_SKILLS:
            return staticHeightSkills ?? MIN_NON_DPS_HEIGHT;
        case SCREEN_HELP:
            // Treat help as settings for height rules
            return staticHeightSettings ?? MIN_NON_DPS_HEIGHT;
        case SCREEN_DPS:
        default:
            return staticHeightDps ?? BASE_WINDOW_HEIGHT;
    }
}

function setStaticHeightForScreen(screen, height) {
    const clampedNonDps = Math.max(MIN_NON_DPS_HEIGHT, Math.round(height));
    const clampedDps = Math.max(BASE_WINDOW_HEIGHT, Math.round(height));
    switch (screen) {
        case SCREEN_SETTINGS:
            staticHeightSettings = clampedNonDps;
            break;
        case SCREEN_SKILLS:
            staticHeightSkills = clampedNonDps;
            break;
        case SCREEN_HELP:
            staticHeightSettings = clampedNonDps;
            break;
        case SCREEN_DPS:
        default:
            staticHeightDps = clampedDps;
            break;
    }
}

function ensureHeightForScreen(screen) {
    const target = getStaticHeightForScreen(screen);
    ResizeController.requestHeight('screen', { heightHint: target, screen, immediate: true });
}

function handleWindowResized(bounds) {
    ResizeController.handleNativeResize(bounds || {});
    return;
}

function setWindowHeightMode(mode, options = {}) {
    const normalizedMode = mode === 'auto' ? 'auto' : 'static';
    const didChange = windowHeightMode !== normalizedMode;

    windowHeightMode = normalizedMode;

    if (windowHeightModeStaticRadio) windowHeightModeStaticRadio.checked = normalizedMode === 'static';
    if (windowHeightModeAutoRadio) windowHeightModeAutoRadio.checked = normalizedMode === 'auto';

    // Show/hide auto-height controls
    updateAutoHeightControlsVisibility();

    if (!didChange) {
        return;
    }

    lastRequestedHeight = null;

    if (!options.skipSave && !isLoadingSettings) {
        saveSettings();
    }

    if (normalizedMode === 'auto') {
        // Save the current static size for the current screen (primarily DPS) to restore when needed
        try {
            const currentScreen = getCurrentScreen();
            const currentHeight = Math.max(
                currentScreen === SCREEN_DPS ? BASE_WINDOW_HEIGHT : MIN_NON_DPS_HEIGHT,
                window.innerHeight || BASE_WINDOW_HEIGHT
            );
            setStaticHeightForScreen(currentScreen, currentHeight);
        } catch (_) {}
        updateAll();
    }
}

function updateAutoHeightControlsVisibility() {
    if (!autoHeightControls) return;
    if (windowHeightMode === 'auto') {
        autoHeightControls.classList.remove('hidden');
    } else {
        autoHeightControls.classList.add('hidden');
    }
}

function setAutoPlayerCount(value, options = {}) {
    // Hidden; keep internal state only
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
        if (autoPlayerCountInput) {
            autoPlayerCountInput.value = String(autoPlayerCount);
        }
        return;
    }

    const clampedValue = Math.min(MAX_AUTO_PLAYER_COUNT, Math.max(MIN_AUTO_PLAYER_COUNT, parsed));
    const didChange = autoPlayerCount !== clampedValue;
    autoPlayerCount = clampedValue;

    // if (autoPlayerCountInput) autoPlayerCountInput.value = String(clampedValue);

    if (didChange) {
        lastRequestedHeight = null;
        if (!options.skipSave && !isLoadingSettings) {
            saveSettings();
        }
        if (windowHeightMode === 'auto') {
            updateAll();
        }
    }
}

function processDataUpdate(data) {
    if (!data || typeof data !== 'object') {
        console.warn('Received invalid data payload:', data);
        return;
    }
    if (!data.user) {
        console.warn('Received data without a "user" object:', data);
        return;
    }

    if (data.meta && typeof data.meta === 'object') {
        try {
            serverMeta = {
                groupStartTimeMs: data.meta.groupStartTimeMs ?? serverMeta.groupStartTimeMs,
                groupEffectiveElapsedMs: data.meta.groupEffectiveElapsedMs ?? serverMeta.groupEffectiveElapsedMs,
                lastGroupActiveAtMs: data.meta.lastGroupActiveAtMs ?? serverMeta.lastGroupActiveAtMs,
                inactivityGraceMs: data.meta.inactivityGraceMs ?? serverMeta.inactivityGraceMs,
                sessionStartTime: data.meta.sessionStartTime ?? serverMeta.sessionStartTime,
                paused: !!data.meta.paused,
            };
            if (typeof serverMeta.paused === 'boolean') {
                isPaused = serverMeta.paused;
                if (pauseButton) pauseButton.textContent = isPaused ? '▶️' : '⏸️';
                showServerStatus(isPaused ? 'paused' : 'connected');
            }
        } catch (_) {}
    }

    const userEntries = Object.entries(data.user);
    if (data.reset === true) {
        handleServerReset(data.reason || 'server');
        return;
    }
    if (userEntries.length === 0) {
        if (Object.keys(allUsers).length > 0 && !autoClearOnServerChange) {
            handleServerReset(data.reason || 'empty');
        }
        return;
    }

    if (!hasReceivedServerData) {
        hasReceivedServerData = true;

        // If the incoming payload already contains visible DPS/HPS entries and the
        // overlay is currently shown, skip the intro messages and show the meter
        // immediately to avoid rows appearing behind the overlay and causing
        // a visual resize flicker.
        let hasVisibleUser = false;
        try {
            for (const [_id, u] of userEntries) {
                if (!u) continue;
                const dmg = u.total_damage && typeof u.total_damage.total === 'number' ? u.total_damage.total : 0;
                const heal = u.total_healing && typeof u.total_healing.total === 'number' ? u.total_healing.total : 0;
                const tdps = typeof u.total_dps === 'number' ? u.total_dps : 0;
                const thps = typeof u.total_hps === 'number' ? u.total_hps : 0;
                if (dmg > 0 || heal > 0 || tdps > 0 || thps > 0) {
                    hasVisibleUser = true;
                    break;
                }
            }
        } catch (_) {
            hasVisibleUser = false;
        }

        if (hasVisibleUser && statusOverlay && !statusOverlay.classList.contains('hidden')) {
            // Bypass intro messages and hide overlay immediately (no animation)
            hideOverlayImmediate();
        } else {
            setTimeout(() => {
                tryHideOverlay();
            }, 500);
        }
    }

    let activityDetected = false;

    for (const [userId, newUser] of userEntries) {
        const existingUser = allUsers[userId] || {};

        const updatedUser = {
            ...existingUser,
            ...newUser,
            id: userId,
        };

        const hasNewValidName = newUser.name && typeof newUser.name === 'string' && newUser.name !== '未知';
        if (hasNewValidName) {
            updatedUser.name = newUser.name;
        } else if (!existingUser.name || existingUser.name === '...') {
            updatedUser.name = '...';
        }

        const hasNewProfession = newUser.profession && typeof newUser.profession === 'string';
        if (hasNewProfession) {
            updatedUser.profession = newUser.profession;
            // Color upgrade will be attempted after we commit updatedUser into allUsers below
        } else if (!existingUser.profession) {
            updatedUser.profession = '';
        }

        const hasNewFightPoint = newUser.fightPoint !== undefined && typeof newUser.fightPoint === 'number';
        if (hasNewFightPoint) {
            updatedUser.fightPoint = newUser.fightPoint;
        } else if (existingUser.fightPoint === undefined) {
            updatedUser.fightPoint = 0;
        }

        // Ensure mitigation totals are always present so the shield bar renders reliably
        const hasMitigationUpdate = newUser.mitigated_damage !== undefined;
        if (hasMitigationUpdate) {
            updatedUser.mitigated_damage = newUser.mitigated_damage;
        } else if (existingUser.mitigated_damage === undefined) {
            updatedUser.mitigated_damage = 0;
        }

        // Detect activity: increases in total damage (DPS activity only)
        try {
            const prevDamage =
                existingUser.total_damage && typeof existingUser.total_damage.total === 'number'
                    ? existingUser.total_damage.total
                    : 0;
            const nextDamage =
                newUser.total_damage && typeof newUser.total_damage.total === 'number'
                    ? newUser.total_damage.total
                    : updatedUser.total_damage && typeof updatedUser.total_damage.total === 'number'
                      ? updatedUser.total_damage.total
                      : prevDamage;
            if (nextDamage > prevDamage) activityDetected = true;
        } catch (_) {}

        allUsers[userId] = updatedUser;

        // Now that the user's data is stored, attempt to upgrade their color
        ensureUserColorById(userId);
    }

    // If any activity detected, refresh activity timestamp so UI resumes updates
    if (activityDetected) {
        lastActivityAtMs = Date.now();
    }

    updateAll();
    // Ensure DPS timer starts when first positive damage is observed
    ensureDpsStartTime();
    // If there are no visible users remaining, reset DPS session
    maybeResetIfEmpty();
}

async function clearData() {
    try {
        const currentStatus = getServerStatus();
        showServerStatus('cleared');

        const response = await fetch(`http://${SERVER_URL}/api/clear`);
        const result = await response.json();

        if (result.code === 0) {
            allUsers = {};
            userColors = {};
            userColorSource = {};
            dpsStartTimeMs = null;
            pausedAccumulatedMs = 0;
            pausedStartedAtMs = null;
            serverMeta = {
                groupStartTimeMs: null,
                groupEffectiveElapsedMs: 0,
                lastGroupActiveAtMs: 0,
                inactivityGraceMs: 1000,
                sessionStartTime: null,
                paused: isPaused,
            };
            lastActivityAtMs = null;
            updateTotalsHeader();
            // Note: currentPlayerUid is preserved across clears
            updateAll();
            showServerStatus('cleared');
            console.log('Data cleared successfully.');
        } else {
            console.error('Failed to clear data on server:', result.msg);
        }

        setTimeout(() => showServerStatus(currentStatus), 1000);
    } catch (error) {
        console.error('Error sending clear request to server:', error);
    }
}

async function togglePause() {
    try {
        const next = !isPaused;
        const resp = await fetch(`http://${SERVER_URL}/api/pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paused: next }),
        });
        const result = await resp.json();
        if (result.code === 0) {
            isPaused = !!result.paused;
            if (pauseButton) pauseButton.textContent = isPaused ? '▶️' : '⏸️';
            showServerStatus(isPaused ? 'paused' : 'connected');
        }
    } catch (e) {
        console.error('Failed to toggle pause:', e);
    }
}

function closeClient() {
    window.electronAPI.closeClient();
}

function showServerStatus(status) {
    const statusElement = document.getElementById('serverStatus');
    statusElement.className = `status-indicator ${status}`;

    // If disconnected/reconnecting, show finding server message with timer
    // but only if we don't already have a player UID (initial connection, not server change)
    if (status === 'disconnected' || status === 'reconnecting') {
        if (!statusOverlay || !statusOverlayText) return;

        // Don't show overlay if we already have player UID (server change scenario)
        if (currentPlayerUid !== null) return;

        // If overlay is hidden or not showing finding server, show it
        if (statusOverlay.classList.contains('hidden') || overlayCurrentMessage !== FINDING_SERVER_MESSAGE) {
            showOverlayMessage(FINDING_SERVER_MESSAGE, true);
            hasReceivedServerData = false;
        }
        return;
    }

    // Connected status is handled by socket.on('connect') event
}

function getServerStatus() {
    const statusElement = document.getElementById('serverStatus');
    if (!statusElement) return 'unknown';
    for (const cls of statusElement.classList) {
        if (cls !== 'status-indicator') return cls;
    }
    return 'unknown';
}

function connectWebSocket() {
    // Clean up any existing socket and listeners before creating a new one
    if (socket) {
        try {
            socket.off && socket.off();
        } catch (_) {}
        try {
            socket.removeAllListeners && socket.removeAllListeners();
        } catch (_) {}
        try {
            socket.close && socket.close();
        } catch (_) {}
    }
    socket = io(`ws://${SERVER_URL}`);

    socket.on('connect', () => {
        isWebSocketConnected = true;
        showServerStatus('connected');
        lastWebSocketMessage = Date.now();

        // No waiting-for-packet message: startup overlay handling is simplified.
    });

    socket.on('disconnect', () => {
        isWebSocketConnected = false;
        showServerStatus('disconnected');
    });

    socket.on('data', (data) => {
        processDataUpdate(data);
        lastWebSocketMessage = Date.now();
    });

    // Custom server lifecycle events emitted by backend
    socket.on('server_found', (payload) => {
        try {
            if (statusOverlay && !statusOverlay.classList.contains('hidden')) {
                setTimeout(() => {
                    tryHideOverlay();
                }, 200);
            }
        } catch (_) {}
    });

    socket.on('player_uuid', (payload) => {
        // Store the player UID
        try {
            if (payload && payload.uid !== undefined && payload.uid !== null) {
                currentPlayerUid = payload.uid;
            }
        } catch (_) {}

        if (!hasReceivedServerData && !statusOverlay?.classList.contains('hidden')) {
            setTimeout(() => {
                tryHideOverlay();
            }, 500);
        } else {
            console.log('Player UUID received, waiting for combat data...');
        }
    });

    socket.on('user_deleted', (data) => {
        console.log(`User ${data.uid} was removed due to inactivity.`);
        delete allUsers[data.uid];
        updateAll();
        // If there are no users left, reset the DPS session/timer
        maybeResetIfEmpty();
    });

    socket.on('reset', (payload = {}) => {
        handleServerReset(payload.reason || 'server');
    });

    socket.on('connect_error', (error) => {
        showServerStatus('disconnected');
        console.error('WebSocket connection error:', error);
    });
}

function checkConnection() {
    if (!isWebSocketConnected && socket?.disconnected) {
        showServerStatus('reconnecting');
        socket.connect();
    }

    if (isWebSocketConnected && Date.now() - lastWebSocketMessage > WEBSOCKET_RECONNECT_INTERVAL) {
        isWebSocketConnected = false;
        if (socket) socket.disconnect();
        connectWebSocket();
        showServerStatus('reconnecting');
    }
}

function startStartupOverlay() {
    if (!statusOverlay || !statusOverlayText) {
        return;
    }

    resetOverlayState();
    // Ensure the main container reserves space for the overlay while starting
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) mainContainer.classList.add('loading-initial');

    // Directly show the finding-server overlay (skip welcome message)
    showOverlayMessage(FINDING_SERVER_MESSAGE, true);
}

function resetOverlayState() {
    clearTimeout(overlayMessageTimeout);
    overlayMessageTimeout = null;
    clearTimeout(overlayHideTimeout);
    overlayHideTimeout = null;

    if (overlayWaitingInterval) {
        clearInterval(overlayWaitingInterval);
        overlayWaitingInterval = null;
    }

    overlayTimerStartMs = null;
    overlayCurrentMessage = '';
    overlayLastChange = Date.now();
    hasReceivedServerData = false;

    if (statusOverlayTimer) {
        statusOverlayTimer.classList.add('hidden');
        statusOverlayTimer.textContent = '';
    }
}

function showOverlayMessage(text, showTimer = false) {
    if (!statusOverlay || !statusOverlayText) {
        return;
    }

    // Stop any existing timer
    if (overlayWaitingInterval) {
        clearInterval(overlayWaitingInterval);
        overlayWaitingInterval = null;
    }

    statusOverlay.classList.remove('hidden');
    statusOverlay.classList.remove('fade-out');
    statusOverlayText.textContent = text;
    overlayCurrentMessage = text;
    overlayLastChange = Date.now();

    if (text === FINDING_SERVER_MESSAGE) {
        try {
            requestAnimationFrame(() => {
                try {
                    const controlsEl = document.querySelector('.controls');
                    const footerEl = document.querySelector('.footer');
                    const contentEl = statusOverlay?.querySelector('.status-overlay-content');

                    const controlsH = controlsEl ? controlsEl.getBoundingClientRect().height : 0;
                    const footerH = footerEl ? footerEl.getBoundingClientRect().height : 0;
                    const contentH = contentEl ? contentEl.getBoundingClientRect().height : 0;
                    const EXTRA = 12;

                    const computedNeeded = Math.round(controlsH + contentH + footerH + EXTRA);
                    const target = Math.max(200, computedNeeded);
                    ResizeController.requestHeight('overlay', {
                        heightHint: target,
                        screen: SCREEN_DPS,
                        immediate: true,
                    });
                } catch (_) {}
            });
        } catch (_) {}
    }

    // Start or stop timer based on showTimer flag
    if (showTimer) {
        startOverlayTimer();
    } else {
        if (statusOverlayTimer) {
            statusOverlayTimer.classList.add('hidden');
            statusOverlayTimer.textContent = '';
        }
        overlayTimerStartMs = null;
    }
}

function startOverlayTimer() {
    if (!statusOverlayTimer) {
        return;
    }

    // Stop any existing timer
    if (overlayWaitingInterval) {
        clearInterval(overlayWaitingInterval);
        overlayWaitingInterval = null;
    }

    // Reset timer start time
    overlayTimerStartMs = Date.now();

    // Show timer element
    statusOverlayTimer.classList.remove('hidden');
    statusOverlayTimer.textContent = 'Waiting 0.0s';

    // Update timer every 100ms
    overlayWaitingInterval = setInterval(() => {
        if (!statusOverlayTimer || overlayTimerStartMs === null) return;
        const elapsedSeconds = (Date.now() - overlayTimerStartMs) / 1000;
        statusOverlayTimer.textContent = `Waiting ${elapsedSeconds.toFixed(1)}s`;
    }, 100);
}

function stopOverlayTimer(showFinalTime = false) {
    if (overlayWaitingInterval) {
        clearInterval(overlayWaitingInterval);
        overlayWaitingInterval = null;
    }

    if (!statusOverlayTimer) {
        overlayTimerStartMs = null;
        return;
    }

    if (showFinalTime && overlayTimerStartMs !== null) {
        const elapsedSeconds = (Date.now() - overlayTimerStartMs) / 1000;
        statusOverlayTimer.textContent = `Connected in ${elapsedSeconds.toFixed(1)}s`;
        statusOverlayTimer.classList.remove('hidden');
    } else {
        statusOverlayTimer.classList.add('hidden');
        statusOverlayTimer.textContent = '';
    }

    overlayTimerStartMs = null;
}

function transitionOverlayMessage(nextText, showTimer = false, onDisplayed) {
    const now = Date.now();
    const elapsed = now - overlayLastChange;
    const waitTime = Math.max(0, OVERLAY_MIN_DURATION - elapsed);

    clearTimeout(overlayMessageTimeout);
    overlayMessageTimeout = setTimeout(() => {
        showOverlayMessage(nextText, showTimer);
        if (typeof onDisplayed === 'function') {
            onDisplayed();
        }
    }, waitTime);
}

function tryHideOverlay() {
    if (!isWebSocketConnected && !hasReceivedServerData) {
        if (!overlayHideTimeout) {
            overlayHideTimeout = setTimeout(() => {
                hideOverlay();
            }, 30000);
        }
        return;
    }

    stopOverlayTimer(true);
    const elapsed = Date.now() - overlayLastChange;
    const waitTime = Math.max(0, OVERLAY_MIN_DURATION - elapsed);

    clearTimeout(overlayHideTimeout);
    overlayHideTimeout = setTimeout(() => {
        hideOverlay();
    }, waitTime);
}

function hideOverlay() {
    if (!statusOverlay || statusOverlay.classList.contains('hidden')) {
        return;
    }

    clearTimeout(overlayMessageTimeout);
    overlayMessageTimeout = null;
    clearTimeout(overlayHideTimeout);
    overlayHideTimeout = null;

    if (overlayWaitingInterval) {
        clearInterval(overlayWaitingInterval);
        overlayWaitingInterval = null;
    }

    overlayTimerStartMs = null;
    overlayCurrentMessage = '';

    if (statusOverlayTimer) {
        statusOverlayTimer.classList.add('hidden');
        statusOverlayTimer.textContent = '';
    }

    statusOverlay.classList.add('fade-out');
    setTimeout(() => {
        statusOverlay?.classList.add('hidden');
        statusOverlay?.classList.remove('fade-out');
        // Remove the temporary loading-initial class so the container can shrink
        const mainContainer = document.querySelector('.main-container');
        if (mainContainer) mainContainer.classList.remove('loading-initial');
        try {
            if (windowHeightMode === 'auto') {
                if (columnsContainer && !columnsContainer.classList.contains('hidden')) {
                    ResizeController.requestHeight('overlay-hidden', {
                        immediate: true,
                        measure: true,
                        screen: SCREEN_DPS,
                    });
                } else {
                    ResizeController.requestHeight('overlay-hidden', { immediate: true, measure: true });
                }
            }
        } catch (_) {}
    }, 400);
}

// Immediately hide overlay without animation (used when first packet already contains DPS rows)
function hideOverlayImmediate() {
    if (!statusOverlay || statusOverlay.classList.contains('hidden')) return;

    clearTimeout(overlayMessageTimeout);
    overlayMessageTimeout = null;
    clearTimeout(overlayHideTimeout);
    overlayHideTimeout = null;
    if (overlayWaitingInterval) {
        clearInterval(overlayWaitingInterval);
        overlayWaitingInterval = null;
    }
    overlayTimerStartMs = null;
    overlayCurrentMessage = '';
    if (statusOverlayTimer) {
        statusOverlayTimer.classList.add('hidden');
        statusOverlayTimer.textContent = '';
    }
    statusOverlay.classList.add('hidden');
    statusOverlay.classList.remove('fade-out');
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) mainContainer.classList.remove('loading-initial');
    try {
        if (windowHeightMode === 'auto') {
            if (columnsContainer && !columnsContainer.classList.contains('hidden')) {
                ResizeController.requestHeight('overlay-hidden', {
                    immediate: true,
                    measure: true,
                    screen: SCREEN_DPS,
                });
            } else {
                ResizeController.requestHeight('overlay-hidden', { immediate: true, measure: true });
            }
        }
    } catch (_) {}
}

function initialize() {
    startStartupOverlay();
    connectWebSocket();
    checkConnectionIntervalId = setInterval(checkConnection, WEBSOCKET_RECONNECT_INTERVAL);
    fetchCurrentPlayerUid();
    playerUidIntervalId = setInterval(fetchCurrentPlayerUid, 10000);
    loadSettings();
    fetchPauseState();
    updateDateTime();
    dateTimeIntervalId = setInterval(updateDateTime, 1000);
    if (totalsHeaderEl) totalsHeaderEl.classList.remove('hidden');
    updateTotalsHeader();
    totalsIntervalId = setInterval(updateTotalsHeader, 500);
}

// Date/time formatter cached for reuse
let _dateTimeFormatter = null;
let _dateTimeLocale = null;

function _ensureDateTimeFormatter(locale) {
    try {
        const opts = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            // Leave hour12 undefined so Intl decides based on locale/OS preferences
        };
        _dateTimeFormatter = new Intl.DateTimeFormat(locale || undefined, opts);
        _dateTimeLocale = locale || null;
    } catch (e) {
        // Fallback to default locale
        _dateTimeFormatter = null;
        _dateTimeLocale = null;
    }
}

function updateDateTime() {
    if (!currentDateTime) return;

    try {
        const now = new Date();
        currentDateTime.textContent = formatDateTimeWithSelection(now);
    } catch (e) {
        // Last-resort fallback
        currentDateTime.textContent = new Date().toLocaleString();
    }
}

// Format helpers for the user-selectable formats
let currentDateTimeFormat = 'YYYY-MM-DD HH:mm:ss';

function pad(n, digits = 2) {
    return String(n).padStart(digits, '0');
}

function formatDateTimeWithSelection(date) {
    const fmt = currentDateTimeFormat;
    if (!date || !fmt) return new Date().toLocaleString();
    const Y = date.getFullYear();
    const M = pad(date.getMonth() + 1);
    const D = pad(date.getDate());
    const H = pad(date.getHours());
    const m = pad(date.getMinutes());
    const s = pad(date.getSeconds());
    const hh12 = pad(((date.getHours() + 11) % 12) + 1);
    const A = date.getHours() >= 12 ? 'PM' : 'AM';

    switch (fmt) {
        case 'YYYY-MM-DD HH:mm:ss':
            return `${Y}-${M}-${D} ${H}:${m}:${s}`;
        case 'DD/MM/YYYY HH:mm:ss':
            return `${D}/${M}/${Y} ${H}:${m}:${s}`;
        case 'MM/DD/YYYY hh:mm:ss A':
            return `${M}/${D}/${Y} ${hh12}:${m}:${s} ${A}`;
        case 'MMM DD, YYYY HH:mm:ss':
            return `${date.toLocaleString(undefined, { month: 'short' })} ${pad(date.getDate())}, ${Y} ${H}:${m}:${s}`;
        case 'ISO':
            return date.toISOString();
        default:
            return date.toLocaleString();
    }
}

async function loadSettings() {
    isLoadingSettings = true;
    try {
        const response = await fetch(`http://${SERVER_URL}/api/settings`);
        const result = await response.json();
        if (result.code === 0 && result.data) {
            if (result.data.hideHpsBar !== undefined) {
                hideHpsBar = !!result.data.hideHpsBar;
                if (hideHpsToggle) hideHpsToggle.checked = hideHpsBar;
            }
            if (result.data.hideMitigationBar !== undefined) {
                // Mirror saved mitigation visibility so the bar stays in sync across launches
                hideMitigationBar = !!result.data.hideMitigationBar;
                if (hideMitigationToggle) hideMitigationToggle.checked = hideMitigationBar;
            }
            if (result.data.windowHeightMode !== undefined) {
                setWindowHeightMode(result.data.windowHeightMode, { skipSave: true });
            } else {
                setWindowHeightMode('static', { skipSave: true });
            }
            if (result.data.autoPlayerCount !== undefined) {
                setAutoPlayerCount(result.data.autoPlayerCount, { skipSave: true });
            }
            // Load static heights
            if (result.data.staticHeightDps !== undefined) {
                staticHeightDps = Math.max(BASE_WINDOW_HEIGHT, Math.round(result.data.staticHeightDps));
            }
            if (result.data.staticHeightSettings !== undefined) {
                staticHeightSettings = Math.max(MIN_NON_DPS_HEIGHT, Math.round(result.data.staticHeightSettings));
            }
            if (result.data.staticHeightSkills !== undefined) {
                staticHeightSkills = Math.max(MIN_NON_DPS_HEIGHT, Math.round(result.data.staticHeightSkills));
            }
            if (result.data.dateTimeFormat) {
                currentDateTimeFormat = result.data.dateTimeFormat;
                if (dateTimeFormatSelect) dateTimeFormatSelect.value = currentDateTimeFormat;
            }
            if (result.data.fontSize) {
                const size = String(result.data.fontSize);
                setFontSize(size);
                const sel = document.getElementById('fontSizeSelect');
                if (sel) sel.value = size;
            } else {
                setFontSize('small');
                if (fontSizeSelect) fontSizeSelect.value = 'small';
            }
            if (result.data.useClassColors !== undefined) {
                useClassColors = !!result.data.useClassColors;
                if (classColorToggle) classColorToggle.checked = useClassColors;
            }
            if (result.data.backgroundOpacity !== undefined && opacitySlider) {
                opacitySlider.value = String(result.data.backgroundOpacity);
                setBackgroundOpacity(opacitySlider.value);
            }
            if (result.data.enableGlobalShortcuts !== undefined) {
                enableGlobalShortcuts = !!result.data.enableGlobalShortcuts;
                if (globalShortcutsToggle) globalShortcutsToggle.checked = enableGlobalShortcuts;
                if (typeof window.electronAPI?.toggleGlobalShortcuts === 'function') {
                    window.electronAPI.toggleGlobalShortcuts(enableGlobalShortcuts);
                }
            }
            if (result.data.disableUiFreezeOnInactivity !== undefined) {
                disableUiFreezeOnInactivity = !!result.data.disableUiFreezeOnInactivity;
                if (disableUiFreezeToggle) disableUiFreezeToggle.checked = disableUiFreezeOnInactivity;
            }
            if (result.data.autoClearOnServerChange !== undefined) {
                autoClearOnServerChange = !!result.data.autoClearOnServerChange;
                if (autoClearServerChangeToggle) autoClearServerChangeToggle.checked = autoClearOnServerChange;
            }
            if (result.data.autoClearTimeoutSeconds !== undefined) {
                autoClearTimeoutSeconds = Math.max(0, parseInt(result.data.autoClearTimeoutSeconds, 10) || 0);
                if (autoClearTimeoutInput) autoClearTimeoutInput.value = String(autoClearTimeoutSeconds);
            }
            if (result.data.disableUserTimeout !== undefined) {
                if (disableUserTimeoutToggle) disableUserTimeoutToggle.checked = !!result.data.disableUserTimeout;
            }
        }
    } catch (error) {
        console.warn('Failed to load settings:', error);
    } finally {
        isLoadingSettings = false;
        // Initialize the auto player count input UI
        if (autoPlayerCountInput) {
            autoPlayerCountInput.value = String(autoPlayerCount);
        }
        updateAutoHeightControlsVisibility();
        if (windowHeightMode === 'auto') {
            lastRequestedHeight = null;
            updateAll();
        } else {
            // Apply stored static height for the currently visible screen so text is visible on load
            try {
                lastRequestedHeight = null;
                ensureHeightForScreen(getCurrentScreen());
            } catch (e) {
                // ignore
            }
        }
    }
}

async function saveSettings() {
    if (isLoadingSettings) {
        return;
    }

    try {
        const settings = {
            hideHpsBar: !!hideHpsBar,
            hideMitigationBar: !!hideMitigationBar,
            windowHeightMode,
            autoPlayerCount,
            staticHeightDps,
            staticHeightSettings,
            staticHeightSkills,
            dateTimeFormat: currentDateTimeFormat,
            fontSize: getCurrentFontSize(),
            useClassColors: !!useClassColors,
            backgroundOpacity: opacitySlider ? opacitySlider.value : undefined,
            enableGlobalShortcuts: !!enableGlobalShortcuts,
            disableUiFreezeOnInactivity: !!disableUiFreezeOnInactivity,
            autoClearOnServerChange: !!autoClearOnServerChange,
            autoClearTimeoutSeconds: autoClearTimeoutSeconds,
            disableUserTimeout: !!(disableUserTimeoutToggle ? disableUserTimeoutToggle.checked : undefined),
        };
        await fetch(`http://${SERVER_URL}/api/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(settings),
        });
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
}

// Wire dropdown change handler
if (dateTimeFormatSelect) {
    dateTimeFormatSelect.addEventListener('change', (e) => {
        currentDateTimeFormat = e.target.value;
        saveSettings();
        updateDateTime();
    });
}

// Wire font size select
if (fontSizeSelect) {
    fontSizeSelect.addEventListener('change', (e) => {
        const size = e.target.value;
        setFontSize(size);
        saveSettings();
    });
}

async function fetchCurrentPlayerUid() {
    try {
        const response = await fetch(`http://${SERVER_URL}/api/current-player`);
        const result = await response.json();
        if (result.code === 0 && result.uid !== null) {
            // Only update if UID changed
            if (currentPlayerUid !== result.uid) {
                currentPlayerUid = result.uid;
                console.log('Current player UID set to:', currentPlayerUid);
                // Re-color all users to apply current player color
                userColors = {};
                userColorSource = {};
                // Re-render to apply current player colors
                updateAll();
                // After we obtain the current player UID, try to hide overlay
                tryHideOverlay();
            }
        }
    } catch (error) {
        console.warn('Failed to fetch current player UID:', error);
    }
}

async function fetchPauseState() {
    try {
        const resp = await fetch(`http://${SERVER_URL}/api/pause`);
        const result = await resp.json();
        if (result && result.code === 0) {
            isPaused = !!result.paused;
            if (pauseButton) pauseButton.textContent = isPaused ? '▶️' : '⏸️';
            showServerStatus(isPaused ? 'paused' : 'connected');
        }
    } catch (e) {}
}

function toggleSettings() {
    const isSettingsVisible = !settingsContainer.classList.contains('hidden');

    if (isSettingsVisible) {
        settingsContainer.classList.add('hidden');
        columnsContainer.classList.remove('hidden');
        if (totalsHeaderEl) totalsHeaderEl.classList.remove('hidden');
        // Ensure DPS static height is applied when returning from settings
        if (windowHeightMode !== 'auto') ensureHeightForScreen(SCREEN_DPS);
        updateAll();
        if (windowHeightMode === 'auto') {
            ResizeController.requestHeight('screen-switch', { immediate: true, measure: true, screen: SCREEN_DPS });
        }
    } else {
        settingsContainer.classList.remove('hidden');
        columnsContainer.classList.add('hidden');
        if (totalsHeaderEl) totalsHeaderEl.classList.add('hidden');
        ensureHeightForScreen(SCREEN_SETTINGS);
        helpContainer.classList.add('hidden'); // Also hide help
        skillDetailsContainer.classList.add('hidden'); // Also hide skill details
    }
}

function toggleHelp() {
    const isHelpVisible = !helpContainer.classList.contains('hidden');
    if (isHelpVisible) {
        helpContainer.classList.add('hidden');
        columnsContainer.classList.remove('hidden');
        if (totalsHeaderEl) totalsHeaderEl.classList.remove('hidden');
        // Ensure DPS static height is applied when returning from help
        if (windowHeightMode !== 'auto') ensureHeightForScreen(SCREEN_DPS);
        updateAll();
        if (windowHeightMode === 'auto') {
            ResizeController.requestHeight('screen-switch', { immediate: true, measure: true, screen: SCREEN_DPS });
        }
    } else {
        helpContainer.classList.remove('hidden');
        columnsContainer.classList.add('hidden');
        if (totalsHeaderEl) totalsHeaderEl.classList.add('hidden');
        ensureHeightForScreen(SCREEN_HELP);
        settingsContainer.classList.add('hidden'); // Also hide settings
        skillDetailsContainer.classList.add('hidden'); // Also hide skill details
    }
}

async function showSkillDetails(userId) {
    try {
        // Ensure skill screen static height is applied
        // Stop any existing refresh timer
        stopSkillAutoRefresh();

        // Fetch and render immediately, then start a 1s refresh timer
        await fetchAndRenderSkill(userId);
        currentSkillUserId = userId;
        currentSkillRefreshTimer = setInterval(() => fetchAndRenderSkill(userId), 1000);
        // Start separate timer for CPS updates (every 1 second)
        currentSkillCpsTimer = setInterval(() => updateSkillCps(), 1000);
    } catch (error) {
        console.error('Error fetching skill details:', error);
    }
}

async function fetchAndRenderSkill(userId) {
    try {
        const response = await fetch(`http://${SERVER_URL}/api/skill/${userId}`);
        const result = await response.json();

        if (result.code !== 0) {
            console.error('Failed to fetch skill data:', result.msg);
            return;
        }

        const userData = result.data;
        const user = allUsers[userId] || {};

        // Update header with user info
        let displayName = '...';
        if (userData?.name) {
            if (user?.fightPoint) {
                displayName = `${userData.name} (${user.fightPoint})`;
            } else {
                displayName = userData.name;
            }
        } else if (user?.name) {
            displayName = user.name;
        }
        if (skillDetailsUserName) skillDetailsUserName.textContent = displayName;
        if (skillDetailsUserStats)
            skillDetailsUserStats.textContent = user.total_damage
                ? `${formatNumber(user.total_damage.total)} (${formatNumber(user.total_dps)} DPS)`
                : '';

        try {
            const professionString =
                allUsers[userId] && allUsers[userId].profession ? allUsers[userId].profession.trim() : '';
            const parsed = parseProfessionString(professionString || '');
            const mainProfession = parsed.main || '';
            const spec = parsed.spec || '';
            const knownClass = mainProfession && getClassColor(mainProfession);
            if (knownClass && skillDetailsClassIcon) {
                const iconFileName = mainProfession.toLowerCase().replace(/ /g, '_') + '.png';
                skillDetailsClassIcon.src = `assets/${iconFileName}`;
                skillDetailsClassIcon.alt = spec ? `${mainProfession} - ${spec}` : mainProfession;
                skillDetailsClassIcon.classList.remove('hidden');
                skillDetailsClassIcon.onerror = function () {
                    this.classList.add('hidden');
                };
            } else if (skillDetailsClassIcon) {
                skillDetailsClassIcon.classList.add('hidden');
                skillDetailsClassIcon.src = '';
                skillDetailsClassIcon.alt = '';
            }

            if (skillDetailsClassName) {
                if (knownClass) {
                    skillDetailsClassName.textContent = spec ? `${mainProfession} - ${spec}` : mainProfession;
                    skillDetailsClassName.classList.remove('hidden');
                } else {
                    skillDetailsClassName.textContent = '';
                    skillDetailsClassName.classList.add('hidden');
                }
            }
        } catch (e) {}

        // Convert skills object to array and sort by total damage
        const skillsArray = Object.entries(userData.skills || {}).map(([skillId, skill]) => ({
            skillId,
            ...skill,
        }));

        skillsArray.sort((a, b) => b.totalDamage - a.totalDamage);

        // Calculate total damage for percentages
        const totalDamage = skillsArray.reduce((sum, skill) => sum + skill.totalDamage, 0);

        // Render skill list
        skillDetailsList.innerHTML = '';

        skillsArray.forEach((skill, index) => {
            const damagePercent = totalDamage > 0 ? (skill.totalDamage / totalDamage) * 100 : 0;
            const dps =
                user.total_dps > 0 && user.total_damage && user.total_damage.total > 0
                    ? (skill.totalDamage / user.total_damage.total) * user.total_dps
                    : 0;

            // Ensure skill detail colors reflect any upgraded class color
            if (!userColors[userId]) {
                userColors[userId] = getNextColorShades();
                userColorSource[userId] = 'random';
            } else if (useClassColors && userColorSource[userId] !== 'class') {
                const professionString =
                    allUsers[userId] && allUsers[userId].profession ? allUsers[userId].profession.trim() : '';
                const mainProfession = professionString ? professionString.split('(')[0].trim() : '';
                const classColor = getClassColor(mainProfession);
                if (classColor) {
                    userColors[userId] = classColor;
                    userColorSource[userId] = 'class';
                }
            }
            const colors = userColors[userId];
            const barColor = skill.type === '治疗' ? colors.hps : colors.dps;
            const barColorHalf = toAlpha(barColor, 0.5);

            const skillItem = document.createElement('div');
            skillItem.className = 'skill-item';
            // Store skill metadata for CPS calculation
            skillItem.dataset.skillId = skill.skillId;
            skillItem.dataset.startTime = skill.startTime || Date.now();
            skillItem.dataset.totalCasts = skill.totalCasts || 0;

            const casts = skill.totalCasts || skill.totalCount || 0;
            const cps = skill.castsPerSecond || 0;

            // Build structure then safely inject potentially user-provided text
            skillItem.innerHTML = `
                <div class="skill-bar">
                    <div class="skill-bar-fill" style="width: ${damagePercent}%; --fill-color: ${barColor}; --fill-color-half: ${barColorHalf};"></div>
                    <div class="skill-content">
                        <span class="skill-rank">${index + 1}.</span>
                        <span class="skill-name"></span>
                        <span class="skill-stats">${formatNumber(skill.totalDamage)} (${formatNumber(dps)} DPS, ${damagePercent.toFixed(1)}%)</span>
                        <span class="skill-casts">${casts} casts</span>
                        <span class="skill-cps">${cps.toFixed(2)} CPS</span>
                    </div>
                </div>
            `;

            const skillNameSpan = skillItem.querySelector('.skill-name');
            if (skillNameSpan) {
                skillNameSpan.textContent = typeof skill.displayName === 'string' ? skill.displayName : '';
            }

            skillDetailsList.appendChild(skillItem);
        });

        // Show skill details, hide main list
        columnsContainer.classList.add('hidden');
        if (totalsHeaderEl) totalsHeaderEl.classList.add('hidden');
        settingsContainer.classList.add('hidden');
        helpContainer.classList.add('hidden');
        skillDetailsContainer.classList.remove('hidden');
        ensureHeightForScreen(SCREEN_SKILLS);
    } catch (error) {
        console.error('Error fetching skill details:', error);
    }
}

function stopSkillAutoRefresh() {
    if (currentSkillRefreshTimer) {
        clearInterval(currentSkillRefreshTimer);
        currentSkillRefreshTimer = null;
    }
    if (currentSkillCpsTimer) {
        clearInterval(currentSkillCpsTimer);
        currentSkillCpsTimer = null;
    }
    currentSkillUserId = null;
}

function updateSkillCps() {
    // Update only the CPS values for all visible skills without re-rendering everything
    const skillItems = skillDetailsList.querySelectorAll('.skill-item');
    const now = Date.now();

    skillItems.forEach((skillItem) => {
        const skillId = skillItem.dataset.skillId;
        const startTime = parseFloat(skillItem.dataset.startTime);
        const totalCasts = parseInt(skillItem.dataset.totalCasts);

        if (skillId && startTime && totalCasts) {
            const durationSec = Math.max(0.001, (now - startTime) / 1000);
            const cps = totalCasts / durationSec;

            const cpsElement = skillItem.querySelector('.skill-cps');
            if (cpsElement) {
                cpsElement.textContent = `${cps.toFixed(2)} CPS`;
            }
        }
    });
}

function backToMain() {
    skillDetailsContainer.classList.add('hidden');
    columnsContainer.classList.remove('hidden');
    if (totalsHeaderEl) totalsHeaderEl.classList.remove('hidden');
    stopSkillAutoRefresh();
    updateAll();
    // If static mode, ensure DPS height is applied; if auto, updateAll will request auto height
    if (windowHeightMode !== 'auto') {
        ensureHeightForScreen(SCREEN_DPS);
    }
    if (windowHeightMode === 'auto') {
        ResizeController.requestHeight('screen-switch', { immediate: true, measure: true, screen: SCREEN_DPS });
    }
}

// Note: previous implementation attempted to remember the window height when entering
// settings/help and restore it when returning. That caused cross-screen interference.
// Each screen now strictly uses its own static height variable and manual resizes update
// the static height for the screen currently visible.

function setBackgroundOpacity(value) {
    document.documentElement.style.setProperty('--main-bg-opacity', value);
}

document.addEventListener('DOMContentLoaded', () => {
    initialize();
    updateAutoHeightControlsVisibility();

    // Opacity slider handling is defined below with saveSettings persistence

    // Initialize class color toggle
    if (classColorToggle) {
        useClassColors = classColorToggle.checked;
        classColorToggle.addEventListener('change', (e) => {
            useClassColors = e.target.checked;
            // clear cached colors so new mapping takes effect
            userColors = {};
            userColorSource = {};
            saveSettings();
            updateAll();
        });
    }

    // Initialize global shortcuts toggle
    if (globalShortcutsToggle) {
        enableGlobalShortcuts = globalShortcutsToggle.checked;
        globalShortcutsToggle.addEventListener('change', (e) => {
            enableGlobalShortcuts = e.target.checked;
            window.electronAPI.toggleGlobalShortcuts(enableGlobalShortcuts);
            saveSettings();
        });
    }

    if (disableUiFreezeToggle) {
        disableUiFreezeOnInactivity = disableUiFreezeToggle.checked;
        disableUiFreezeToggle.addEventListener('change', (e) => {
            disableUiFreezeOnInactivity = e.target.checked;
            saveSettings();
            updateAll();
        });
    }

    if (autoClearServerChangeToggle) {
        autoClearOnServerChange = autoClearServerChangeToggle.checked;
        autoClearServerChangeToggle.addEventListener('change', (e) => {
            autoClearOnServerChange = e.target.checked;
            saveSettings();
        });
    }

    if (disableUserTimeoutToggle) {
        disableUserTimeoutToggle.addEventListener('change', () => {
            saveSettings();
        });
    }

    if (autoClearTimeoutInput) {
        autoClearTimeoutSeconds = parseInt(autoClearTimeoutInput.value, 10) || 0;
        autoClearTimeoutInput.addEventListener('change', (e) => {
            autoClearTimeoutSeconds = Math.max(0, parseInt(e.target.value, 10) || 0);
            saveSettings();
        });
    }

    if (hideHpsToggle) {
        hideHpsBar = hideHpsToggle.checked;
        hideHpsToggle.addEventListener('change', (e) => {
            hideHpsBar = e.target.checked;
            saveSettings();
            updateAll();
        });
    }

    if (hideMitigationToggle) {
        hideMitigationBar = hideMitigationToggle.checked;
        hideMitigationToggle.addEventListener('change', (e) => {
            hideMitigationBar = e.target.checked;
            // Keep mitigation UI state and persisted preference in lock-step
            saveSettings();
            updateAll();
        });
    }

    // Opacity slider change should persist
    if (opacitySlider) {
        setBackgroundOpacity(opacitySlider.value);
        opacitySlider.addEventListener('input', (event) => {
            setBackgroundOpacity(event.target.value);
            saveSettings();
        });
    }

    // Height mode radio buttons (DPS view only)
    if (windowHeightModeStaticRadio && windowHeightModeAutoRadio) {
        windowHeightModeStaticRadio.addEventListener('change', (e) => {
            if (e.target.checked) {
                setWindowHeightMode('static');
            }
        });
        windowHeightModeAutoRadio.addEventListener('change', (e) => {
            if (e.target.checked) {
                setWindowHeightMode('auto');
            }
        });
    }

    // Auto player count input
    if (autoPlayerCountInput) {
        autoPlayerCountInput.addEventListener('change', (e) => {
            setAutoPlayerCount(e.target.value);
        });
        autoPlayerCountInput.addEventListener('input', (e) => {
            setAutoPlayerCount(e.target.value, { skipSave: true });
        });
    }

    if (window.electronAPI && typeof window.electronAPI.onWindowResized === 'function') {
        window.electronAPI.onWindowResized((bounds) => {
            handleWindowResized(bounds || {});
        });
    }

    // Listen for the passthrough toggle event from the main process
    window.electronAPI.onTogglePassthrough((isIgnoring) => {
        if (isIgnoring) {
            allButtons.forEach((button) => {
                button.classList.add('hidden');
            });
            passthroughTitle.classList.remove('hidden');
            columnsContainer.classList.remove('hidden');
            settingsContainer.classList.add('hidden');
            helpContainer.classList.add('hidden');
            skillDetailsContainer.classList.add('hidden');
        } else {
            allButtons.forEach((button) => {
                button.classList.remove('hidden');
            });
            passthroughTitle.classList.add('hidden');
        }
    });

    // Listen for clear-dps message from main shortcuts
    if (window.electronAPI.onClearDps) {
        window.electronAPI.onClearDps(() => {
            clearData();
        });
    }
});

window.clearData = clearData;
window.togglePause = togglePause;
window.toggleSettings = toggleSettings;
window.closeClient = closeClient;
window.toggleHelp = toggleHelp;
window.showSkillDetails = showSkillDetails;
window.backToMain = backToMain;

// --- Version label and initial forced height handling ---
(function setupVersionAndInitialHeight() {
    const appVersionEl = document.getElementById('appVersion');
    // Ask main process for version if available
    try {
        if (window.electronAPI?.getVersion) {
            window.electronAPI.getVersion().then((ver) => {
                if (appVersionEl && ver) appVersionEl.textContent = `v${ver}`;
            });
        }
    } catch (_) {}

    // Add a CSS class to ensure a safe minimum height during initial load
    const main = document.querySelector('.main-container');
    if (main) main.classList.add('loading-initial');

    // When the overlay hides for the first time, remove the loading constraint
    const observer = new MutationObserver(() => {
        const overlay = document.getElementById('statusOverlay');
        if (!overlay) return;
        const hidden = overlay.classList.contains('hidden');
        if (hidden && main) {
            main.classList.remove('loading-initial');
            observer.disconnect();
        }
    });
    const overlay = document.getElementById('statusOverlay');
    if (overlay) observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
})();

// Ensure background timers and socket are cleaned up when window is closed/reloaded
window.addEventListener('beforeunload', () => {
    try {
        if (checkConnectionIntervalId) clearInterval(checkConnectionIntervalId);
        if (playerUidIntervalId) clearInterval(playerUidIntervalId);
        if (dateTimeIntervalId) clearInterval(dateTimeIntervalId);
        if (totalsIntervalId) clearInterval(totalsIntervalId);
        stopSkillAutoRefresh();
        if (overlayWaitingInterval) clearInterval(overlayWaitingInterval);
        if (overlayHideTimeout) clearTimeout(overlayHideTimeout);
        overlayHideTimeout = null;
        if (overlayMessageTimeout) clearTimeout(overlayMessageTimeout);
        overlayMessageTimeout = null;
        if (socket) {
            try {
                socket.off && socket.off();
            } catch (_) {}
            try {
                socket.removeAllListeners && socket.removeAllListeners();
            } catch (_) {}
            try {
                socket.close && socket.close();
            } catch (_) {}
        }
    } catch (_) {}
});

// ---- Totals header logic ----
function ensureDpsStartTime() {
    if (dpsStartTimeMs !== null) return;
    // Start when we observe any positive total damage
    const usersArray = Object.values(allUsers);
    const totalDamage = usersArray.reduce((sum, u) => sum + (u?.total_damage?.total || 0), 0);
    if (totalDamage > 0) {
        dpsStartTimeMs = Date.now();
        pausedAccumulatedMs = 0;
        pausedStartedAtMs = null;
        if (lastActivityAtMs === null) lastActivityAtMs = dpsStartTimeMs;
    }
}

function getDpsElapsedMs() {
    if (dpsStartTimeMs === null) return 0;
    const now = Date.now();
    const pausedNowMs = pausedStartedAtMs ? now - pausedStartedAtMs : 0;
    return Math.max(0, now - dpsStartTimeMs - pausedAccumulatedMs - pausedNowMs);
}

function formatDurationShort(ms) {
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    return `${minutes}:${pad(seconds)}`;
}

function updateTotalsHeader() {
    if (!totalsHeaderEl) return;
    if (shouldFreezeUi()) return;
    const usersArray = Object.values(allUsers);
    const visibleUsers = usersArray.filter((u) => (u?.total_dps || 0) > 0 || (u?.total_hps || 0) > 0);
    const totalDamage = usersArray.reduce((sum, u) => sum + (u?.total_damage?.total || 0), 0);
    if (visibleUsers.length === 0) {
        if (totalDamageEl) totalDamageEl.textContent = '0';
        if (totalDpsEl) totalDpsEl.textContent = '0 DPS';
        if (dpsDurationEl) dpsDurationEl.textContent = '0:00';
        return;
    }
    const elapsedMsServer =
        serverMeta && typeof serverMeta.groupEffectiveElapsedMs === 'number' ? serverMeta.groupEffectiveElapsedMs : 0;
    let elapsedMs = elapsedMsServer;
    if (!elapsedMs) {
        if (totalDamage > 0 && dpsStartTimeMs === null) {
            dpsStartTimeMs = Date.now();
            pausedAccumulatedMs = 0;
            pausedStartedAtMs = null;
            if (lastActivityAtMs === null) lastActivityAtMs = dpsStartTimeMs;
        }
        elapsedMs = getDpsElapsedMs();
    }
    const elapsedSec = elapsedMs > 0 ? elapsedMs / 1000 : 0;
    const totalDps = elapsedSec > 0 ? totalDamage / elapsedSec : 0;

    if (totalDamageEl) totalDamageEl.textContent = formatNumber(totalDamage);
    if (totalDpsEl) totalDpsEl.textContent = `${formatNumber(totalDps)} DPS`;
    if (dpsDurationEl) dpsDurationEl.textContent = formatDurationShort(elapsedMs);
}

function resetDpsSession() {
    dpsStartTimeMs = null;
    pausedAccumulatedMs = 0;
    pausedStartedAtMs = null;
    lastActivityAtMs = null;
    if (totalDamageEl) totalDamageEl.textContent = '0';
    if (totalDpsEl) totalDpsEl.textContent = '0 DPS';
    if (dpsDurationEl) dpsDurationEl.textContent = '0:00';
}

function maybeResetIfEmpty() {
    const usersArray = Object.values(allUsers).filter((user) => user.total_dps > 0 || user.total_hps > 0);
    if (!usersArray || usersArray.length === 0) {
        resetDpsSession();
    }
}

// Determine if the frontend should freeze UI updates due to inactivity
function shouldFreezeUi() {
    if (disableUiFreezeOnInactivity) return false;
    if (dpsStartTimeMs === null || lastActivityAtMs === null) return false;
    if (isPaused) return false;
    const now = Date.now();
    return now - lastActivityAtMs >= INACTIVITY_GRACE_MS;
}
