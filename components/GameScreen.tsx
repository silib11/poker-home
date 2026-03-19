'use client';

import { useState, useEffect, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { getOpponentPositions } from '@/lib/playerPositions';
import CommunityCards from './CommunityCards';
import PlayerSeat from './PlayerSeat';
import ActionPanel from './ActionPanel';
import RankingModal from './RankingModal';
import WinnerView from './WinnerView';
import ShowdownView from './ShowdownView';

function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    function update() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return size;
}

// フェーズの順序とコミュニティカード枚数マップ
const PHASE_ORDER = ['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];
const COMM_COUNT: Record<string, number> = {
  FLOP: 3,
  TURN: 4,
  RIVER: 5,
  SHOWDOWN: 5,
};

// バナーに表示するフェーズ名
const PHASE_LABEL: Record<string, string> = {
  FLOP: 'FLOP',
  TURN: 'TURN',
  RIVER: 'RIVER',
  SHOWDOWN: 'SHOWDOWN',
};

export default function GameScreen() {
  const {
    pokerState,
    myPlayerId,
    isHost,
    sb,
    bb,
    updateBlinds,
    leaveGame,
    requestReentry,
    buyin,
  } = useGame();
  const [showRanking, setShowRanking] = useState(false);
  const [showHostMenu, setShowHostMenu] = useState(false);
  const [showGuestMenu, setShowGuestMenu] = useState(false);
  const [sbInput, setSbInput] = useState(sb);
  const [bbInput, setBbInput] = useState(bb);
  const [leaving, setLeaving] = useState(false);
  const { width, height } = useWindowSize();

  // UI用フェーズ演出ステート
  const [visibleCommunityCount, setVisibleCommunityCount] = useState(0);
  const [phaseBanner, setPhaseBanner] = useState<string | null>(null);
  const [showTableHands, setShowTableHands] = useState(false);
  const [showShowdownHands, setShowShowdownHands] = useState(false);
  const [showShowdownResult, setShowShowdownResult] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const animTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevPhaseRef = useRef<string>('PREFLOP');
  // 接続直後の初回ステート受信フラグ（アニメーションをスキップする）
  const isInitialRef = useRef(true);

  // フェーズ変化検知 → アニメーションキューを組み立てて実行
  useEffect(() => {
    if (!pokerState) return;
    const newPhase = pokerState.phase;

    // 接続直後の初回ステート: アニメーションなしで即時表示
    if (isInitialRef.current) {
      isInitialRef.current = false;
      setVisibleCommunityCount(pokerState.community.length);
      prevPhaseRef.current = newPhase;
      if (newPhase === 'SHOWDOWN') {
        setShowShowdownHands(true);
        setShowShowdownResult(true);
      }
      setIsAnimating(false);
      return;
    }

    // 新しいハンド開始（PREFLOP + community なし）→ ビジュアルリセット
    if (newPhase === 'PREFLOP' && pokerState.community.length === 0) {
      animTimersRef.current.forEach(clearTimeout);
      animTimersRef.current = [];
      setVisibleCommunityCount(0);
      setPhaseBanner(null);
      setShowTableHands(false);
      setShowShowdownHands(false);
      setShowShowdownResult(false);
      setIsAnimating(false);
      prevPhaseRef.current = 'PREFLOP';
      return;
    }

    const prevPhase = prevPhaseRef.current;
    if (newPhase === prevPhase) return;

    prevPhaseRef.current = newPhase;

    // WINNER フェーズ（フォールド決着）: アニメーション不要、即時表示
    if (newPhase === 'WINNER') {
      animTimersRef.current.forEach(clearTimeout);
      animTimersRef.current = [];
      setIsAnimating(false);
      return;
    }

    // アニメーションキューを組み立てる
    const fromIdx = PHASE_ORDER.indexOf(prevPhase);
    const toIdx = PHASE_ORDER.indexOf(newPhase);
    if (fromIdx === -1 || toIdx === -1 || toIdx <= fromIdx) return;

    // 前のフェーズから新しいフェーズまでの中間フェーズをすべて列挙
    // (例: PREFLOP→SHOWDOWN なら [FLOP, TURN, RIVER, SHOWDOWN])
    const phases = PHASE_ORDER.slice(fromIdx + 1, toIdx + 1);

    animTimersRef.current.forEach(clearTimeout);
    animTimersRef.current = [];
    setIsAnimating(true);

    const timers: ReturnType<typeof setTimeout>[] = [];
    let delay = 0;

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const isLast = i === phases.length - 1;

      if (phase === 'FLOP' || phase === 'TURN' || phase === 'RIVER') {
        // バナーを表示（0.5秒）
        const d1 = delay;
        timers.push(setTimeout(() => setPhaseBanner(PHASE_LABEL[phase]), d1));
        delay += 500;

        // バナーを消してカードを公開
        const count = COMM_COUNT[phase];
        const d2 = delay;
        if (isLast) {
          // このフェーズが最後 → アクションを再開
          timers.push(
            setTimeout(() => {
              setPhaseBanner(null);
              setVisibleCommunityCount(count);
              setIsAnimating(false);
            }, d2)
          );
        } else {
          timers.push(
            setTimeout(() => {
              setPhaseBanner(null);
              setVisibleCommunityCount(count);
            }, d2)
          );
          // 次のフェーズバナーまでカードを見せる時間（1.5秒）
          delay += 1500;
        }
      } else if (phase === 'SHOWDOWN') {
        // SHOWDOWN バナーを表示（0.5秒）
        const d3 = delay;
        timers.push(
          setTimeout(() => setPhaseBanner(PHASE_LABEL['SHOWDOWN']), d3)
        );
        delay += 500;

        // バナーを消してテーブル上で手札を公開（1.5秒）
        const d4 = delay;
        timers.push(
          setTimeout(() => {
            setPhaseBanner(null);
            setShowTableHands(true);
          }, d4)
        );
        delay += 1500;

        // ShowdownView（結果ページ）へ遷移
        const d5 = delay;
        timers.push(
          setTimeout(() => {
            setShowTableHands(false);
            setShowShowdownHands(true);
            setShowShowdownResult(true);
            setIsAnimating(false);
          }, d5)
        );
      }
    }

    animTimersRef.current = timers;
  }, [pokerState?.phase, pokerState?.community?.length]);

  // アンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      animTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  if (!pokerState) return null;

  const state = pokerState;
  const myIndex = state.players.findIndex((p) => p.id === myPlayerId);
  const myPlayer = myIndex >= 0 ? state.players[myIndex] : undefined;

  async function handleLeaveGame() {
    if (!confirm('途中退席しますか？現在のチップ数で精算されます。')) return;
    setLeaving(true);
    try {
      await leaveGame();
    } finally {
      setLeaving(false);
    }
  }

  // バスト後・途中参加待ちのスペクテーター表示
  if (!myPlayer) {
    return (
      <div id="game-screen" className="playing">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '16px',
            padding: '24px',
          }}
        >
          <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
            次のハンドから参加できます
          </div>
          <button
            onClick={requestReentry}
            style={{
              padding: '14px 32px',
              background: 'linear-gradient(145deg, #f59e0b, #d97706)',
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '16px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            参加リクエスト ({buyin} チップ追加)
          </button>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
            次のハンド開始時に自動で追加されます
          </div>
        </div>
      </div>
    );
  }

  // WINNER フェーズ（フォールド決着）: 専用ビュー
  if (state.phase === 'WINNER') {
    return (
      <div id="game-screen" className="playing">
        <div id="game-area" style={{ marginTop: 0, height: 'auto' }}>
          <WinnerView state={state} />
        </div>
      </div>
    );
  }

  // SHOWDOWN フェーズ: 手札 or 結果が表示可能になったら ShowdownView へ切り替え
  if (state.phase === 'SHOWDOWN' && showShowdownHands) {
    return (
      <div id="game-screen" className="playing">
        <div id="game-area" style={{ marginTop: 0, height: 'auto' }}>
          <ShowdownView
            state={state}
            showHands={showShowdownHands}
            showResult={showShowdownResult}
          />
        </div>
      </div>
    );
  }

  // 通常のゲーム卓表示（フェーズアニメーション中も含む）
  const positions =
    width > 0
      ? getOpponentPositions(state.players.length, width, height)
      : [];

  function handleUpdateBlinds() {
    updateBlinds(sbInput, bbInput);
    setShowHostMenu(false);
  }

  return (
    <div id="game-screen" className="playing">
      {/* フェーズバナー（全画面オーバーレイ） */}
      {phaseBanner && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.72)',
            zIndex: 500,
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontSize: '56px',
              fontWeight: '900',
              color: '#ffd700',
              letterSpacing: '10px',
              textShadow:
                '0 0 40px rgba(255, 215, 0, 0.9), 0 0 80px rgba(255, 215, 0, 0.4), 2px 2px 6px rgba(0,0,0,0.8)',
            }}
          >
            {phaseBanner}
          </span>
        </div>
      )}

      <div id="game-area">
        <div className="game-container">
          <div className="table-area">
            {/* テーブル中央: ポット + コミュニティカード */}
            <CommunityCards
              community={state.community}
              pot={state.pot}
              visibleCount={visibleCommunityCount}
            />

            {/* 相手プレイヤー */}
            <div className="players-container">
              {state.players.map((player, index) => {
                if (player.id === myPlayerId) return null;

                const opponentIndex =
                  index > myIndex ? index - 1 : index;
                if (opponentIndex >= positions.length) return null;

                const position = positions[opponentIndex];
                return (
                  <PlayerSeat
                    key={player.id}
                    player={player}
                    isActive={index === state.turnIndex}
                    isDealer={index === state.dealerIndex}
                    x={position.x}
                    y={position.y}
                    revealedHand={
                      showTableHands && !player.folded && player.hand?.length
                        ? player.hand
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>

          {/* アニメーション中はアクションパネルを非表示 */}
          {!isAnimating && (
            <ActionPanel
              state={state}
              myPlayer={myPlayer}
              myIndex={myIndex}
              onToggleRanking={() => setShowRanking((v) => !v)}
            />
          )}

          {/* ランキングモーダル */}
          {showRanking && (
            <RankingModal
              players={state.players}
              onClose={() => setShowRanking(false)}
            />
          )}
        </div>
      </div>

      {/* ホストメニューボタン（ゲーム中） */}
      {isHost && (
        <button
          style={{
            position: 'fixed',
            top: '10px',
            left: '10px',
            width: '44px',
            height: '44px',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '12px',
            color: '#fff',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => setShowHostMenu(true)}
        >
          ⚙️
        </button>
      )}

      {/* ゲスト用メニューボタン（非ホスト用） */}
      {!isHost && (
        <button
          style={{
            position: 'fixed',
            top: '10px',
            left: '10px',
            width: '44px',
            height: '44px',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '12px',
            color: '#fff',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            cursor: 'pointer',
          }}
          onClick={() => setShowGuestMenu(true)}
        >
          ⚙️
        </button>
      )}

      {/* ゲストメニューモーダル */}
      {showGuestMenu && (
        <div
          className="modal"
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGuestMenu(false);
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3>メニュー</h3>
              <button
                className="close-btn"
                onClick={() => setShowGuestMenu(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <button
                disabled={leaving}
                onClick={async () => {
                  setShowGuestMenu(false);
                  await handleLeaveGame();
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: leaving
                    ? 'rgba(100,100,100,0.3)'
                    : 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  borderRadius: '10px',
                  color: leaving ? 'rgba(255,255,255,0.4)' : '#f87171',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: leaving ? 'not-allowed' : 'pointer',
                }}
              >
                {leaving ? '退席中...' : '途中退席'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ホストメニューモーダル（ゲーム中） */}
      {showHostMenu && (
        <div
          className="modal"
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHostMenu(false);
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3>ホストメニュー</h3>
              <button
                className="close-btn"
                onClick={() => setShowHostMenu(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="blinds-section">
                <h4>ブラインド設定</h4>
                <div className="input-group">
                  <label>SB</label>
                  <input
                    type="number"
                    value={sbInput}
                    min={5}
                    step={5}
                    onChange={(e) => setSbInput(Number(e.target.value))}
                  />
                </div>
                <div className="input-group">
                  <label>BB</label>
                  <input
                    type="number"
                    value={bbInput}
                    min={10}
                    step={10}
                    onChange={(e) => setBbInput(Number(e.target.value))}
                  />
                </div>
                <button className="modal-btn" onClick={handleUpdateBlinds}>
                  更新
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
