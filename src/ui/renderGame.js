import { appState } from '../state/appState.js';
import { getOpponentPositions } from '../utils/playerPositions.js';

function getCardColor(suit) {
    if (suit === '♠') return 'black';
    if (suit === '♥') return 'red';
    if (suit === '♦') return 'blue';
    if (suit === '♣') return 'green';
    return 'black';
}

function renderCard(card, isMini = false) {
    const colorClass = getCardColor(card.suit);
    if (isMini) {
        return '<div class="mini-card"></div>';
    }
    return `<div class="card ${colorClass}"><span class="card-value">${card.rank}</span><span class="card-suit">${card.suit}</span></div>`;
}

function renderMyCard(card) {
    const colorClass = getCardColor(card.suit);
    return `<div class="my-card ${colorClass}"><span class="card-value">${card.rank}</span><span class="card-suit">${card.suit}</span></div>`;
}

function renderWinnerState(state, myPlayerId) {
    let html = '<div style="text-align:center; margin:20px 0; padding-bottom:40px;">';
    html += '<h2>🏆 勝者決定 🏆</h2>';
    html += `<div style="font-size:28px; font-weight:bold; color:#ffd700; margin:20px 0;">${state.winner.name}</div>`;
    html += `<div style="font-size:20px; margin:10px 0;">獲得: <span style="color:#00ff00; font-weight:bold;">+${state.winAmount}</span> チップ</div>`;
    html += `<div style="font-size:16px; color:#888; margin:10px 0;">現在のチップ: ${state.winner.chips}</div>`;

    const readyCount = state.nextHandReady ? state.nextHandReady.length : 0;
    const totalPlayers = state.players.filter((player) => player.chips > 0).length;
    const isReady = state.nextHandReady && state.nextHandReady.includes(myPlayerId);

    html += '<div style="margin:40px 0;">';
    html += `<div style="font-size:14px; color:#aaa; margin:10px 0;">準備完了: ${readyCount}/${totalPlayers}</div>`;
    if (isReady) {
        html += '<button disabled style="width:80%; padding:20px; font-size:18px; background:#555; color:#aaa;">準備完了 ✓</button>';
    } else {
        html += '<button onclick="readyNextHand()" style="width:80%; padding:20px; font-size:18px;">次のハンドへ</button>';
    }
    html += '</div>';
    html += '</div>';

    return html;
}

function renderShowdownState(state, myPlayerId) {
    let html = '<div style="text-align:center; margin:20px 0; padding-bottom:40px;">';
    html += '<h2>🏆 ショウダウン 🏆</h2>';

    if (state.potResults && state.potResults.length > 0) {
        const potGroups = {};
        state.potResults.forEach((result) => {
            if (!potGroups[result.potType]) {
                potGroups[result.potType] = [];
            }
            potGroups[result.potType].push(result);
        });

        if (potGroups.main) {
            html += '<div style="background:#1a4d1a; padding:15px; margin:15px 0; border-radius:8px; border:2px solid #ffd700;">';
            html += '<div style="font-size:18px; font-weight:bold; color:#ffd700;">メインポット</div>';
            potGroups.main.forEach((result) => {
                html += `<div style="font-size:20px; margin:5px 0;">${result.player.name} 👑</div>`;
                html += `<div style="font-size:16px; margin:5px 0;">${result.handName}</div>`;
                html += `<div style="font-size:18px; margin:5px 0;">獲得: <span style="color:#00ff00; font-weight:bold;">+${result.amount}</span></div>`;
            });
            html += '</div>';
        }

        Object.keys(potGroups)
            .filter((key) => key !== 'main')
            .forEach((potType, index) => {
                html += '<div style="background:#2a4d2a; padding:15px; margin:15px 0; border-radius:8px; border:2px solid #88aa88;">';
                html += `<div style="font-size:16px; font-weight:bold; color:#88aa88;">サイドポット ${index + 1}</div>`;
                potGroups[potType].forEach((result) => {
                    html += `<div style="font-size:18px; margin:5px 0;">${result.player.name}</div>`;
                    html += `<div style="font-size:14px; margin:5px 0;">${result.handName}</div>`;
                    html += `<div style="font-size:16px; margin:5px 0;">獲得: <span style="color:#00ff00; font-weight:bold;">+${result.amount}</span></div>`;
                });
                html += '</div>';
            });
    } else if (state.winner) {
        html += '<div style="background:#1a4d1a; padding:15px; margin:15px 0; border-radius:8px; border:2px solid #ffd700;">';
        html += `<div style="font-size:24px; font-weight:bold; color:#ffd700;">勝者: ${state.winner.name}</div>`;
        html += `<div style="font-size:18px; margin:5px 0;">${state.winningHand || ''}</div>`;
        html += `<div style="font-size:20px; margin:10px 0;">獲得: <span style="color:#00ff00; font-weight:bold;">+${state.winAmount}</span> チップ</div>`;
        html += '</div>';
    }

    html += '<h3>ボード</h3>';
    html += '<div style="display:flex; gap:4px; justify-content:center; margin:15px 0;">';
    state.community.forEach((card) => {
        html += renderCard(card);
    });
    html += '</div>';

    state.players.forEach((player) => {
        if (player.folded) {
            return;
        }

        const wonPot = state.potResults && state.potResults.find((result) => result.player.id === player.id);
        const isWinner = wonPot !== undefined;
        html += `<div style="background:${isWinner ? '#1a4d1a' : '#333'}; padding:15px; margin:10px 0; border-radius:8px; border:${isWinner ? '2px solid #ffd700' : 'none'};">`;
        html += `<div style="font-size:18px; font-weight:bold;">${player.name} ${isWinner ? '👑' : ''}</div>`;
        html += '<div style="display:flex; gap:4px; justify-content:center; margin:10px 0;">';
        if (player.hand && player.hand.length > 0) {
            player.hand.forEach((card) => {
                html += renderCard(card);
            });
        }
        html += '</div>';
        html += `<div>チップ: ${player.chips}</div>`;
        html += '</div>';
    });

    const readyCount = state.nextHandReady ? state.nextHandReady.length : 0;
    const totalPlayers = state.players.filter((player) => player.chips > 0).length;
    const isReady = state.nextHandReady && state.nextHandReady.includes(myPlayerId);

    html += '<div style="margin:40px 0;">';
    html += `<div style="font-size:14px; color:#aaa; margin:10px 0;">準備完了: ${readyCount}/${totalPlayers}</div>`;
    if (isReady) {
        html += '<button disabled style="width:80%; padding:20px; font-size:18px; background:#555; color:#aaa;">準備完了 ✓</button>';
    } else {
        html += '<button onclick="readyNextHand()" style="width:80%; padding:20px; font-size:18px;">次のハンドへ</button>';
    }
    html += '</div>';
    html += '</div>';

    return html;
}

