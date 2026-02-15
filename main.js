import { WebRTCManager } from './webrtc.js';
import { PokerGame } from './poker.js';

const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const status = document.getElementById('status');
const createBtn = document.getElementById('create-room');
const joinBtn = document.getElementById('join-room');
const playerNameInput = document.getElementById('player-name');
const roomIdInput = document.getElementById('room-id-input');
const buyinInput = document.getElementById('buyin-input');
const sbInput = document.getElementById('sb-input');
const bbInput = document.getElementById('bb-input');
const roomInfo = document.getElementById('room-info');
const roomIdDisplay = document.getElementById('room-id-display');
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
let currentRoomId = null;
let gameState = {
    players: [],
    buyin: 1000,
    sb: 10,
    bb: 20
};

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
    rtc.onConnected = () => {
        status.textContent = `接続: ${gameState.players.length}人`;
    };
    
    try {
        currentRoomId = await rtc.createRoom();
        console.log('ルームID:', currentRoomId);
        
        if (roomIdDisplay) {
            roomIdDisplay.textContent = `ルームID: ${currentRoomId}`;
            roomIdDisplay.style.fontSize = '20px';
            roomIdDisplay.style.fontWeight = 'bold';
        } else {
            console.error('roomIdDisplay要素が見つかりません');
            alert(`ルームID: ${currentRoomId}`);
        }
        
        if (roomInfo) {
            roomInfo.style.display = 'block';
        }
        
        status.textContent = 'ルーム作成完了 - プレイヤー待機中';
    } catch (err) {
        console.error('ルーム作成エラー:', err);
        status.textContent = 'エラー: ' + err.message;
    }
});

joinBtn.addEventListener('click', async () => {
    const name = playerNameInput.value.trim();
    const roomId = roomIdInput.value.trim();
    
    if (!name) {
        alert('名前を入力してください');
        return;
    }
    
    if (!roomId) {
        alert('ルームIDを入力してください');
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
    
    setupScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    hostControls.style.display = 'block';
    
    sbControl.value = gameState.sb;
    bbControl.value = gameState.bb;
    
    game = new PokerGame(gameState.players, gameState.sb, gameState.bb);
    game.start();
    
    const state = game.getState();
    rtc.broadcast({ type: 'game_start', state });
    renderGame(state);
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
        rtc.broadcast({ type: 'player_id', playerId, name: data.name });
        status.textContent = `プレイヤー: ${gameState.players.length}人`;
    }
    
    if (data.type === 'player_id' && data.name === playerNameInput.value) {
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
    
    const newState = game.getState();
    rtc.broadcast({ type: 'game_update', state: newState });
    renderGame(newState);
    status.textContent = `${newState.phase} - ポット: ${newState.pot}`;
}

function renderGame(state) {
    const gameArea = document.getElementById('game-area');
    
    const getCardColor = (suit) => {
        if (suit === '♥') return '#ff0000';
        if (suit === '♦') return '#0066ff';
        if (suit === '♣') return '#00aa00';
        if (suit === '♠') return '#000000';
    };
    
    const renderCard = (card) => {
        return `<span style="display:inline-block; background:#fff; color:${getCardColor(card.suit)}; padding:8px 12px; margin:0 3px; border-radius:6px; font-size:28px; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.3);">${card.suit}${card.rank}</span>`;
    };
    
    // コミュニティカード
    let html = '<div style="text-align:center; margin:20px 0;">';
    html += '<h3>コミュニティカード</h3>';
    html += '<div>';
    state.community.forEach(card => {
        html += renderCard(card);
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
            html += '<div style="margin:10px 0;">';
            p.hand.forEach(card => {
                html += renderCard(card);
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

