import { appState } from '../state/appState.js';
import { dom } from '../ui/dom.js';
import { renderGame } from '../ui/renderGame.js';
import { updatePlayersList } from '../controllers/roomController.js';
import { checkAllReady, handlePlayerAction, showGameOver } from '../controllers/gameController.js';

function handleJoin(data) {
    if (!appState.isHost) {
        return;
    }

    const playerId = Date.now().toString();
    const newPlayer = {
        id: playerId,
        name: data.name,
        chips: appState.gameState.buyin
    };

    appState.gameState.players.push(newPlayer);
    appState.allPlayers.push(newPlayer);
    updatePlayersList();
    appState.rtc.broadcast({ type: 'state', state: appState.gameState });
    appState.rtc.broadcast({ type: 'player_id', playerId, name: data.name });
}

function handlePlayerId(data) {
    if (data.name === appState.myPlayerName) {
        appState.myPlayerId = data.playerId;
    }
}

function handleState(data) {
    appState.gameState = data.state;
    updatePlayersList();
}

function handleBlinds(data) {
    appState.gameState.sb = data.sb;
    appState.gameState.bb = data.bb;
}

function handleGameStart(data) {
    appState.nextHandReady.clear();
    document.body.classList.add('game-active');
    dom.gameScreen.classList.add('playing');
    renderGame(data.state);
}

function handleGameRestart(data) {
    if (data.allPlayers) {
        appState.gameState.players = data.allPlayers;
    } else {
        appState.gameState.players = appState.gameState.players.map((player) => ({
            ...player,
            chips: data.buyin
        }));
    }
    updatePlayersList();
    renderGame(data.state);
}

function handleReadyNextHand(data) {
    if (!appState.isHost) {
        return;
    }

    appState.nextHandReady.add(data.playerId);
    checkAllReady();
}

function handleGameUpdate(data) {
    if (data.state.players) {
        appState.gameState.players = data.state.players.map((player) => ({
            id: player.id,
            name: player.name,
            chips: player.chips
        }));
        updatePlayersList();
    }
    renderGame(data.state);
}

function handleRemoteAction(data) {
    if (appState.isHost) {
        handlePlayerAction(data);
    }
}

const handlers = {
    join: handleJoin,
    player_id: handlePlayerId,
    state: handleState,
    blinds: handleBlinds,
    game_start: handleGameStart,
    game_over: showGameOver,
    game_restart: handleGameRestart,
    ready_next_hand: handleReadyNextHand,
    game_update: handleGameUpdate,
    action: handleRemoteAction
};

export function handleMessage(message) {
    const data = JSON.parse(message);
    const handler = handlers[data.type];
    if (handler) {
        handler(data);
    }
}
