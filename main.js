import { WebRTCManager } from './webrtc.js';
import { PokerGame } from './poker.js';

const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const roomIdInfo = document.getElementById('room-id-info');
const createBtn = document.getElementById('create-room');
const joinBtn = document.getElementById('join-room');
const hostNameInput = document.getElementById('host-name');
const playerNameInput = document.getElementById('player-name');
const roomIdInput = document.getElementById('room-id-input');
const buyinInput = document.getElementById('buyin-input');
const sbInput = document.getElementById('sb-input');
const bbInput = document.getElementById('bb-input');
const hostMenuBtn = document.getElementById('host-menu-btn');
const hostModal = document.getElementById('host-modal');
const closeHostModal = document.getElementById('close-host-modal');
const sbControl = document.getElementById('sb-control');
const bbControl = document.getElementById('bb-control');
const updateBlindsBtn = document.getElementById('update-blinds');
const startGameBtn = document.getElementById('start-game');

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
    
    rtc = new WebRTCManager(true);
    
    rtc.onMessage = handleMessage;
    rtc.onConnected = () => {
        updateRoomInfo();
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
        hostMenuBtn.style.display = 'block';
        
        updateRoomInfo();
        sbControl.value = gameState.sb;
        bbControl.value = gameState.bb;
        
        updatePlayersList();
    } catch (err) {
        console.error('ルーム作成エラー:', err);
        alert('ルーム作成に失敗しました');
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
    rtc = new WebRTCManager(false);
    
    rtc.onMessage = handleMessage;
    rtc.onConnected = () => {
        rtc.send({ type: 'join', name });
    };
    
    await rtc.joinRoom(roomId);
    
    setupScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    updateRoomInfo();
});

// ホストメニュー
hostMenuBtn.addEventListener('click', () => {
    hostModal.style.display = 'flex';
});

closeHostModal.addEventListener('click', () => {
    hostModal.style.display = 'none';
});

hostModal.addEventListener('click', (e) => {
    if (e.target === hostModal) {
        hostModal.style.display = 'none';
    }
});

updateBlindsBtn.addEventListener('click', () => {
    gameState.sb = parseInt(sbControl.value);
    gameState.bb = parseInt(bbControl.value);
    rtc.broadcast({ type: 'blinds', sb: gameState.sb, bb: gameState.bb });
    hostModal.style.display = 'none';
});

function updateRoomInfo() {
    const playerCount = gameState.players.length;
    roomIdInfo.textContent = `ルームID: ${currentRoomId} | ${playerCount}人`;
}

startGameBtn.addEventListener('click', () => {
    if (gameState.players.length < 2) {
        alert('最低2人必要です');
        return;
    }
    
    hostModal.style.display = 'none';
    
    // ゲーム中のスクロール無効化
    document.body.classList.add('game-active');
    gameScreen.classList.add('playing');
    
    sbControl.value = gameState.sb;
    bbControl.value = gameState.bb;
    
    game = new PokerGame(gameState.players, gameState.sb, gameState.bb);
    game.start();
    
    const state = game.getState();
    rtc.broadcast({ type: 'game_start', state });
    renderGame(state);
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
    }
    
    if (data.type === 'game_start') {
        nextHandReady.clear();
        
        // ゲーム中のスクロール無効化
        document.body.classList.add('game-active');
        gameScreen.classList.add('playing');
        
        renderGame(data.state);
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
    }
    
    if (data.type === 'action' && isHost) {
        handlePlayerAction(data);
    }
}

function updatePlayersList() {
    updateRoomInfo();
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
        // amountは「追加で出す額」なので、現在のベット額に加算して総ベット額にする
        const player = game.players[playerIndex];
        const totalBet = player.bet + parseInt(data.amount);
        game.bet(playerIndex, totalBet);
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
}

