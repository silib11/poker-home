import { appState } from '../state/appState.js';
import { handlePlayerAction, checkAllReady, restartGame, startNextHand } from '../controllers/gameController.js';

function sendAction(action, amount) {
    const amountNum = amount ? parseInt(amount, 10) : 0;

    if (appState.isHost) {
        handlePlayerAction({ playerId: appState.myPlayerId, action, amount: amountNum });
    } else {
        appState.rtc.send({
            type: 'action',
            playerId: appState.myPlayerId,
            action,
            amount: amountNum
        });
    }
}

function confirmFold() {
    const state = appState.lastRenderedState;
    const myPlayer = state && state.players.find((player) => player.id === appState.myPlayerId);
    const canCheck = state && (state.currentBet === 0 || state.currentBet === (myPlayer ? myPlayer.bet : 0));

    if (canCheck) {
        showFoldConfirm();
    } else {
        sendAction('fold');
    }
}

function showFoldConfirm() {
    const existing = document.getElementById('foldConfirmModal');
    if (existing) {
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'foldConfirmModal';
    modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        z-index: 999; display: flex; align-items: center; justify-content: center;
    `;
    modal.innerHTML = `
        <div style="
            background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 16px; padding: 28px 24px; width: 80%; max-width: 320px;
            border: 1px solid rgba(255,255,255,0.15); text-align: center;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8);
        ">
            <div style="font-size:18px; font-weight:700; color:#fff; margin-bottom:8px;">本当にフォールドしますか？</div>
            <div style="font-size:13px; color:#9ca3af; margin-bottom:24px;">チェックできます。フォールドしなくても大丈夫です。</div>
            <div style="display:flex; gap:12px;">
                <button onclick="document.getElementById('foldConfirmModal').remove()" style="
                    flex:1; padding:14px; background:rgba(255,255,255,0.1);
                    border:1px solid rgba(255,255,255,0.2); border-radius:10px;
                    color:#fff; font-size:15px; font-weight:600; margin:0;
                ">キャンセル</button>
                <button onclick="document.getElementById('foldConfirmModal').remove(); sendAction('fold')" style="
                    flex:1; padding:14px; background:linear-gradient(145deg,#ef4444,#dc2626);
                    border:none; border-radius:10px; color:#fff;
                    font-size:15px; font-weight:700; margin:0;
                ">フォールド</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function sendSliderRaise() {
    const slider = document.getElementById('betSlider');
    if (!slider) {
        return;
    }

    const amount = parseInt(slider.value, 10);
    sendAction('bet', amount);
}

function readyNextHand() {
    if (appState.isHost) {
        appState.nextHandReady.add(appState.myPlayerId);
        checkAllReady();
    } else {
        appState.rtc.send({ type: 'ready_next_hand', playerId: appState.myPlayerId });
    }
}

function nextHand() {
    appState.nextHandReady.clear();
    startNextHand();
}

function toggleRanking() {
    const modal = document.getElementById('rankingModal');
    if (modal) {
        modal.classList.toggle('show');
    }
}

function closeRankingIfOutside(event) {
    if (event.target.id === 'rankingModal') {
        toggleRanking();
    }
}

export function registerWindowActions() {
    window.confirmFold = confirmFold;
    window.showFoldConfirm = showFoldConfirm;
    window.sendAction = sendAction;
    window.sendSliderRaise = sendSliderRaise;
    window.readyNextHand = readyNextHand;
    window.restartGame = restartGame;
    window.nextHand = nextHand;
    window.toggleRanking = toggleRanking;
    window.closeRankingIfOutside = closeRankingIfOutside;
}
