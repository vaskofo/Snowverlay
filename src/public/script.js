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

// Reference to the new columns container
const columnsContainer = document.getElementById('columnsContainer');
const pauseButton = document.getElementById('pauseButton');
const serverStatus = document.getElementById('serverStatus');
let allUsers = {};
let userColors = {};
let isPaused = false;
let socket = null;
let isWebSocketConnected = false;
let lastWebSocketMessage = Date.now();
const WEBSOCKET_RECONNECT_INTERVAL = 5000;
const MAX_ROWS_PER_COLUMN = 5;

const SERVER_URL = 'localhost:8990';

function formatNumber(num) {
    if (isNaN(num)) return 'NaN';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.round(num).toString();
}

function renderDataList(users) {
    // Clear the columns container first
    columnsContainer.innerHTML = '';

    const totalDPS = users.reduce((sum, user) => sum + user.total_dps, 0);
    const totalHPS = users.reduce((sum, user) => sum + user.total_hps, 0);

    users.sort((a, b) => b.total_dps - a.total_dps);

    users.forEach((user) => {
        const dpsPercent = totalDPS > 0 ? (user.total_dps / totalDPS) * 100 : 0;
        const hpsPercent = totalHPS > 0 ? (user.total_hps / totalHPS) * 100 : 0;

        if (!userColors[user.id]) {
            userColors[user.id] = getNextColorShades();
        }
        const colors = userColors[user.id];

        const item = document.createElement('li');
        item.className = 'data-item';
        item.style.setProperty('--color-dps', colors.dps);
        item.style.setProperty('--color-hps', colors.hps);
        item.style.setProperty('--color-dps-shadow', colors.dps);
        item.style.setProperty('--dps-percent', `${dpsPercent}%`);
        item.style.setProperty('--hps-percent', `${hpsPercent}%`);

        const isUnknown = user.name === '...' || user.name === '未知';
        const professionDisplay = isUnknown || !user.profession ? '' : `<span class="class">${user.profession}</span>`;

        item.innerHTML = `
            <div class="player-header">
                <div class="player-info">
                    <span class="name">${user.fightPoint ? `${user.name} (${user.fightPoint})` : user.name}</span>
                    ${professionDisplay}
                </div>
            </div>
            <div class="bars-container">
                <div class="bar-row dps-bar-row">
                    <span class="bar-label">Damage:</span>
                    <span class="bar-value-total">${formatNumber(user.total_damage.total)}</span>
                    <span class="bar-value-rate">${formatNumber(user.total_dps)} DPS</span>
                    <div class="bar-fill dps-bar-fill" style="width: ${dpsPercent}%;"></div>
                </div>
                <div class="bar-row hps-bar-row">
                    <span class="bar-label">Healing:</span>
                    <span class="bar-value-total">${formatNumber(user.total_healing.total)}</span>
                    <span class="bar-value-rate">${formatNumber(user.total_hps)} HPS</span>
                    <div class="bar-fill hps-bar-fill" style="width: ${hpsPercent}%;"></div>
                </div>
            </div>
        `;

        columnsContainer.appendChild(item);
    });
}
function updateAll() {
    const usersArray = Object.values(allUsers).filter((user) => user.total_dps > 0 || user.total_hps > 0);
    renderDataList(usersArray);
}

function processDataUpdate(data) {
    if (isPaused) return;
    if (!data.user) {
        console.warn('Received data without a "user" object:', data);
        return;
    }

    for (const userId in data.user) {
        const newUser = data.user[userId];
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
        } else if (!existingUser.profession) {
            updatedUser.profession = '';
        }

        const hasNewFightPoint = newUser.fightPoint !== undefined && typeof newUser.fightPoint === 'number';
        if (hasNewFightPoint) {
            updatedUser.fightPoint = newUser.fightPoint;
        } else if (existingUser.fightPoint === undefined) {
            updatedUser.fightPoint = 0;
        }

        allUsers[userId] = updatedUser;
    }

    updateAll();
}

async function clearData() {
    try {
        const response = await fetch(`http://${SERVER_URL}/api/clear`);
        const result = await response.json();

        if (result.code === 0) {
            allUsers = {};
            userColors = {};
            updateAll();
            showServerStatus('cleared');
            console.log('Data cleared successfully.');
        } else {
            console.error('Failed to clear data on server:', result.msg);
        }
    } catch (error) {
        console.error('Error sending clear request to server:', error);
    }
}

function togglePause() {
    isPaused = !isPaused;
    pauseButton.innerText = isPaused ? 'Resume' : 'Pause';
    showServerStatus(isPaused ? 'paused' : 'active');
}

function closeClient() {
    window.electronAPI.closeClient();
}

function showServerStatus(status) {
    const statusElement = document.getElementById('serverStatus');
    statusElement.className = status;
}

function connectWebSocket() {
    socket = io(SERVER_URL);

    socket.on('connect', () => {
        isWebSocketConnected = true;
        showServerStatus('connected');
        lastWebSocketMessage = Date.now();
    });

    socket.on('disconnect', () => {
        isWebSocketConnected = false;
        showServerStatus('disconnected');
    });

    socket.on('data', (data) => {
        processDataUpdate(data);
        lastWebSocketMessage = Date.now();
    });

    socket.on('connect_error', (error) => {
        showServerStatus('disconnected');
        console.error('WebSocket connection error:', error);
    });
}

function checkConnection() {
    if (!isWebSocketConnected && socket && socket.disconnected) {
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

function initialize() {
    connectWebSocket();
    setInterval(checkConnection, WEBSOCKET_RECONNECT_INTERVAL);
}

let forward = false;

document.addEventListener('DOMContentLoaded', () => {
    initialize();
});

window.clearData = clearData;
window.togglePause = togglePause;