function renderGame(state) {
    const gameArea = document.getElementById('game-area');
    const topBar = document.getElementById('top-bar');
    const roomIdInfo = document.getElementById('room-id-info');
    
    // ゲーム開始後はルームID非表示、トップバー透明化
    topBar.classList.add('game-started');
    roomIdInfo.classList.add('hidden');
    
    const getCardColor = (suit) => {
        if (suit === '♠') return 'black';
        if (suit === '♥') return 'red';
        if (suit === '♦') return 'blue';
        if (suit === '♣') return 'green';
        return 'black';
    };
    
    const renderCard = (card, isMini = false) => {
        const colorClass = getCardColor(card.suit);
        if (isMini) {
            return `<div class="mini-card"></div>`;
        }
        return `<div class="card ${colorClass}"><span class="card-value">${card.rank}</span><span class="card-suit">${card.suit}</span></div>`;
    };
    
    const renderMyCard = (card) => {
        const colorClass = getCardColor(card.suit);
        return `<div class="my-card ${colorClass}"><span class="card-value">${card.rank}</span><span class="card-suit">${card.suit}</span></div>`;
    };
    
    const getOpponentPositions = (count) => {
        const W = window.innerWidth;
        const H = window.innerHeight - 200;
        const centerX = W / 2;
        const centerY = H * 0.45;
        const radiusX = W * 0.4;
        const radiusY = H * 0.35;
        const positions = [];
        const opponentCount = count - 1;
        
        for (let i = 0; i < opponentCount; i++) {
            const startAngle = 200;
            const endAngle = 340;
            const angleRange = endAngle - startAngle;
            const angle = (startAngle + (angleRange / (opponentCount + 1)) * (i + 1)) * (Math.PI / 180);
            const x = centerX + radiusX * Math.cos(angle);
            const y = centerY + radiusY * Math.sin(angle);
            positions.push({ x, y });
        }
        return positions;
    };
    
    // ポジション名を取得
    const getPositionName = (index, dealerIndex, totalPlayers) => {
        if (totalPlayers === 2) return null;
        if (totalPlayers === 3) return null; // D, SB, BBのみ
        
        // ポジションの順序：D(0) → SB(1) → BB(2) → UTG(3) → LJ(4) → HJ(5) → CO(6) → D
        // 優先順位：UTG > CO > HJ > LJ
        const positionsAfterBB = [];
        for (let i = 3; i < totalPlayers; i++) {
            const pos = (dealerIndex + i) % totalPlayers;
            positionsAfterBB.push(pos);
        }
        
        if (totalPlayers === 4) {
            // D, SB, BB, UTG
            if (index === positionsAfterBB[0]) return 'UTG';
        } else if (totalPlayers === 5) {
            // D, SB, BB, UTG, CO
            if (index === positionsAfterBB[0]) return 'UTG';
            if (index === positionsAfterBB[positionsAfterBB.length - 1]) return 'CO';
        } else if (totalPlayers === 6) {
            // D, SB, BB, UTG, HJ, CO
            if (index === positionsAfterBB[0]) return 'UTG';
            if (index === positionsAfterBB[1]) return 'HJ';
            if (index === positionsAfterBB[positionsAfterBB.length - 1]) return 'CO';
        } else if (totalPlayers >= 7) {
            // D, SB, BB, UTG, LJ, HJ, CO
            if (index === positionsAfterBB[0]) return 'UTG';
            if (index === positionsAfterBB[1]) return 'LJ';
            if (index === positionsAfterBB[2]) return 'HJ';
            if (index === positionsAfterBB[positionsAfterBB.length - 1]) return 'CO';
        }
        
        return null;
    };
    
    const myPlayer = state.players.find(p => p.id === myPlayerId);
    const myIndex = state.players.findIndex(p => p.id === myPlayerId);
    
    // WINNER時の処理（フォールドで勝利、手札非公開）
    if (state.phase === 'WINNER') {
        document.getElementById('top-bar').classList.add('game-started');
        let html = '<div style="text-align:center; margin:20px 0; padding-bottom:40px;">';
        html += '<h2>🏆 勝者決定 🏆</h2>';
        html += `<div style="font-size:28px; font-weight:bold; color:#ffd700; margin:20px 0;">${state.winner.name}</div>`;
        html += `<div style="font-size:20px; margin:10px 0;">獲得: <span style="color:#00ff00; font-weight:bold;">+${state.winAmount}</span> チップ</div>`;
        html += `<div style="font-size:16px; color:#888; margin:10px 0;">現在のチップ: ${state.winner.chips}</div>`;
        
        // 次のハンドボタン（全員表示）
        const readyCount = state.nextHandReady ? state.nextHandReady.length : 0;
        const totalPlayers = state.players.filter(p => p.chips > 0).length;
        const isReady = state.nextHandReady && state.nextHandReady.includes(myPlayerId);
        
        html += `<div style="margin:40px 0;">`;
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
        document.getElementById('top-bar').classList.add('game-started');
        let html = '<div style="text-align:center; margin:20px 0; padding-bottom:40px;">';
        html += '<h2>🏆 ショウダウン 🏆</h2>';
        
        // サイドポット結果表示
        if (state.potResults && state.potResults.length > 0) {
            // ポットごとにグループ化
            const potGroups = {};
            state.potResults.forEach(r => {
                if (!potGroups[r.potType]) {
                    potGroups[r.potType] = [];
                }
                potGroups[r.potType].push(r);
            });
            
            // メインポット
            if (potGroups['main']) {
                html += `<div style="background:#1a4d1a; padding:15px; margin:15px 0; border-radius:8px; border:2px solid #ffd700;">`;
                html += `<div style="font-size:18px; font-weight:bold; color:#ffd700;">メインポット</div>`;
                potGroups['main'].forEach(r => {
                    html += `<div style="font-size:20px; margin:5px 0;">${r.player.name} 👑</div>`;
                    html += `<div style="font-size:16px; margin:5px 0;">${r.handName}</div>`;
                    html += `<div style="font-size:18px; margin:5px 0;">獲得: <span style="color:#00ff00; font-weight:bold;">+${r.amount}</span></div>`;
                });
                html += `</div>`;
            }
            
            // サイドポット
            Object.keys(potGroups).filter(k => k !== 'main').forEach((potType, idx) => {
                html += `<div style="background:#2a4d2a; padding:15px; margin:15px 0; border-radius:8px; border:2px solid #88aa88;">`;
                html += `<div style="font-size:16px; font-weight:bold; color:#88aa88;">サイドポット ${idx + 1}</div>`;
                potGroups[potType].forEach(r => {
                    html += `<div style="font-size:18px; margin:5px 0;">${r.player.name}</div>`;
                    html += `<div style="font-size:14px; margin:5px 0;">${r.handName}</div>`;
                    html += `<div style="font-size:16px; margin:5px 0;">獲得: <span style="color:#00ff00; font-weight:bold;">+${r.amount}</span></div>`;
                });
                html += `</div>`;
            });
        } else if (state.winner) {
            // 従来の表示（サイドポットなし）
            html += `<div style="background:#1a4d1a; padding:15px; margin:15px 0; border-radius:8px; border:2px solid #ffd700;">`;
            html += `<div style="font-size:24px; font-weight:bold; color:#ffd700;">勝者: ${state.winner.name}</div>`;
            html += `<div style="font-size:18px; margin:5px 0;">${state.winningHand || ''}</div>`;
            html += `<div style="font-size:20px; margin:10px 0;">獲得: <span style="color:#00ff00; font-weight:bold;">+${state.winAmount}</span> チップ</div>`;
            html += `</div>`;
        }
        
        // コミュニティカード表示
        html += '<h3>ボード</h3>';
        html += '<div style="display:flex; gap:4px; justify-content:center; margin:15px 0;">';
        state.community.forEach(card => {
            html += renderCard(card);
        });
        html += '</div>';
        
        // 全プレイヤーの手札を表示
        state.players.forEach(p => {
            if (!p.folded) {
                const wonPot = state.potResults && state.potResults.find(r => r.player.id === p.id);
                const isWinner = wonPot !== undefined;
                html += `<div style="background:${isWinner ? '#1a4d1a' : '#333'}; padding:15px; margin:10px 0; border-radius:8px; border:${isWinner ? '2px solid #ffd700' : 'none'};">`;
                html += `<div style="font-size:18px; font-weight:bold;">${p.name} ${isWinner ? '👑' : ''}</div>`;
                html += '<div style="display:flex; gap:4px; justify-content:center; margin:10px 0;">';
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
        
        html += `<div style="margin:40px 0;">`;
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
    
    // 新しいUI構造
    let html = '<div class="game-container">';
    
    // Ranking Button
    html += '<button class="ranking-btn" onclick="toggleRanking()">🏆</button>';
    
    // Table Area
    html += '<div class="table-area">';
    html += '<div class="poker-table">';
    html += '<div class="pot-display">';
    html += '<div class="pot-label">Pot</div>';
    html += `<div class="pot-amount">$${state.pot}</div>`;
    html += '</div>';
    html += '<div class="community-cards">';
    state.community.forEach(card => html += renderCard(card));
    const remainingCards = 5 - state.community.length;
    for (let i = 0; i < remainingCards; i++) {
        html += '<div class="card hidden"></div>';
    }
    html += '</div></div>';
    
    // Opponents
    html += '<div class="players-container">';
    const positions = getOpponentPositions(state.players.length);
    state.players.forEach((p, i) => {
        if (p.id === myPlayerId) return;
        
        const opponentIndex = i > myIndex ? i - 1 : i;
        if (opponentIndex >= positions.length) return;
        
        const pos = positions[opponentIndex];
        const isTurn = i === state.turnIndex;
        const isDealer = i === state.dealerIndex;
        const hasBet = p.bet > 0;
        
        let classes = 'opponent';
        if (isTurn) classes += ' is-active';
        if (isDealer) classes += ' is-dealer';
        if (hasBet) classes += ' has-bet';
        
        html += `<div class="${classes}" style="left:${pos.x}px; top:${pos.y}px;">`;
        html += '<div class="opponent-box">';
        html += '<span class="dealer-chip">D</span>';
        html += `<span class="opponent-name">${p.name}</span>`;
        html += `<span class="opponent-stack">$${p.chips}</span>`;
        if (p.lastAction) html += `<span class="opponent-action">${p.lastAction}</span>`;
        html += '</div>';
        html += '<div class="opponent-cards">';
        html += renderCard({}, true);
        html += renderCard({}, true);
        html += '</div>';
        html += `<div class="bet-badge">$${p.bet}</div>`;
        html += '</div>';
    });
    html += '</div></div>';
    
    // Bottom Area
    html += '<div class="bottom-area">';
    
    // Bet Slider (スタックの下に配置)
    const isTurn = myIndex === state.turnIndex;
    if (isTurn && myPlayer && !myPlayer.folded) {
        // 最小レイズ額の計算
        const minRaise = state.currentBet === 0 ? state.bb : state.currentBet;
        const minTotalBet = state.currentBet + minRaise; // テーブル上の総ベット額
        const minBetAmount = minTotalBet - myPlayer.bet; // 自分が追加で出す額
        const maxBetAmount = myPlayer.chips; // 残りチップ
        
        if (minBetAmount <= maxBetAmount) {
            html += '<div class="slider-area">';
            html += '<div class="slider-header">';
            html += '<span class="slider-label">BET AMOUNT</span>';
            html += `<span class="slider-value" id="betAmountDisplay">$${minBetAmount}</span>`;
            html += '</div>';
            html += '<div class="slider-wrapper">';
            html += '<div class="slider-track"></div>';
            html += '<div class="slider-fill" id="sliderFill"></div>';
            html += `<input type="range" class="bet-slider" id="betSlider" min="${minBetAmount}" max="${maxBetAmount}" value="${minBetAmount}" step="${state.bb}">`;
            html += '</div>';
            html += '<div class="quick-bets">';
            html += `<button class="quick-bet-btn" data-bet="${minBetAmount}">MIN</button>`;
            
            const halfPot = Math.max(minBetAmount, Math.floor((state.pot + state.currentBet) / 2));
            const fullPot = Math.max(minBetAmount, state.pot + state.currentBet);
            html += `<button class="quick-bet-btn" data-bet="${Math.min(halfPot, maxBetAmount)}">1/2</button>`;
            html += `<button class="quick-bet-btn" data-bet="${Math.min(fullPot, maxBetAmount)}">POT</button>`;
            html += `<button class="quick-bet-btn" data-bet="${maxBetAmount}">ALL-IN</button>`;
            html += '</div></div>';
        }
    }
    
    html += '<div class="bottom-row">';
    
    // My Stack
    html += '<div class="my-stack-area"><div class="my-stack-box">';
    html += '<div class="my-stack-label">Stack</div>';
    html += `<div class="my-stack-value">$${myPlayer ? myPlayer.chips : 0}</div>`;
    html += '</div></div>';
    
    // My Hand
    html += '<div class="my-hand-area">';
    html += '<div class="my-hand-label">Your Hand</div>';
    html += '<div class="my-cards">';
    if (myPlayer && myPlayer.hand) {
        myPlayer.hand.forEach(card => html += renderMyCard(card));
    }
    html += '</div></div>';
    
    // Actions
    html += '<div class="action-area">';
    if (isTurn && myPlayer && !myPlayer.folded) {
        html += `<button class="action-btn btn-fold" onclick="sendAction('fold')">Fold</button>`;
        
        const isCheck = state.currentBet === 0 || state.currentBet === myPlayer.bet;
        if (isCheck) {
            html += `<button class="action-btn btn-call" onclick="sendAction('check')">Check</button>`;
        } else {
            const callAmount = state.currentBet - myPlayer.bet;
            html += `<button class="action-btn btn-call" onclick="sendAction('call')">Call<span class="btn-amount">$${callAmount}</span></button>`;
        }
        
        // 最小レイズ額の計算: 現在のベット額 + (前回のレイズ額 or BB)
        const minRaise = state.currentBet === 0 ? state.bb : state.currentBet;
        const minBet = state.currentBet + minRaise;
        const totalBetNeeded = minBet - myPlayer.bet; // 自分が追加で出す必要がある額
        const maxBet = myPlayer.chips; // 残りチップ
        
        if (totalBetNeeded <= maxBet) {
            const buttonText = state.currentBet === 0 ? 'Bet' : 'Raise';
            html += `<button class="action-btn btn-raise" onclick="sendSliderRaise()">${buttonText}<span class="btn-amount" id="raiseAmount">$${totalBetNeeded}</span></button>`;
        }
    }
    html += '</div>';
    html += '</div>'; // bottom-row
    html += '</div>'; // bottom-area
    
    html += '</div>';
    
    // Ranking Modal
    html += '<div class="ranking-modal" id="rankingModal" onclick="closeRankingIfOutside(event)">';
    html += '<div class="ranking-content" onclick="event.stopPropagation()">';
    html += '<div class="ranking-header">';
    html += '<span class="ranking-title">🏆 Rankings</span>';
    html += '<button class="ranking-close" onclick="toggleRanking()">✕</button>';
    html += '</div>';
    
    const sortedPlayers = [...state.players].sort((a, b) => b.chips - a.chips);
    sortedPlayers.forEach((p, index) => {
        let rankIcon = '';
        if (index === 0) rankIcon = '🥇';
        else if (index === 1) rankIcon = '🥈';
        else if (index === 2) rankIcon = '🥉';
        else rankIcon = `${index + 1}位`;
        
        html += '<div class="ranking-item">';
        html += `<span class="ranking-rank">${rankIcon}</span>`;
        html += `<span class="ranking-name">${p.name}</span>`;
        html += `<span class="ranking-chips">$${p.chips}</span>`;
        html += '</div>';
    });
    
    html += '</div></div>';
    
    gameArea.innerHTML = html;
    
    // Slider event listeners
    const betSlider = document.getElementById('betSlider');
    if (betSlider) {
        betSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('betAmountDisplay').textContent = '$' + value;
            document.getElementById('raiseAmount').textContent = '$' + value;
            const percentage = ((value - betSlider.min) / (betSlider.max - betSlider.min)) * 100;
            document.getElementById('sliderFill').style.width = percentage + '%';
        });
        
        document.querySelectorAll('.quick-bet-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const value = parseInt(btn.dataset.bet);
                betSlider.value = value;
                betSlider.dispatchEvent(new Event('input'));
            });
        });
    }
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

window.updateRaiseDisplay = function() {
    const slider = document.getElementById('raise-slider');
    const display = document.getElementById('raise-display');
    if (slider && display) {
        display.textContent = slider.value;
    }
};

window.setRaiseAmount = function(amount) {
    const slider = document.getElementById('raise-slider');
    const display = document.getElementById('raise-display');
    if (slider && display) {
        slider.value = amount;
        display.textContent = amount;
    }
};

window.sendSliderRaise = function() {
    const slider = document.getElementById('betSlider');
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
};

window.nextHand = function() {
    console.log('次のハンド開始（旧関数）');
    nextHandReady.clear();
    startNextHand();
};

window.toggleRanking = function() {
    const modal = document.getElementById('rankingModal');
    if (modal) {
        modal.classList.toggle('show');
    }
};

window.closeRankingIfOutside = function(event) {
    if (event.target.id === 'rankingModal') {
        toggleRanking();
    }
};

