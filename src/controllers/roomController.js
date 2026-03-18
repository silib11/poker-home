import { WebRTCManager } from '../network/webrtc.js';
import { appState } from '../state/appState.js';
import { dom } from '../ui/dom.js';
import { handleMessage } from '../network/messageRouter.js';

export function updateRoomInfo() {
    const playerCount = appState.gameState.players.length;
    dom.roomIdInfo.textContent = `ルームID: ${appState.currentRoomId} | ${playerCount}人`;
}

export function updatePlayersList() {
    updateRoomInfo();
}

export async function createRoom() {
    const hostName = dom.hostNameInput.value.trim();
    if (!hostName) {
        alert('名前を入力してください');
        return;
    }

    appState.myPlayerName = hostName;
    appState.isHost = true;
    appState.gameState.buyin = parseInt(dom.buyinInput.value, 10);
    appState.gameState.sb = parseInt(dom.sbInput.value, 10);
    appState.gameState.bb = parseInt(dom.bbInput.value, 10);

    appState.rtc = new WebRTCManager(true);
    appState.rtc.onMessage = handleMessage;
    appState.rtc.onConnected = () => {
        updateRoomInfo();
    };

    try {
        appState.currentRoomId = await appState.rtc.createRoom();

        appState.myPlayerId = Date.now().toString();
        const hostPlayer = {
            id: appState.myPlayerId,
            name: hostName,
            chips: appState.gameState.buyin
        };

        appState.gameState.players.push(hostPlayer);
        appState.allPlayers.push(hostPlayer);

        dom.setupScreen.style.display = 'none';
        dom.gameScreen.style.display = 'block';
        dom.hostMenuBtn.style.display = 'block';

        updateRoomInfo();
        dom.sbControl.value = appState.gameState.sb;
        dom.bbControl.value = appState.gameState.bb;
        updatePlayersList();
    } catch (error) {
        console.error('ルーム作成エラー:', error);
        alert('ルーム作成に失敗しました');
    }
}

export async function joinRoom() {
    const name = dom.playerNameInput.value.trim();
    const roomId = dom.roomIdInput.value.trim();

    if (!name) {
        alert('名前を入力してください');
        return;
    }

    if (!roomId) {
        alert('ルームIDを入力してください');
        return;
    }

    appState.myPlayerName = name;
    appState.currentRoomId = roomId;
    appState.rtc = new WebRTCManager(false);

    appState.rtc.onMessage = handleMessage;
    appState.rtc.onConnected = () => {
        appState.rtc.send({ type: 'join', name });
    };

    await appState.rtc.joinRoom(roomId);

    dom.setupScreen.style.display = 'none';
    dom.gameScreen.style.display = 'block';
    updateRoomInfo();
}

export function bindRoomControls(startGame) {
    dom.createBtn.addEventListener('click', createRoom);
    dom.joinBtn.addEventListener('click', joinRoom);

    dom.hostMenuBtn.addEventListener('click', () => {
        dom.hostModal.style.display = 'flex';
    });

    dom.closeHostModal.addEventListener('click', () => {
        dom.hostModal.style.display = 'none';
    });

    dom.hostModal.addEventListener('click', (event) => {
        if (event.target === dom.hostModal) {
            dom.hostModal.style.display = 'none';
        }
    });

    dom.updateBlindsBtn.addEventListener('click', () => {
        appState.gameState.sb = parseInt(dom.sbControl.value, 10);
        appState.gameState.bb = parseInt(dom.bbControl.value, 10);
        appState.rtc.broadcast({
            type: 'blinds',
            sb: appState.gameState.sb,
            bb: appState.gameState.bb
        });
        dom.hostModal.style.display = 'none';
    });

    dom.startGameBtn.addEventListener('click', startGame);
}
