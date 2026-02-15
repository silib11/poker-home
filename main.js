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
let nextHandReady = new Set();
let allPlayers = []; // 全プレイヤーを保持（ゲーム再開用）
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
        const hostPlayer = {
            id: myPlayerId,
            name: hostName,
            chips: gameState.buyin
        };
        gameState.players.push(hostPlayer);
        allPlayers.push(hostPlayer); // 全プレイヤーリストにも追加
        
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

// ホストメニュートグル
const toggleHostMenuBtn = document.getElementById('toggle-host-menu');
const hostMenu = document.getElementById('host-menu');
const toggleBlindsBtn = document.getElementById('toggle-blinds');
const blindsControl = document.getElementById('blinds-control');

if (toggleHostMenuBtn) {
    toggleHostMenuBtn.addEventListener('click', () => {
        if (hostMenu.style.display === 'none') {
            hostMenu.style.display = 'block';
            toggleHostMenuBtn.textContent = '⚙️ メニューを閉じる';
        } else {
            hostMenu.style.display = 'none';
            toggleHostMenuBtn.textContent = '⚙️ ホストメニュー';
            // メニューを閉じたらブラインドコントロールも閉じる
            blindsControl.style.display = 'none';
            toggleBlindsBtn.textContent = 'ブラインド変更';
        }
    });
}

if (toggleBlindsBtn) {
    toggleBlindsBtn.addEventListener('click', () => {
        if (blindsControl.style.display === 'none') {
            blindsControl.style.display = 'block';
            toggleBlindsBtn.textContent = '閉じる';
        } else {
            blindsControl.style.display = 'none';
            toggleBlindsBtn.textContent = 'ブラインド変更';
        }
    });
}

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
        const newPlayer = {
            id: playerId,
            name: data.name,
            chips: gameState.buyin
        };
        gameState.players.push(newPlayer);
        allPlayers.push(newPlayer); // 全プレイヤーリストにも追加
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
        nextHandReady.clear();
        renderGame(data.state);
        status.textContent = `ゲーム開始 - ${data.state.phase}`;
    }
    
    if (data.type === 'game_over') {
        showGameOver();
    }
    
    if (data.type === 'game_restart') {
        // 全プレイヤーのチップをリセット（飛んだプレイヤーも復活）
        if (data.allPlayers) {
            gameState.players = data.allPlayers;
        } else {
            gameState.players = gameState.players.map(p => ({
                ...p,
                chips: data.buyin
            }));
        }
        updatePlayersList();
        renderGame(data.state);
        status.textContent = `ゲーム再開 - ${data.state.phase}`;
    }
    
    if (data.type === 'ready_next_hand' && isHost) {
        nextHandReady.add(data.playerId);
        checkAllReady();
    }
    
    if (data.type === 'game_update') {
        // gameStateのプレイヤーチップを更新
        if (data.state.players) {
            gameState.players = data.state.players.map(p => ({
                id: p.id,
                name: p.name,
                chips: p.chips
            }));
            updatePlayersList();
        }
        renderGame(data.state);
        status.textContent = `${data.state.phase} - ポット: ${data.state.pot}`;
    }
    
    if (data.type === 'action' && isHost) {
        handlePlayerAction(data);
    }
}