function attachSliderListeners() {
    const betSlider = document.getElementById('betSlider');
    if (!betSlider) {
        return;
    }

    betSlider.addEventListener('input', (event) => {
        const value = parseInt(event.target.value, 10);
        document.getElementById('betAmountDisplay').textContent = '$' + value;
        document.getElementById('raiseAmount').textContent = '$' + value;
        const percentage = ((value - betSlider.min) / (betSlider.max - betSlider.min)) * 100;
        document.getElementById('sliderFill').style.width = percentage + '%';
    });

    document.querySelectorAll('.quick-bet-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const value = parseInt(button.dataset.bet, 10);
            betSlider.value = value;
            betSlider.dispatchEvent(new Event('input'));
        });
    });
}

export function renderGame(state) {
    appState.lastRenderedState = state;

    const gameArea = document.getElementById('game-area');
    const topBar = document.getElementById('top-bar');
    const roomIdInfo = document.getElementById('room-id-info');

    topBar.classList.add('game-started');
    roomIdInfo.classList.add('hidden');

    const myPlayer = state.players.find((player) => player.id === appState.myPlayerId);
    const myIndex = state.players.findIndex((player) => player.id === appState.myPlayerId);

    if (state.phase === 'WINNER') {
        gameArea.innerHTML = renderWinnerState(state, appState.myPlayerId);
        return;
    }

    if (state.phase === 'SHOWDOWN') {
        gameArea.innerHTML = renderShowdownState(state, appState.myPlayerId);
        return;
    }

    let html = '<div class="game-container">';
    html += '<button class="ranking-btn" onclick="toggleRanking()">🏆</button>';
    html += '<div class="table-area">';
    html += '<div class="poker-table">';
    html += '<div class="pot-display">';
    html += '<div class="pot-label">Pot</div>';
    html += `<div class="pot-amount">$${state.pot}</div>`;
    html += '</div>';
    html += '<div class="community-cards">';
    state.community.forEach((card) => {
        html += renderCard(card);
    });
    const remainingCards = 5 - state.community.length;
    for (let index = 0; index < remainingCards; index++) {
        html += '<div class="card hidden"></div>';
    }
    html += '</div></div>';

    html += '<div class="players-container">';
    const positions = getOpponentPositions(state.players.length);
    state.players.forEach((player, index) => {
        if (player.id === appState.myPlayerId) {
            return;
        }

        const opponentIndex = index > myIndex ? index - 1 : index;
        if (opponentIndex >= positions.length) {
            return;
        }

        const position = positions[opponentIndex];
        const isTurn = index === state.turnIndex;
        const isDealer = index === state.dealerIndex;
        const hasBet = player.bet > 0;

        let classes = 'opponent';
        if (isTurn) classes += ' is-active';
        if (isDealer) classes += ' is-dealer';
        if (hasBet) classes += ' has-bet';
        if (player.folded) classes += ' folded';

        html += `<div class="${classes}" style="left:${position.x}px; top:${position.y}px;">`;
        html += '<div class="opponent-box">';
        html += '<span class="dealer-chip">D</span>';
        html += `<span class="opponent-name">${player.name}</span>`;
        html += `<span class="opponent-stack">$${player.chips}</span>`;
        if (player.folded) {
            html += '<span class="opponent-action opponent-action-fold">FOLD</span>';
        } else if (player.lastAction) {
            html += `<span class="opponent-action">${player.lastAction}</span>`;
        }
        html += '</div>';
        html += '<div class="opponent-cards">';
        html += `<div class="mini-card${player.folded ? ' folded' : ''}"></div>`;
        html += `<div class="mini-card${player.folded ? ' folded' : ''}"></div>`;
        html += '</div>';
        html += `<div class="bet-badge">$${player.bet}</div>`;
        html += '</div>';
    });
    html += '</div></div>';

    html += '<div class="bottom-area">';

    const isTurn = myIndex === state.turnIndex;
    if (isTurn && myPlayer && !myPlayer.folded) {
        const minRaise = state.currentBet === 0 ? state.bb : state.currentBet;
        const minTotalBet = state.currentBet + minRaise;
        const minBetAmount = minTotalBet - myPlayer.bet;
        const maxBetAmount = myPlayer.chips;

        if (minBetAmount <= maxBetAmount) {
            html += '<div class="slider-area">';
            html += '<div class="slider-header">';
            html += '<span class="slider-label">BET AMOUNT</span>';
            html += `<span class="slider-value" id="betAmountDisplay">$${minBetAmount}</span>`;
            html += '</div>';
            html += '<div class="slider-wrapper">';
            html += '<div class="slider-track"></div>';
            html += '<div class="slider-fill" id="sliderFill"></div>';
            html += `<input type="range" class="bet-slider" id="betSlider" min="${minBetAmount}" max="${maxBetAmount}" value="${minBetAmount}" step="1">`;
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
    html += `<div class="my-stack-area"><div class="my-stack-box${isTurn ? ' is-my-turn' : ''}">`;
    html += '<div class="my-stack-label">Stack</div>';
    html += `<div class="my-stack-value">$${myPlayer ? myPlayer.chips : 0}</div>`;
    if (myPlayer && myPlayer.bet > 0) {
        html += `<div class="my-bet-amount">Bet: $${myPlayer.bet}</div>`;
    }
    html += '</div></div>';

    html += '<div class="my-hand-area">';
    html += '<div class="my-hand-label">Your Hand</div>';
    html += '<div class="my-cards">';
    if (myPlayer && myPlayer.hand) {
        myPlayer.hand.forEach((card) => {
            html += renderMyCard(card);
        });
    }
    html += '</div></div>';

    html += '<div class="action-area">';
    if (isTurn && myPlayer && !myPlayer.folded) {
        html += '<div class="my-turn-banner">YOUR TURN</div>';
        html += '<button class="action-btn btn-fold" onclick="confirmFold()">Fold</button>';

        const isCheck = state.currentBet === 0 || state.currentBet === myPlayer.bet;
        if (isCheck) {
            html += '<button class="action-btn btn-call" onclick="sendAction(\'check\')">Check</button>';
        } else {
            const callAmount = state.currentBet - myPlayer.bet;
            html += `<button class="action-btn btn-call" onclick="sendAction('call')">Call<span class="btn-amount">$${callAmount}</span></button>`;
        }

        const minRaise = state.currentBet === 0 ? state.bb : state.currentBet;
        const minBet = state.currentBet + minRaise;
        const totalBetNeeded = minBet - myPlayer.bet;
        const maxBet = myPlayer.chips;

        if (totalBetNeeded <= maxBet) {
            const buttonText = state.currentBet === 0 ? 'Bet' : 'Raise';
            html += `<button class="action-btn btn-raise" onclick="sendSliderRaise()">${buttonText}<span class="btn-amount" id="raiseAmount">$${totalBetNeeded}</span></button>`;
        }
    }
    html += '</div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="ranking-modal" id="rankingModal" onclick="closeRankingIfOutside(event)">';
    html += '<div class="ranking-content" onclick="event.stopPropagation()">';
    html += '<div class="ranking-header">';
    html += '<span class="ranking-title">🏆 Rankings</span>';
    html += '<button class="ranking-close" onclick="toggleRanking()">✕</button>';
    html += '</div>';

    const sortedPlayers = [...state.players].sort((left, right) => right.chips - left.chips);
    sortedPlayers.forEach((player, index) => {
        let rankIcon = '';
        if (index === 0) rankIcon = '🥇';
        else if (index === 1) rankIcon = '🥈';
        else if (index === 2) rankIcon = '🥉';
        else rankIcon = `${index + 1}位`;

        html += '<div class="ranking-item">';
        html += `<span class="ranking-rank">${rankIcon}</span>`;
        html += `<span class="ranking-name">${player.name}</span>`;
        html += `<span class="ranking-chips">$${player.chips}</span>`;
        html += '</div>';
    });

    html += '</div></div>';
    html += '</div>';

    gameArea.innerHTML = html;
    attachSliderListeners();
}
