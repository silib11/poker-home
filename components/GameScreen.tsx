'use client';

import { useState, useEffect } from 'react';
import { useGame } from '@/context/GameContext';
import { getOpponentPositions } from '@/lib/playerPositions';
import CommunityCards from './CommunityCards';
import PlayerSeat from './PlayerSeat';
import ActionPanel from './ActionPanel';
import RankingModal from './RankingModal';
import WinnerView from './WinnerView';

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

export default function GameScreen() {
  const { pokerState, myPlayerId, isHost, sb, bb, updateBlinds, leaveGame, requestReentry, buyin } =
    useGame();
  const [showRanking, setShowRanking] = useState(false);
  const [showHostMenu, setShowHostMenu] = useState(false);
  const [showPlayerMenu, setShowPlayerMenu] = useState(false);
  const [sbInput, setSbInput] = useState(sb);
  const [bbInput, setBbInput] = useState(bb);
  const [leaving, setLeaving] = useState(false);
  const { width, height } = useWindowSize();

  if (!pokerState) return null;

  const state = pokerState;
  const myIndex = state.players.findIndex((p) => p.id === myPlayerId);
  const myPlayer = myIndex >= 0 ? state.players[myIndex] : undefined;

  async function handleLeaveGame() {
    setShowPlayerMenu(false);
    if (!confirm('途中退席しますか？現在のチップ数で精算されます。')) return;
    setLeaving(true);
    try {
      await leaveGame();
    } finally {
      setLeaving(false);
    }
  }

  // 自分がゲームに参加していない場合（bust 後 or リエントリー待ち / 途中参加待ち）
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

  // WINNER / SHOWDOWN フェーズは専用ビューを表示
  if (state.phase === 'WINNER' || state.phase === 'SHOWDOWN') {
    return (
      <div id="game-screen" className="playing">
        <div id="game-area" style={{ marginTop: 0, height: 'auto' }}>
          <WinnerView state={state} />
        </div>
      </div>
    );
  }

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
      <div id="game-area">
        <div className="game-container">
          <div className="table-area">
            {/* テーブル中央: ポット + コミュニティカード */}
            <CommunityCards
              community={state.community}
              pot={state.pot}
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
                  />
                );
              })}
            </div>
          </div>

          {/* 自分のエリア（スタック + 手札 + アクション） */}
          <ActionPanel
            state={state}
            myPlayer={myPlayer}
            myIndex={myIndex}
            onToggleRanking={() => setShowRanking((v) => !v)}
          />

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

      {/* プレイヤーメニューボタン（非ホスト用） */}
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
          }}
          onClick={() => setShowPlayerMenu(true)}
        >
          ⚙️
        </button>
      )}

      {/* プレイヤーメニューモーダル（非ホスト用） */}
      {showPlayerMenu && (
        <div
          className="modal"
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPlayerMenu(false);
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3>メニュー</h3>
              <button
                className="close-btn"
                onClick={() => setShowPlayerMenu(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <button
                disabled={leaving}
                onClick={handleLeaveGame}
                className="modal-btn"
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  color: leaving ? 'rgba(255,255,255,0.4)' : '#f87171',
                  width: '100%',
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