function updatePlayersList() {
    // チップ数で降順ソート
    const sortedPlayers = [...gameState.players].sort((a, b) => b.chips - a.chips);
    
    playersList.innerHTML = `<h3>プレイヤー (${gameState.players.length}人)</h3>`;
    sortedPlayers.forEach((p, index) => {
        const div = document.createElement('div');
        div.className = 'player-item';
        
        // 順位表示
        let rankIcon = '';
        if (index === 0) rankIcon = '🥇 ';
        else if (index === 1) rankIcon = '🥈 ';
        else if (index === 2) rankIcon = '🥉 ';
        else rankIcon = `${index + 1}位 `;
        
        div.innerHTML = `<span>${rankIcon}${p.name}</span><span style="font-weight:bold;">${p.chips} chips</span>`;
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
    
    // gameStateのプレイヤーチップを更新
    gameState.players = newState.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips
    }));
    
    // 全プレイヤーに送信
    rtc.broadcast({ type: 'game_update', state: newState });
    
    // ホスト自身も更新
    renderGame(newState);
    updatePlayersList();
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
        html += '<h2>🏆 勝者決定 🏆</h2>';
        html += `<div style="font-size:28px; font-weight:bold; color:#ffd700; margin:20px 0;">${state.winner.name}</div>`;
        html += `<div style="font-size:20px; margin:10px 0;">獲得: <span style="color:#00ff00; font-weight:bold;">+${state.winAmount}</span> チップ</div>`;
        html += `<div style="font-size:16px; color:#888; margin:10px 0;">現在のチップ: ${state.winner.chips}</div>`;
        
        // 次のハンドボタン（全員表示）
        const readyCount = state.nextHandReady ? state.nextHandReady.length : 0;
        const totalPlayers = state.players.filter(p => p.chips > 0).length;
        const isReady = state.nextHandReady && state.nextHandReady.includes(myPlayerId);
        
        html += `<div style="margin:20px 0;">`;
        html += `<div style="font-size:14px; color:#aaa; margin:10px 0;">準備完了: ${readyCount}/${totalPlayers}</div>`;
        if (isReady) {
            html += `<button disabled style="width:80%; padding:20px; font-size:18px; background:#555; color:#aaa;">準備完了 ✓</button>`;
        } else {
            html += `<button onclick="readyNextHand()" style="width:80%; padding:20px; font-size:18px;">次のハンドへ</button>`;
        }
        html += `</div>`;
        
        html += '</div>';
        gameArea.innerHTML = html;
        return;
    }
    
    // SHOWDOWN時の処理
    if (state.phase === 'SHOWDOWN') {
        let html = '<div style="text-align:center; margin:20px 0;">';
        html += '<h2>🏆 ショウダウン 🏆</h2>';
        
        // 勝者情報
        if (state.winner) {
            html += `<div style="background:#1a4d1a; padding:15px; margin:15px 0; border-radius:8px; border:2px solid #ffd700;">`;
            html += `<div style="font-size:24px; font-weight:bold; color:#ffd700;">勝者: ${state.winner.name}</div>`;
            html += `<div style="font-size:18px; margin:5px 0;">${state.winningHand || ''}</div>`;
            html += `<div style="font-size:20px; margin:10px 0;">獲得: <span style="color:#00ff00; font-weight:bold;">+${state.winAmount}</span> チップ</div>`;
            html += `</div>`;
        }
        
        // コミュニティカード表示
        html += '<h3>ボード</h3>';
        html += '<div style="margin:15px 0;">';
        state.community.forEach(card => {
            html += renderCard(card);
        });
        html += '</div>';
        
        // 全プレイヤーの手札を表示
        state.players.forEach(p => {
            if (!p.folded) {
                const isWinner = state.winner && p.id === state.winner.id;
                html += `<div style="background:${isWinner ? '#1a4d1a' : '#333'}; padding:15px; margin:10px 0; border-radius:8px; border:${isWinner ? '2px solid #ffd700' : 'none'};">`;
                html += `<div style="font-size:18px; font-weight:bold;">${p.name} ${isWinner ? '👑' : ''}</div>`;
                html += '<div style="margin:10px 0;">';
                if (p.hand && p.hand.length > 0) {
                    p.hand.forEach(card => html += renderCard(card));
                }
                html += '</div>';
                html += `<div>チップ: ${p.chips}</div>`;
                html += '</div>';
            }
        });
        
        // 次のハンドボタン（全員表示）
        const readyCount = state.nextHandReady ? state.nextHandReady.length : 0;
        const totalPlayers = state.players.filter(p => p.chips > 0).length;
        const isReady = state.nextHandReady && state.nextHandReady.includes(myPlayerId);
        
        html += `<div style="margin:20px 0;">`;
        html += `<div style="font-size:14px; color:#aaa; margin:10px 0;">準備完了: ${readyCount}/${totalPlayers}</div>`;
        if (isReady) {
            html += `<button disabled style="width:80%; padding:20px; font-size:18px; background:#555; color:#aaa;">準備完了 ✓</button>`;
        } else {
            html += `<button onclick="readyNextHand()" style="width:80%; padding:20px; font-size:18px;">次のハンドへ</button>`;
        }
        html += `</div>`;
        
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
    
    // ポット表示（現在のベット総額も含む）
    const currentBets = state.players.reduce((sum, p) => sum + p.bet, 0);
    const totalPot = state.pot + currentBets;
    html += `<div style="margin:10px 0;">`;
    html += `<div style="font-size:18px; font-weight:bold;">ポット: ${state.pot}</div>`;
    if (currentBets > 0) {
        html += `<div style="font-size:14px; color:#aaa;">（現在のベット: ${currentBets}）</div>`;
        html += `<div style="font-size:14px; color:#ffff66;">合計: ${totalPot}</div>`;
    }
    html += `</div>`;
    html += '</div>';
    
    // プレイヤー情報
    html += '<div>';
    state.players.forEach((p, i) => {
        const isTurn = i === state.turnIndex;
        const isDealer = i === state.dealerIndex;
        const isFolded = p.folded;
        
        // フォールドしたプレイヤーはグレーアウト
        let bgColor = '#3a3a3a';
        if (isFolded) {
            bgColor = '#1a1a1a';
        } else if (isTurn) {
            bgColor = '#0066cc';
        }
        
        const opacity = isFolded ? 'opacity:0.5;' : '';
        
        // 最後のアクションを表示
        let actionTag = '';
        if (p.lastAction) {
            const actionColors = {
                'fold': '#ff6666',
                'check': '#66ff66',
                'call': '#ffff66',
                'bet': '#ff9966',
                'raise': '#ff9966',
                'allin': '#ff0000'
            };
            const actionLabels = {
                'fold': 'フォールド',
                'check': 'チェック',
                'call': 'コール',
                'bet': 'ベット',
                'raise': 'レイズ',
                'allin': 'オールイン'
            };
            const color = actionColors[p.lastAction] || '#aaa';
            const label = actionLabels[p.lastAction] || p.lastAction;
            actionTag = `<span style="background:${color}; color:#000; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:bold; margin-left:5px;">${label}</span>`;
        }
        
        html += `<div style="background:${bgColor}; padding:10px; margin:5px 0; border-radius:8px; ${opacity} border:${isFolded ? '2px solid #555' : 'none'};">`;
        html += `<div><strong>${p.name}</strong> ${isDealer ? '(D)' : ''} ${actionTag}</div>`;
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
                
                // ベット/レイズ - プリセットボタン + スライダー
                const minTotalBet = state.currentBet === 0 ? state.bb : state.currentBet * 2;
                const maxTotalBet = p.bet + p.chips;
                
                if (minTotalBet <= maxTotalBet) {
                    const label = state.currentBet === 0 ? 'ベット' : 'レイズ';
                    
                    // スライダー
                    html += `<div style="margin:10px 0;">`;
                    html += `<input type="range" id="raise-slider-${i}" min="${minTotalBet}" max="${maxTotalBet}" value="${minTotalBet}" step="${state.bb}" style="width:100%;" oninput="updateRaiseDisplay(${i})">`;
                    html += `<div style="text-align:center; font-size:18px; font-weight:bold; margin:5px 0;">`;
                    html += `<span id="raise-display-${i}">${minTotalBet}</span> チップ`;
                    html += `</div>`;
                    html += `<button onclick="sendSliderRaise(${i})" style="width:100%; margin:2px; background:#ff9966; font-size:16px; padding:12px;">${label}</button>`;
                    html += `</div>`;
                    
                    // プリセットボタン
                    html += `<div style="display:flex; gap:5px; margin:5px 0;">`;
                    html += `<button onclick="setRaiseAmount(${i}, ${minTotalBet})" style="flex:1; padding:8px; font-size:12px;">ミニマム</button>`;
                    
                    const potRaise = state.pot + state.currentBet;
                    if (potRaise > minTotalBet && potRaise <= maxTotalBet) {
                        html += `<button onclick="setRaiseAmount(${i}, ${potRaise})" style="flex:1; padding:8px; font-size:12px;">ポット</button>`;
                    }
                    
                    if (maxTotalBet > minTotalBet) {
                        html += `<button onclick="setRaiseAmount(${i}, ${maxTotalBet})" style="flex:1; padding:8px; font-size:12px; background:#cc0000;">オールイン</button>`;
                    }
                    html += `</div>`;
                }
                
                html += '</div>';
            }
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

window.updateRaiseDisplay = function(playerIndex) {
    const slider = document.getElementById(`raise-slider-${playerIndex}`);
    const display = document.getElementById(`raise-display-${playerIndex}`);
    if (slider && display) {
        display.textContent = slider.value;
    }
};

window.setRaiseAmount = function(playerIndex, amount) {
    const slider = document.getElementById(`raise-slider-${playerIndex}`);
    const display = document.getElementById(`raise-display-${playerIndex}`);
    if (slider && display) {
        slider.value = amount;
        display.textContent = amount;
    }
};

window.sendSliderRaise = function(playerIndex) {
    const slider = document.getElementById(`raise-slider-${playerIndex}`);
    if (!slider) return;
    
    const amount = parseInt(slider.value);
    sendAction('bet', amount);
};

window.readyNextHand = function() {
    console.log('次のハンド準備完了');
    
    if (isHost) {
        nextHandReady.add(myPlayerId);
        checkAllReady();
    } else {
        rtc.send({ type: 'ready_next_hand', playerId: myPlayerId });
    }
};

function checkAllReady() {
    const activePlayers = game.players.filter(p => p.chips > 0);
    
    if (nextHandReady.size >= activePlayers.length) {
        // 全員準備完了
        nextHandReady.clear();
        startNextHand();
    } else {
        // 準備状況をブロードキャスト
        const state = game.getState();
        state.nextHandReady = Array.from(nextHandReady);
        rtc.broadcast({ type: 'game_update', state });
        renderGame(state);
    }
}

function startNextHand() {
    // チップ0のプレイヤーを除外
    gameState.players = game.players.filter(p => p.chips > 0).map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips
    }));
    
    if (gameState.players.length < 2) {
        // ゲーム終了
        showGameOver();
        return;
    }
    
    // ディーラーボタンを次の人に移動
    const currentDealerIndex = game.dealerIndex;
    const nextDealerIndex = (currentDealerIndex + 1) % gameState.players.length;
    
    // 新しいゲーム開始
    game = new PokerGame(gameState.players, gameState.sb, gameState.bb);
    game.dealerIndex = nextDealerIndex;
    game.start();
    
    const state = game.getState();
    rtc.broadcast({ type: 'game_start', state });
    renderGame(state);
    status.textContent = `新しいハンド - ${game.phase}`;
}

