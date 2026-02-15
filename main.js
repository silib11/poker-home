import { WebRTCManager } from './webrtc.js';
import { PokerGame } from './poker.js';
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
let game = null;
let myPlayerId = null;
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
    if (gameState.players.length < 2) {
        alert('最低2人必要です');
        return;
    }
    
    game = new PokerGame(gameState.players, gameState.sb, gameState.bb);
    game.start();
    
    rtc.broadcast({ type: 'game_start', state: game.getState() });
    renderGame(game.getState());
    status.textContent = `ゲーム開始 - ${game.phase}`;
});

function handleMessage(msg) {
    const data = JSON.parse(msg);
    
    if (data.type === 'join' && isHost) {
        const playerId = Date.now().toString();
        gameState.players.push({
            id: playerId,
            name: data.name,
            chips: gameState.buyin
        });
        updatePlayersList();
        rtc.broadcast({ type: 'state', state: gameState });
        rtc.broadcast({ type: 'player_id', playerId, to: data.name });
    }
    
    if (data.type === 'player_id' && data.to === playerNameInput.value) {
        myPlayerId = data.playerId;
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
    
    if (data.type === 'game_start') {
        renderGame(data.state);
        status.textContent = `ゲーム開始 - ${data.state.phase}`;
    }
    
    if (data.type === 'game_update') {
        renderGame(data.state);
        status.textContent = `${data.state.phase} - ポット: ${data.state.pot}`;
    }
    
    if (data.type === 'action' && isHost) {
        handlePlayerAction(data);
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

function handlePlayerAction(data) {
    const playerIndex = game.players.findIndex(p => p.id === data.playerId);
    if (playerIndex === -1) return;
    
    if (data.action === 'fold') {
        game.fold(playerIndex);
    } else if (data.action === 'check') {
        game.check(playerIndex);
    } else if (data.action === 'call') {
        game.call(playerIndex);
    } else if (data.action === 'bet') {
        game.bet(playerIndex, data.amount);
    }
    
    rtc.broadcast({ type: 'game_update', state: game.getState() });
    renderGame(game.getState());
}

function renderGame(state) {
    const gameArea = document.getElementById('game-area');
    
    // コミュニティカード
    let html = '<div style="text-align:center; margin:20px 0;">';
    html += '<h3>コミュニティカード</h3>';
    html += '<div style="font-size:32px;">';
    state.community.forEach(card => {
        html += `<span style="margin:0 5px;">${card.suit}${card.rank}</span>`;
    });
    html += '</div>';
    html += `<div style="margin:10px 0;">ポット: ${state.pot}</div>`;
    html += '</div>';
    
    // プレイヤー情報
    html += '<div>';
    state.players.forEach((p, i) => {
        const isTurn = i === state.turnIndex;
        const isDealer = i === state.dealerIndex;
        html += `<div style="background:${isTurn ? '#005a9e' : '#333'}; padding:10px; margin:5px 0; border-radius:8px;">`;
        html += `<div><strong>${p.name}</strong> ${isDealer ? '(D)' : ''}</div>`;
        html += `<div>チップ: ${p.chips} | ベット: ${p.bet}</div>`;
        
        // 手札表示（自分のみ）
        if (p.id === myPlayerId && p.hand && p.hand.length > 0) {
            html += '<div style="font-size:24px; margin:5px 0;">';
            p.hand.forEach(card => {
                html += `<span style="margin:0 5px;">${card.suit}${card.rank}</span>`;
            });
            html += '</div>';
            
            // アクションボタン
            if (isTurn && !p.folded) {
                html += '<div style="margin-top:10px;">';
                html += `<button onclick="sendAction('fold')" style="width:48%; margin:2px;">フォールド</button>`;
                if (state.currentBet === p.bet) {
                    html += `<button onclick="sendAction('check')" style="width:48%; margin:2px;">チェック</button>`;
                } else {
                    html += `<button onclick="sendAction('call')" style="width:48%; margin:2px;">コール(${state.currentBet - p.bet})</button>`;
                }
                html += `<button onclick="sendAction('bet', ${state.currentBet * 2})" style="width:48%; margin:2px;">レイズ</button>`;
                html += '</div>';
            }
        }
        
        if (p.folded) {
            html += '<div style="color:#888;">フォールド</div>';
        }
        
        html += '</div>';
    });
    html += '</div>';
    
    gameArea.innerHTML = html;
}

window.sendAction = function(action, amount) {
    rtc.send({ type: 'action', playerId: myPlayerId, action, amount });
};

