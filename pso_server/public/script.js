const classTranslationMap = {
    "巨刃守护者": "Heavy Guardian",
    "神盾骑士": "Shield Knight",
    "雷影剑士": "Stormblade",
    "冰霜法师": "Frost Mage",
    "射手": "Marksman",
    "灵魂乐": "Soul Musician",
    "森语者": "Verdant Oracle",
    "青岚骑士": "Wind Knight"
};

function translateProfession(profession) {
    // Find a key in the map that is contained within the profession string
    for (const chineseName in classTranslationMap) {
        if (profession.includes(chineseName)) {
            return classTranslationMap[chineseName];
        }
    }
    // If no translation is found, return the original string
    return profession;
}

function getRandomColorShades() {
    let h;
    do {
        h = Math.floor(Math.random() * 360);
    } while (h > 40 && h < 90);
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
const MAX_ROWS_PER_COLUMN = 5; // The new row limit

function formatNumber(num) {
    if (isNaN(num)) return 'NaN';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.round(num).toString();
}

function renderDataList(users) {
    // Clear all existing columns and data items
    columnsContainer.innerHTML = '';

    const totalDPS = users.reduce((sum, user) => sum + user.total_dps, 0);
    const totalHPS = users.reduce((sum, user) => sum + user.total_hps, 0);

    users.sort((a, b) => b.total_dps - a.total_dps);

    let currentList = null; // A reference to the current <ul> element
    users.forEach((user, index) => {
        // Create a new column (<ul>) for every N items
        if (index % MAX_ROWS_PER_COLUMN === 0) {
            currentList = document.createElement('ul');
            currentList.className = 'data-list';
            columnsContainer.appendChild(currentList);
        }

        const dpsPercent = totalDPS > 0 ? (user.total_dps / totalDPS) * 100 : 0;
        const hpsPercent = totalHPS > 0 ? (user.total_hps / totalHPS) * 100 : 0;

        if (!userColors[user.id]) {
            userColors[user.id] = getRandomColorShades();
        }
        const colors = userColors[user.id];

        const item = document.createElement('li');
        item.className = 'data-item';
        item.style.setProperty('--color-dps', colors.dps);
        item.style.setProperty('--color-hps', colors.hps);
        item.style.setProperty('--color-dps-shadow', colors.dps);

        item.innerHTML = `
            <div class="player-header">
                <div class="player-info">
                    <span class="name">${user.name}</span>
                    <span class="class">${user.profession}</span>
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
        currentList.appendChild(item);
    });
}

function updateAll() {
    const usersArray = Object.values(allUsers).filter(user => user.total_dps > 0 || user.total_hps > 0);
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
        const translatedProfession = translateProfession(newUser.profession);
        allUsers[userId] = {
            ...allUsers[userId],
            ...newUser,
            id: userId,
            profession: translatedProfession // Use the translated name
        };
    }
    updateAll();
}

async function clearData() {
    try {
        const response = await fetch('http://localhost:8990/api/clear');
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

function showServerStatus(status) {
    const statusElement = document.getElementById('serverStatus');
    statusElement.className = status;
}

function connectWebSocket() {
    const socketUrl = 'http://localhost:8990';
    socket = io(socketUrl);

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
        console.log(data);
        processDataUpdate(data);
        lastWebSocketMessage = Date.now();
    });

    socket.on('connect_error', (error) => {
        showServerStatus('disconnected');
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

document.addEventListener('DOMContentLoaded', initialize);

// Expose functions to the global scope for onclick attributes
window.clearData = clearData;
window.togglePause = togglePause;
