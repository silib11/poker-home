import { WebRTCManager } from './webrtc.js';
import { PokerGame } from './poker.js';

const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const status = document.getElementById('status');
const roomIdInfo = document.getElementById('room-id-info');
const createBtn = document.getElementById('create-room');
const joinBtn = document.getElementById('join-room');
const hostNameInput = document.getElementById('host-name');
const playerNameInput = document.getElementById('player-name');
const roomIdInput = document.getElementById('room-id-input');
const buyinInput = document.getElementById('buyin-input');
const sbInput = document.getElementById('sb-input');
const bbInput = document.getElementById('bb-input');
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
let myPlayerName = null;
let currentRoomId = null;
let gameState = {
    players: [],
    buyin: 1000,
    sb: 10,
    bb: 20
};

createBtn.addEventListener('click', async () => {
    const hostName = hostNameInput.value.trim();
    if (!hostName) {
        alert('名前を入力してください');
        return;
    }
    
    myPlayerName = hostName;
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
        
        // ホスト自身をプレイヤーとして追加
        myPlayerId = Date.now().toString();
        gameState.players.push({
            id: myPlayerId,
            name: hostName,
            chips: gameState.buyin
        });
        
        setupScreen.style.display = 'none';
        gameScreen.style.display = 'block';
        hostControls.style.display = 'block';
        
        roomIdInfo.textContent = `ルームID: ${currentRoomId}`;
        sbControl.value = gameState.sb;
        bbControl.value = gameState.bb;
        
        updatePlayersList();
        status.textContent = `ルーム作成完了 - プレイヤー待機中`;
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
    
    myPlayerName = name;
    currentRoomId = roomId;
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
    roomIdInfo.textContent = `ルームID: ${roomId}`;
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
    
    if (data.type === 'player_id' && data.name === myPlayerName) {
        myPlayerId = data.playerId;
        console.log('自分のプレイヤーID設定:', myPlayerId);
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
    console.log('handlePlayerAction:', data);
    const playerIndex = game.players.findIndex(p => p.id === data.playerId);
    console.log('playerIndex:', playerIndex, 'game.players:', game.players.map(p => p.id));
    
    if (playerIndex === -1) {
        console.error('プレイヤーが見つかりません:', data.playerId);
        return;
    }
    
    console.log('アクション実行:', data.action, 'amount:', data.amount);
    
    if (data.action === 'fold') {
        game.fold(playerIndex);
    } else if (data.action === 'check') {
        game.check(playerIndex);
    } else if (data.action === 'call') {
        game.call(playerIndex);
    } else if (data.action === 'bet') {
        game.bet(playerIndex, parseInt(data.amount));
    }
    
    const newState = game.getState();
    console.log('新しい状態:', newState.phase, 'ターン:', newState.turnIndex);
    
    // 全プレイヤーに送信
    rtc.broadcast({ type: 'game_update', state: newState });
    
    // ホスト自身も更新
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
    
    // WINNER時の処理（フォールドで勝利、手札非公開）
    if (state.phase === 'WINNER') {
        let html = '<div style="text-align:center; margin:20px 0;">';
        html += '<h2>勝者決定</h2>';
        html += `<div style="font-size:24px; margin:20px 0;">${state.winner.name} の勝利！</div>`;
        html += `<div style="font-size:18px; margin:10px 0;">獲得: ${state.pot} チップ</div>`;
        
        if (isHost) {
            html += `<button onclick="nextHand()" style="width:80%; padding:20px; font-size:18px; margin:20px 0;">次のハンド</button>`;
        }
        
        html += '</div>';
        gameArea.innerHTML = html;
        return;
    }
    
    // SHOWDOWN時の処理
    if (state.phase === 'SHOWDOWN') {
        let html = '<div style="text-align:center; margin:20px 0;">';
        html += '<h2>ショウダウン</h2>';
        
        // コミュニティカード表示
        html += '<h3>ボード</h3>';
        html += '<div style="margin:15px 0;">';
        state.community.forEach(card => {
            html += renderCard(card);
        });
        html += '</div>';
        
        html += `<div style="font-size:20px; margin:20px 0;">ポット: ${state.pot}</div>`;
        
        // 全プレイヤーの手札を表示
        state.players.forEach(p => {
            if (!p.folded) {
                html += `<div style="background:#333; padding:15px; margin:10px 0; border-radius:8px;">`;
                html += `<div style="font-size:18px; font-weight:bold;">${p.name}</div>`;
                html += '<div style="margin:10px 0;">';
                if (p.hand && p.hand.length > 0) {
                    p.hand.forEach(card => html += renderCard(card));
                }
                html += '</div>';
                html += `<div>チップ: ${p.chips}</div>`;
                html += '</div>';
            }
        });
        
        if (isHost) {
            html += `<button onclick="nextHand()" style="width:80%; padding:20px; font-size:18px; margin:20px 0;">次のハンド</button>`;
        }
        
        html += '</div>';
        gameArea.innerHTML = html;
        return;
    }
    
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
                
                if (state.currentBet === 0 || state.currentBet === p.bet) {
                    // チェックできる
                    html += `<button onclick="sendAction('check')" style="width:48%; margin:2px;">チェック</button>`;
                } else {
                    // コールが必要
                    const callAmount = state.currentBet - p.bet;
                    html += `<button onclick="sendAction('call')" style="width:48%; margin:2px;">コール(${callAmount})</button>`;
                }
                
                // ベット/レイズ
                const minRaise = state.currentBet === 0 ? state.bb : state.currentBet * 2;
                const raiseAmount = Math.min(minRaise, p.chips);
                if (raiseAmount > 0) {
                    const label = state.currentBet === 0 ? 'ベット' : 'レイズ';
                    html += `<button onclick="showRaiseInput(${raiseAmount}, ${p.chips})" style="width:98%; margin:2px;">${label}(${raiseAmount})</button>`;
                    html += `<div id="raise-input-${i}" style="display:none; margin:5px 0;">`;
                    html += `<input type="number" id="raise-amount-${i}" value="${raiseAmount}" min="${raiseAmount}" max="${p.chips}" step="10" style="width:60%;">`;
                    html += `<button onclick="sendAction('bet', document.getElementById('raise-amount-${i}').value)" style="width:35%; margin-left:5px;">確定</button>`;
                    html += `</div>`;
                }
                
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
    console.log('sendAction:', action, amount, 'myPlayerId:', myPlayerId, 'isHost:', isHost);
    const amountNum = amount ? parseInt(amount) : 0;
    
    if (isHost) {
        // ホストは直接処理してブロードキャスト
        handlePlayerAction({ playerId: myPlayerId, action, amount: amountNum });
    } else {
        // クライアントはホストに送信
        rtc.send({ type: 'action', playerId: myPlayerId, action, amount: amountNum });
    }
};

window.showRaiseInput = function(minAmount, maxAmount) {
    // すべての入力欄を非表示
    document.querySelectorAll('[id^="raise-input-"]').forEach(el => el.style.display = 'none');
    // 該当の入力欄を表示
    const inputDiv = event.target.nextElementSibling;
    if (inputDiv) {
        inputDiv.style.display = 'block';
    }
};

window.nextHand = function() {
    console.log('次のハンド開始');
    
    // チップ0のプレイヤーを除外
    gameState.players = game.players.filter(p => p.chips > 0).map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips
    }));
    
    if (gameState.players.length < 2) {
        alert('プレイヤーが足りません');
        return;
    }
    
    // 新しいゲーム開始
    game = new PokerGame(gameState.players, gameState.sb, gameState.bb);
    game.dealerIndex = (game.dealerIndex + 1) % game.players.length;
    game.start();
    
    const state = game.getState();
    rtc.broadcast({ type: 'game_start', state });
    renderGame(state);
    status.textContent = `新しいハンド - ${game.phase}`;
};

