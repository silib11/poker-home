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
        
        // ゲーム中のスクロール無効化
        document.body.classList.add('game-active');
        gameScreen.classList.add('playing');
        
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
        const currentBets = data.state.players.reduce((sum, p) => sum + (p.bet || 0), 0);
        const totalPot = data.state.pot + currentBets;
        status.textContent = `${data.state.phase} - ポット: ${totalPot}`;
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
    const currentBets = newState.players.reduce((sum, p) => sum + (p.bet || 0), 0);
    const totalPot = newState.pot + currentBets;
    status.textContent = `${newState.phase} - ポット: ${totalPot}`;
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
    
    // プレイヤーの座席位置を計算（円形配置）
    const getPlayerPosition = (index, total) => {
        const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
        const radiusX = 45; // 横方向の半径（%）
        const radiusY = 40; // 縦方向の半径（%）
        const x = 50 + radiusX * Math.cos(angle);
        const y = 50 + radiusY * Math.sin(angle);
        return { x, y };
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
        html += '<div style="margin:15px 0;">';
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
    
    // ポーカーテーブル
    let html = '<div id="poker-table">';
    
    // テーブル中央（コミュニティカード＋ポット）
    html += '<div class="table-center">';
    html += '<div style="margin:10px 0;">';
    state.community.forEach(card => {
        html += renderCard(card);
    });
    html += '</div>';
    
    // POTは確定分のみ表示（ベット中は含めない）
    html += `<div style="font-size:16px; font-weight:bold; color:#ffd700;">ポット: ${state.pot}</div>`;
    html += '</div>';
    
    // プレイヤー座席
    state.players.forEach((p, i) => {
        const pos = getPlayerPosition(i, state.players.length);
        const isTurn = i === state.turnIndex;
        const isFolded = p.folded;
        const isMe = p.id === myPlayerId;
        
        const sbIndex = (state.dealerIndex + 1) % state.players.length;
        const bbIndex = (state.dealerIndex + 2) % state.players.length;
        const isDealer = i === state.dealerIndex;
        const isSB = i === sbIndex;
        const isBB = i === bbIndex;
        
        let seatClass = 'player-seat';
        if (isTurn) seatClass += ' active';
        if (isFolded) seatClass += ' folded';
        if (isMe) seatClass += ' my-seat';
        
        let badges = '';
        if (isDealer) badges += '<span class="blind-badge" style="background:#ffd700;">D</span>';
        if (isSB) badges += '<span class="blind-badge">SB</span>';
        if (isBB) badges += '<span class="blind-badge">BB</span>';
        
        // ポジション表示（右上）
        let positionBadge = '';
        if (isDealer) {
            positionBadge = '<span class="position-badge" style="background:linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);">BTN</span>';
        } else if (isSB) {
            positionBadge = '<span class="position-badge" style="background:linear-gradient(135deg, #66ccff 0%, #3399ff 100%);">SB</span>';
        } else if (isBB) {
            positionBadge = '<span class="position-badge" style="background:linear-gradient(135deg, #ff6666 0%, #ff3333 100%);">BB</span>';
        } else if (state.players.length >= 3) {
            const position = getPositionName(i, state.dealerIndex, state.players.length);
            if (position === 'UTG') {
                positionBadge = '<span class="position-badge" style="background:linear-gradient(135deg, #9966ff 0%, #7744ff 100%);">UTG</span>';
            } else if (position === 'MP') {
                positionBadge = '<span class="position-badge" style="background:linear-gradient(135deg, #66ff99 0%, #33ff66 100%);">MP</span>';
            } else if (position === 'CO') {
                positionBadge = '<span class="position-badge" style="background:linear-gradient(135deg, #ff9966 0%, #ff7733 100%);">CO</span>';
            }
        }
        
        html += `<div class="${seatClass}" style="left:${pos.x}%; top:${pos.y}%; transform:translate(-50%, -50%);">`;
        html += positionBadge;
        html += `<div style="font-weight:bold; font-size:13px;">${p.name} ${badges}</div>`;
        html += `<div style="font-size:11px; color:#aaa;">チップ: ${p.chips}</div>`;
        if (p.bet > 0) {
            html += `<div style="font-size:12px; font-weight:bold; color:#ffff66; background:rgba(255,255,102,0.2); padding:2px 4px; border-radius:4px; margin-top:2px;">ベット: ${p.bet}</div>`;
        }
        html += '</div>';
    });
    
    html += '</div>';
    
    // 自分の手札とアクション
    const myPlayer = state.players.find(p => p.id === myPlayerId);
    if (myPlayer && myPlayer.hand && myPlayer.hand.length > 0) {
        html += '<div id="my-hand">';
        html += '<div style="margin:10px 0;">';
        myPlayer.hand.forEach(card => {
            html += renderCard(card);
        });
        html += '</div>';
        html += '</div>';
        
        const myIndex = state.players.findIndex(p => p.id === myPlayerId);
        const isTurn = myIndex === state.turnIndex;
        
        if (isTurn && !myPlayer.folded) {
            html += '<div id="action-buttons">';
            html += `<button onclick="sendAction('fold')" style="width:48%; margin:2px;">フォールド</button>`;
            
            if (state.currentBet === 0 || state.currentBet === myPlayer.bet) {
                html += `<button onclick="sendAction('check')" style="width:48%; margin:2px;">チェック</button>`;
            } else {
                const callAmount = state.currentBet - myPlayer.bet;
                html += `<button onclick="sendAction('call')" style="width:48%; margin:2px;">コール(${callAmount})</button>`;
            }
            
            const minTotalBet = state.currentBet === 0 ? state.bb : state.currentBet * 2;
            const maxTotalBet = myPlayer.bet + myPlayer.chips;
            
            if (minTotalBet <= maxTotalBet) {
                const label = state.currentBet === 0 ? 'ベット' : 'レイズ';
                
                html += `<div style="margin:10px 0;">`;
                html += `<input type="range" id="raise-slider" min="${minTotalBet}" max="${maxTotalBet}" value="${minTotalBet}" step="${state.bb}" style="width:100%;" oninput="updateRaiseDisplay()">`;
                html += `<div style="text-align:center; font-size:18px; font-weight:bold; margin:5px 0;">`;
                html += `<span id="raise-display">${minTotalBet}</span> チップ`;
                html += `</div>`;
                html += `<button onclick="sendSliderRaise()" style="width:100%; margin:2px; background:#ff9966; font-size:16px; padding:12px;">${label}</button>`;
                html += `</div>`;
                
                html += `<div style="display:flex; gap:5px; margin:5px 0;">`;
                html += `<button onclick="setRaiseAmount(${minTotalBet})" style="flex:1; padding:8px; font-size:12px;">ミニマム</button>`;
                
                const potRaise = state.pot + state.currentBet;
                if (potRaise > minTotalBet && potRaise <= maxTotalBet) {
                    html += `<button onclick="setRaiseAmount(${potRaise})" style="flex:1; padding:8px; font-size:12px;">ポット</button>`;
                }
                
                if (maxTotalBet > minTotalBet) {
                    html += `<button onclick="setRaiseAmount(${maxTotalBet})" style="flex:1; padding:8px; font-size:12px; background:#cc0000;">オールイン</button>`;
                }
                html += `</div>`;
            }
            
            html += '</div>';
        }
    }
    
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
    const slider = document.getElementById('raise-slider');
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

