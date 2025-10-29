/* global window, document */
(function () {
    const SERVER_URL = 'localhost:8990';
    const params = new URLSearchParams(window.location.search);
    const uid = parseInt(params.get('uid') || '0', 10) || 0;

    const userNameEl = document.getElementById('userName');
    const userClassEl = document.getElementById('userClass');
    const userStatsEl = document.getElementById('userStats');
    const classIconEl = document.getElementById('classIcon');
    const table = document.getElementById('skillTable');
    const tbody = table.querySelector('tbody');
    const btnClose = document.getElementById('btnClose');
    const btnPin = document.getElementById('btnAlwaysOnTop');
    let socket = null;
    let latestSocketMeta = null;

    let sortKey = 'totalDamage';
    let sortDir = 'desc'; // 'asc' | 'desc'
    let refreshTimer = null;
    let lastUserSummary = null;
    let lastTotalDamage = 0;
    let lastActivityAtMs = 0;
    let isPaused = false; // Synced from server
    const INACTIVITY_GRACE_MS = 1000;

    // Cached DOM rows by skill key to avoid full reflow
    const rowCache = new Map(); // key -> { tr, cells }

    function formatNumber(n) {
        if (n === null || n === undefined) return '0';
        const abs = Math.abs(n);
        if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'm';
        if (abs >= 1_000) return (n / 1_000).toFixed(1) + 'k';
        return Math.round(n).toString();
    }

    function percent(p) {
        if (!isFinite(p)) return '0.0%';
        return (p * 100).toFixed(1) + '%';
    }

    function parseProfessionString(prof) {
        const s = (prof || '').trim();
        // Prefer parentheses if present
        const paren = s.match(/^(.*?)\s*-?\s*\((.*?)\)\s*$/);
        if (paren) return { main: paren[1].trim(), spec: paren[2].trim() };
        // Fallback to hyphen-delimited
        if (s.includes('-')) {
            const [m, rest] = s.split('-', 2);
            return { main: (m || '').trim(), spec: (rest || '').trim() };
        }
        return { main: s, spec: '' };
    }

    function getClassColor(name) {
        const n = (name || '').toLowerCase();
        if (!n) return null;
        if (['frost mage', 'stormblade', 'marksman', 'wind knight'].includes(n))
            return { dps: '#ff4269', hps: '#ff4269' };
        if (['shield guardian', 'paladin', 'tank'].includes(n)) return { dps: '#45b5fc', hps: '#45b5fc' };
        if (['bard', 'priest', 'healer'].includes(n)) return { dps: '#38de49', hps: '#38de49' };
        return { dps: '#fbbf24', hps: '#fbbf24' };
    }

    function setPinned(pinned) {
        try {
            if (window && window.electronAPI && typeof window.electronAPI.onTogglePassthrough === 'function') {
                // Not toggling passthrough; pin means always on top at BrowserWindow level, which we set by default.
            }
        } catch (_) {}
    }

    async function fetchSkillData() {
        const resp = await fetch(`http://${SERVER_URL}/api/skill/${uid}`);
        const result = await resp.json();
        if (!result || result.code !== 0) throw new Error(result?.msg || 'Failed to fetch');
        return { data: result.data, meta: result.meta || {} };
    }

    function initSocket() {
        try {
            if (typeof io === 'undefined') return;
            socket = io(`ws://${SERVER_URL}`);
            socket.on('connect', () => {});
            socket.on('data', (payload) => {
                try {
                    if (payload && payload.meta) {
                        latestSocketMeta = payload.meta;
                        isPaused = !!latestSocketMeta.paused;
                        if (
                            typeof latestSocketMeta.backgroundOpacity !== 'undefined' &&
                            latestSocketMeta.backgroundOpacity !== null
                        ) {
                            try {
                                document.documentElement.style.setProperty(
                                    '--main-bg-opacity',
                                    String(latestSocketMeta.backgroundOpacity)
                                );
                            } catch (_) {}
                        }
                    }
                } catch (_) {}
            });
            socket.on('disconnect', () => {});
        } catch (e) {}
    }

    function computeRows(userData, usersAllSummary) {
        const skills = Object.values(userData.skills || {});
        const userTotalDamage = (userData.total && userData.total.damage) || usersAllSummary?.total_damage?.total || 0;
        const userTotalDps = (userData.total && userData.total.dps) || usersAllSummary?.total_dps || 0;
        const durationSec = Math.max(0.001, (userData.durationMs || 0) / 1000);

        const rows = skills.map((s) => {
            const percentOfUser = userTotalDamage > 0 ? s.totalDamage / userTotalDamage : 0;
            const dps = userTotalDamage > 0 && userTotalDps > 0 ? (s.totalDamage / userTotalDamage) * userTotalDps : 0;
            const cps = (s.totalCasts || 0) / durationSec;
            return {
                displayName: s.displayName || '',
                totalDamage: s.totalDamage || 0,
                dps,
                percent: percentOfUser,
                totalCasts: s.totalCasts || 0,
                castsPerSecond: cps,
                critRate: s.critRate || 0,
                luckyRate: s.luckyRate || 0,
                avgHit: s.avgHit || 0,
                minHit: s.minHit || 0,
                maxHit: s.maxHit || 0,
            };
        });

        return rows;
    }

    function applySort(rows) {
        const dir = sortDir === 'asc' ? 1 : -1;
        return rows.sort((a, b) => {
            const va = a[sortKey];
            const vb = b[sortKey];
            if (typeof va === 'string' || typeof vb === 'string') {
                return dir * String(va).localeCompare(String(vb));
            }
            return dir * ((va ?? 0) - (vb ?? 0));
        });
    }

    function renderHeaderSortState() {
        const ths = table.querySelectorAll('thead th');
        ths.forEach((th) => {
            const key = th.getAttribute('data-key');
            const existing = th.querySelector('.sort-ind');
            if (existing) existing.remove();
            if (key === sortKey) {
                const span = document.createElement('span');
                span.className = 'sort-ind';
                span.textContent = sortDir === 'asc' ? '▲' : '▼';
                th.appendChild(span);
            }
        });
    }

    function ensureRow(key) {
        if (rowCache.has(key)) return rowCache.get(key);
        const tr = document.createElement('tr');
        const name = document.createElement('td');
        const percentCell = document.createElement('td');
        percentCell.className = 'right';
        const total = document.createElement('td');
        total.className = 'right';
        const dps = document.createElement('td');
        dps.className = 'right';
        const casts = document.createElement('td');
        casts.className = 'right';
        const cps = document.createElement('td');
        cps.className = 'right';
        const crit = document.createElement('td');
        crit.className = 'right';
        const lucky = document.createElement('td');
        lucky.className = 'right';
        const avg = document.createElement('td');
        avg.className = 'right';
        const min = document.createElement('td');
        min.className = 'right';
        const max = document.createElement('td');
        max.className = 'right';

        tr.append(name, percentCell, total, dps, casts, cps, crit, lucky, avg, min, max);
        tbody.appendChild(tr);
        const cells = { name, percentCell, total, dps, casts, cps, crit, lucky, avg, min, max };
        const entry = { tr, cells };
        rowCache.set(key, entry);
        return entry;
    }

    function renderRows(rows) {
        const frag = document.createDocumentFragment();
        const entries = [];
        rows.forEach((r) => {
            const key = r.displayName || '';
            const { tr, cells } = ensureRow(key);
            // Update cells without replacing the row
            cells.name.textContent = key;
            cells.percentCell.textContent = percent(r.percent);
            cells.total.textContent = formatNumber(r.totalDamage);
            cells.dps.textContent = formatNumber(r.dps);
            cells.casts.textContent = r.totalCasts;
            cells.cps.textContent = (r.castsPerSecond || 0).toFixed(2);
            cells.crit.textContent = percent(r.critRate);
            cells.lucky.textContent = percent(r.luckyRate);
            cells.avg.textContent = formatNumber(r.avgHit);
            cells.min.textContent = formatNumber(r.minHit);
            cells.max.textContent = formatNumber(r.maxHit);
            entries.push(tr);
        });
        // Reorder rows according to current sort without full re-render
        entries.forEach((tr) => frag.appendChild(tr));
        tbody.innerHTML = '';
        tbody.appendChild(frag);
    }

    async function refresh(force = false) {
        try {
            const result = await fetchSkillData();
            const userData = result.data;
            const meta = result.meta || {};
            const effectiveMeta = latestSocketMeta || meta || {};

            // Sync pause state from server
            isPaused = !!meta.paused;

            // For totals needed to compute % and DPS, we need the user's current summary. Attempt to fetch from /api/users? none.
            // The main API does not expose a single user endpoint for summary; however userData does not include totals.
            // We can derive from window.opener if available. As a fallback, sum of all skills equals total damage.
            const totalDamage =
                (userData.total && userData.total.damage) ||
                Object.values(userData.skills || {}).reduce((sum, s) => sum + (s.totalDamage || 0), 0);
            const usersAllSummary = lastUserSummary || {
                total_damage: { total: totalDamage },
                total_dps: userData.total?.dps || 0,
            };

            // Try to fetch user's current overall from a lightweight endpoint if available in future; skipped for now.

            // We'll update the header and icon only after freeze decision so the UI doesn't change
            // while the main meter is considered inactive. Prepare header values now but don't apply.
            const displayName = userData.name || `UID ${uid}`;
            const dpsText = userData.total ? `, ${formatNumber(userData.total.dps)} DPS` : '';
            const headerText = `${formatNumber(totalDamage)} total${dpsText}`;
            const preparedIcon = (() => {
                try {
                    const { main, spec } = parseProfessionString(userData.profession || '');
                    const knownClass = main && getClassColor(main);
                    if (knownClass) {
                        const iconFileName = main.toLowerCase().replace(/ /g, '_') + '.png';
                        return {
                            src: `assets/${iconFileName}`,
                            alt: spec ? `${main} - ${spec}` : main,
                            show: true,
                            main,
                            spec,
                        };
                    }
                } catch (_) {}
                return { show: false };
            })();

            // Match main meter's freeze behavior: freeze if paused OR during group inactivity grace period.
            // Use server-provided lastGroupActiveAtMs and inactivityGraceMs to align with main meter
            const now = Date.now();
            const groupLastActive = effectiveMeta.lastGroupActiveAtMs || 0;
            const groupGraceMs =
                effectiveMeta.inactivityGraceMs !== undefined && effectiveMeta.inactivityGraceMs !== null
                    ? effectiveMeta.inactivityGraceMs
                    : INACTIVITY_GRACE_MS;

            // Update per-user last activity for fallback (not used for group freeze)
            if (totalDamage > lastTotalDamage) lastActivityAtMs = now;
            lastTotalDamage = totalDamage;

            const groupInactive = groupLastActive > 0 && now - groupLastActive > groupGraceMs;

            // Freeze UI if paused by server OR if group is inactive (and force is not set)
            const didFreeze = !force && (isPaused || groupInactive);
            if (didFreeze) {
                return; // freeze UI - do not update header or rows
            }

            // Apply header and icon updates now that we're not frozen
            userNameEl.textContent = displayName;
            try {
                if (preparedIcon && preparedIcon.main) {
                    userClassEl.textContent = preparedIcon.spec
                        ? `${preparedIcon.main} - ${preparedIcon.spec}`
                        : preparedIcon.main;
                } else if (userData.profession) {
                    const p = parseProfessionString(userData.profession || '');
                    userClassEl.textContent = p.spec ? `${p.main} - ${p.spec}` : p.main;
                } else {
                    userClassEl.textContent = '';
                }
            } catch (_) {
                userClassEl.textContent = '';
            }
            userStatsEl.textContent = headerText;
            if (preparedIcon.show) {
                classIconEl.src = preparedIcon.src;
                classIconEl.alt = preparedIcon.alt;
                classIconEl.classList.remove('hidden');
                classIconEl.onerror = function () {
                    this.classList.add('hidden');
                };
            } else {
                classIconEl.classList.add('hidden');
            }

            const rows = computeRows(userData, usersAllSummary);
            const sorted = applySort(rows);
            renderRows(sorted);
            renderHeaderSortState();
        } catch (e) {
            userNameEl.textContent = 'Skill Breakdown';
            userStatsEl.textContent = e.message || 'Error fetching data';
        }
    }

    async function applySettings() {
        try {
            const resp = await fetch(`http://${SERVER_URL}/api/settings`);
            const result = await resp.json();
            if (result && result.code === 0) {
                const op = result.data?.backgroundOpacity;
                if (op !== undefined) {
                    document.documentElement.style.setProperty('--main-bg-opacity', String(op));
                }
            }
        } catch (_) {}
    }

    function handleHeaderClicks() {
        const ths = table.querySelectorAll('thead th');
        ths.forEach((th) => {
            th.addEventListener('click', () => {
                const key = th.getAttribute('data-key');
                if (!key) return;
                if (sortKey === key) {
                    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    sortKey = key;
                    sortDir = key === 'displayName' ? 'asc' : 'desc';
                }
                // Force a refresh when user changes sorting even if UI is currently frozen
                refresh(true);
            });
        });
    }

    function initControls() {
        btnClose?.addEventListener('click', () => window.close());
        btnPin?.addEventListener('click', () => setPinned(true));
    }

    async function start() {
        initSocket();
        handleHeaderClicks();
        initControls();
        await applySettings();
        // Force an initial refresh to populate UI even if no recent activity
        refresh(true);
        refreshTimer = setInterval(refresh, 500);
    }

    window.addEventListener('beforeunload', () => {
        if (refreshTimer) clearInterval(refreshTimer);
        try {
            if (socket) socket.close();
        } catch (_) {}
    });
    document.addEventListener('DOMContentLoaded', start);
})();
