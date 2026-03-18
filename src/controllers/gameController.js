import { PokerGame } from '../../core/poker.js';
import { appState } from '../state/appState.js';
import { dom } from '../ui/dom.js';
import { renderGame } from '../ui/renderGame.js';
import { updatePlayersList } from './roomController.js';

function syncPlayersFromGameState(state) {
    if (!state.players) {
        return;
    }

    appState.gameState.players = state.players.map((player) => ({
        id: player.id,
        name: player.name,
        chips: player.chips
    }));
}

export function startGame() {
    if (appState.gameState.players.length < 2) {
        alert('最低2人必要です');
        return;
    }

    dom.hostModal.style.display = 'none';
    document.body.classList.add('game-active');
    dom.gameScreen.classList.add('playing');

    dom.sbControl.value = appState.gameState.sb;
    dom.bbControl.value = appState.gameState.bb;

    appState.game = new PokerGame(
        appState.gameState.players,
        appState.gameState.sb,
        appState.gameState.bb
    );
    appState.game.start();

    const state = appState.game.getState();
    appState.rtc.broadcast({ type: 'game_start', state });
    renderGame(state);
}

export function handlePlayerAction(data) {
    const playerIndex = appState.game.players.findIndex((player) => player.id === data.playerId);
    if (playerIndex === -1) {
        console.error('プレイヤーが見つかりません:', data.playerId);
        return;
    }

    if (data.action === 'fold') {
        appState.game.fold(playerIndex);
    } else if (data.action === 'check') {
        appState.game.check(playerIndex);
    } else if (data.action === 'call') {
        appState.game.call(playerIndex);
    } else if (data.action === 'bet') {
        appState.game.bet(playerIndex, parseInt(data.amount, 10));
    }

    const newState = appState.game.getState();
    syncPlayersFromGameState(newState);
    appState.rtc.broadcast({ type: 'game_update', state: newState });
    renderGame(newState);
    updatePlayersList();
}

export function checkAllReady() {
    const activePlayers = appState.game.players.filter((player) => player.chips > 0);

    if (appState.nextHandReady.size >= activePlayers.length) {
        appState.nextHandReady.clear();
        startNextHand();
        return;
    }

    const state = appState.game.getState();
    state.nextHandReady = Array.from(appState.nextHandReady);
    appState.rtc.broadcast({ type: 'game_update', state });
    renderGame(state);
}

export function startNextHand() {
    appState.gameState.players = appState.game.players
        .filter((player) => player.chips > 0)
        .map((player) => ({
            id: player.id,
            name: player.name,
            chips: player.chips
        }));

    if (appState.gameState.players.length < 2) {
        showGameOver();
        return;
    }

    const currentDealerIndex = appState.game.dealerIndex;
    const nextDealerIndex = (currentDealerIndex + 1) % appState.gameState.players.length;

    appState.game = new PokerGame(
        appState.gameState.players,
        appState.gameState.sb,
        appState.gameState.bb
    );
    appState.game.dealerIndex = nextDealerIndex;
    appState.game.start();

    const state = appState.game.getState();
    appState.rtc.broadcast({ type: 'game_start', state });
    renderGame(state);
}

export function showGameOver() {
    const gameArea = document.getElementById('game-area');
    let html = '<div style="text-align:center; margin:20px 0;">';
    html += '<h2>🎉 ゲーム終了 🎉</h2>';

    if (appState.gameState.players.length === 1) {
        html += `<div style="font-size:28px; font-weight:bold; color:#ffd700; margin:20px 0;">優勝: ${appState.gameState.players[0].name}</div>`;
        html += `<div style="font-size:20px; margin:10px 0;">最終チップ: ${appState.gameState.players[0].chips}</div>`;
    } else {
        html += '<div style="font-size:20px; margin:20px 0;">プレイヤーが足りません</div>';
    }

    if (appState.isHost) {
        html += '<button onclick="restartGame()" style="width:80%; padding:20px; font-size:18px; margin:20px 0; background:#00aa00;">新しいゲームを開始</button>';
    } else {
        html += '<div style="margin:20px 0; color:#aaa;">ホストが新しいゲームを開始するまでお待ちください</div>';
    }

    html += '</div>';
    gameArea.innerHTML = html;

    if (appState.isHost && appState.rtc) {
        appState.rtc.broadcast({ type: 'game_over' });
    }
}

export function restartGame() {
    appState.gameState.players = appState.allPlayers.map((player) => ({
        id: player.id,
        name: player.name,
        chips: appState.gameState.buyin
    }));

    appState.game = new PokerGame(
        appState.gameState.players,
        appState.gameState.sb,
        appState.gameState.bb
    );
    appState.game.start();

    const state = appState.game.getState();
    appState.rtc.broadcast({
        type: 'game_restart',
        state,
        buyin: appState.gameState.buyin,
        allPlayers: appState.gameState.players
    });
    renderGame(state);
    updatePlayersList();
}