function showGameOver() {
    const gameArea = document.getElementById('game-area');
    let html = '<div style="text-align:center; margin:20px 0;">';
    html += '<h2>🎉 ゲーム終了 🎉</h2>';
    
    if (gameState.players.length === 1) {
        html += `<div style="font-size:28px; font-weight:bold; color:#ffd700; margin:20px 0;">優勝: ${gameState.players[0].name}</div>`;
        html += `<div style="font-size:20px; margin:10px 0;">最終チップ: ${gameState.players[0].chips}</div>`;
    } else {
        html += `<div style="font-size:20px; margin:20px 0;">プレイヤーが足りません</div>`;
    }
    
    if (isHost) {
        html += `<button onclick="restartGame()" style="width:80%; padding:20px; font-size:18px; margin:20px 0; background:#00aa00;">新しいゲームを開始</button>`;
    } else {
        html += `<div style="margin:20px 0; color:#aaa;">ホストが新しいゲームを開始するまでお待ちください</div>`;
    }
    
    html += '</div>';
    gameArea.innerHTML = html;
    status.textContent = 'ゲーム終了';
    
    rtc.broadcast({ type: 'game_over' });
}

window.restartGame = function() {
    // 全プレイヤーのチップをリセット（飛んだプレイヤーも復活）
    gameState.players = allPlayers.map(p => ({
        id: p.id,
        name: p.name,
        chips: gameState.buyin
    }));
    
    // 新しいゲーム開始
    game = new PokerGame(gameState.players, gameState.sb, gameState.bb);
    game.start();
    
    const state = game.getState();
    rtc.broadcast({ type: 'game_restart', state, buyin: gameState.buyin, allPlayers: gameState.players });
    renderGame(state);
    updatePlayersList();
    status.textContent = `ゲーム再開 - ${game.phase}`;
};

window.nextHand = function() {
    console.log('次のハンド開始（旧関数）');
    nextHandReady.clear();
    startNextHand();
};

