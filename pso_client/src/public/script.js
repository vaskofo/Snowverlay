// Define an array of visually distinct hues for rotation
const colorHues = [
    210, // Blue
    30,  // Orange
    270, // Purple
    150, // Teal
    330, // Magenta
    60,  // Yellow
    180, // Cyan
    0,   // Red
    240  // Indigo
];

let colorIndex = 0;

function getNextColorShades() {
    const h = colorHues[colorIndex];
    colorIndex = (colorIndex + 1) % colorHues.length; // Move to the next index, looping back if necessary
    
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
let isMinimized = false;
const WEBSOCKET_RECONNECT_INTERVAL = 5000;
const MAX_ROWS_PER_COLUMN = 5;

// This will be http://localhost:xxxx where xxxx is the correct dynamic port
const SERVER_URL = window.location.origin;

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

        const isUnknown = user.name === "..." || user.name === "未知";
        const professionDisplay = isUnknown || !user.profession ? '' : `<span class="class">${user.profession}</span>`;

        item.innerHTML = `
            <div class="player-header">
                <div class="player-info">
                    <span class="name" title="${user.name}">${user.name}</span>
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
        currentList.appendChild(item);
    });
}

function updateAll() {
    const usersArray = Object.values(allUsers).filter(user => user.total_dps > 0 || user.total_hps > 0);
    renderDataList(usersArray);
}

function processDataUpdate(data) {
    if (isPaused || isMinimized) return;
    if (!data.user) {
        console.warn('Received data without a "user" object:', data);
        return;
    }

    for (const userId in data.user) {
        const newUser = data.user[userId];
        const existingUser = allUsers[userId] || {};

        // Start with the existing user data to preserve old values
        const updatedUser = { ...existingUser };

        // Merge all properties from the new user data over the old
        Object.assign(updatedUser, newUser);
        updatedUser.id = userId; // Ensure ID is always set

        // --- CORRECTED NAME & PROFESSION LOGIC ---
        // A new name is only accepted if it's a non-empty string and not the Chinese "Unknown" placeholder.
        const hasNewValidName = newUser.name && typeof newUser.name === 'string' && newUser.name !== "未知";
        if (hasNewValidName) {
            updatedUser.name = newUser.name;
        } else if (!existingUser.name || existingUser.name === '...') {
            // If there was no valid name before, set/keep the placeholder.
            updatedUser.name = '...';
        }
        // If there's no new valid name, the existing valid name from the spread/assign is preserved.

        // Only update the profession if the new data provides one.
        const hasNewProfession = newUser.profession && typeof newUser.profession === 'string';
        if (hasNewProfession) {
            updatedUser.profession = newUser.profession;
        } else if (!existingUser.profession) {
            updatedUser.profession = '';
        }
        // If there's no new profession, the existing one is preserved.

        allUsers[userId] = updatedUser;
    }
    
    updateAll();
}


async function clearData() {
    try {
        // Use the dynamic SERVER_URL variable
        const response = await fetch(`${SERVER_URL}/api/clear`);
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

function toggleMinimize() {
    const mainContainer = document.querySelector('.main-container');
    const minimizeButton = document.getElementById('minimizeButton');

    isMinimized = !isMinimized;
    if (isMinimized) {
        mainContainer.classList.add('minimized');
        minimizeButton.innerText = 'Open';
        showServerStatus('minimized');
    } else {
        mainContainer.classList.remove('minimized');
        minimizeButton.innerText = '_';
        showServerStatus('active');
    }
}

function showServerStatus(status) {
    const statusElement = document.getElementById('serverStatus');
    statusElement.className = status;
}

function connectWebSocket() {
    // Use the dynamic SERVER_URL variable
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

document.addEventListener('DOMContentLoaded', initialize);

// Expose functions to the global scope for onclick attributes
window.clearData = clearData;
window.togglePause = togglePause;
window.toggleMinimize = toggleMinimize;
