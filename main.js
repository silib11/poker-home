import { WebRTCManager } from './webrtc.js';
import QRCode from 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm';

const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const status = document.getElementById('status');
const createBtn = document.getElementById('create-room');
const joinBtn = document.getElementById('join-room');
const playerNameInput = document.getElementById('player-name');
const buyinInput = document.getElementById('buyin-input');
const sbInput = document.getElementById('sb-input');
const bbInput = document.getElementById('bb-input');
const qrSection = document.getElementById('qr-section');
const qrCode = document.getElementById('qr-code');
const roomUrl = document.getElementById('room-url');
const hostControls = document.getElementById('host-controls');
const sbControl = document.getElementById('sb-control');
const bbControl = document.getElementById('bb-control');
const updateBlindsBtn = document.getElementById('update-blinds');
const startGameBtn = document.getElementById('start-game');
const playersList = document.getElementById('players-list');

let rtc;
let isHost = false;
let gameState = {
    players: [],
    buyin: 1000,
    sb: 10,
    bb: 20
};

// URLパラメータからルームID取得
const urlParams = new URLSearchParams(window.location.search);
const roomIdFromUrl = urlParams.get('room');

if (roomIdFromUrl) {
    document.getElementById('host-section').style.display = 'none';
}

createBtn.addEventListener('click', async () => {
    isHost = true;
    const buyin = parseInt(buyinInput.value);
    const sb = parseInt(sbInput.value);
    const bb = parseInt(bbInput.value);
    
    gameState.buyin = buyin;
    gameState.sb = sb;
    gameState.bb = bb;
    
    status.textContent = 'ルーム作成中...';
    rtc = new WebRTCManager(true);
    
    rtc.onStatusChange = (s) => status.textContent = s;
    rtc.onMessage = handleMessage;
    rtc.onConnected = () => status.textContent = `接続: ${gameState.players.length}人`;
    
    const roomId = await rtc.createRoom();
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    
    await QRCode.toCanvas(document.createElement('canvas'), url, { width: 200 }, (err, canvas) => {
        if (!err) {
            qrCode.innerHTML = '';
            qrCode.appendChild(canvas);
        }
    });
    
    roomUrl.textContent = url;
    qrSection.style.display = 'block';
    
    setupScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    hostControls.style.display = 'block';
    
    sbControl.value = sb;
    bbControl.value = bb;
    
    updatePlayersList();
});

joinBtn.addEventListener('click', async () => {
    const name = playerNameInput.value.trim();
    if (!name) {
        alert('名前を入力してください');
        return;
    }
    
    const roomId = roomIdFromUrl;
    if (!roomId) {
        alert('ルームIDが見つかりません');
        return;
    }
    
    status.textContent = '接続中...';
    rtc = new WebRTCManager(false);
    
    rtc.onStatusChange = (s) => status.textContent = s;
    rtc.onMessage = handleMessage;
    rtc.onConnected = () => {
        rtc.send({ type: 'join', name });
        status.textContent = '接続完了';
    };
    
    await rtc.joinRoom(roomId);
    
    setupScreen.style.display = 'none';
    gameScreen.style.display = 'block';
});

updateBlindsBtn.addEventListener('click', () => {
    gameState.sb = parseInt(sbControl.value);
    gameState.bb = parseInt(bbControl.value);
    rtc.broadcast({ type: 'blinds', sb: gameState.sb, bb: gameState.bb });
    status.textContent = `ブラインド更新: ${gameState.sb}/${gameState.bb}`;
});

startGameBtn.addEventListener('click', () => {
    rtc.broadcast({ type: 'start' });
    status.textContent = 'ゲーム開始！';
});

function handleMessage(msg) {
    const data = JSON.parse(msg);
    
    if (data.type === 'join' && isHost) {
        gameState.players.push({
            id: Date.now(),
            name: data.name,
            chips: gameState.buyin
        });
        updatePlayersList();
        rtc.broadcast({ type: 'state', state: gameState });
    }
    
    if (data.type === 'state') {
        gameState = data.state;
        updatePlayersList();
    }
    
    if (data.type === 'blinds') {
        gameState.sb = data.sb;
        gameState.bb = data.bb;
        status.textContent = `ブラインド: ${data.sb}/${data.bb}`;
    }
    
    if (data.type === 'start') {
        status.textContent = 'ゲーム開始！';
    }
}

function updatePlayersList() {
    playersList.innerHTML = `<h3>プレイヤー (${gameState.players.length}人)</h3>`;
    gameState.players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = `<span>${p.name}</span><span>${p.chips} chips</span>`;
        playersList.appendChild(div);
    });
}
