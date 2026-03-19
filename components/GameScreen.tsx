'use client';

import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { getOpponentPositions } from '@/lib/playerPositions';
import { useWindowSize } from '@/hooks/useWindowSize';
import { useStackUnit } from '@/hooks/useStackUnit';
import { usePhaseAnimation } from '@/hooks/usePhaseAnimation';
import BlindLevelWidget from './BlindLevelWidget';
import CommunityCards from './CommunityCards';
import PlayerSeat from './PlayerSeat';
import ActionPanel from './ActionPanel';
import RankingModal from './RankingModal';
import WinnerView from './WinnerView';
import ShowdownView from './ShowdownView';
import TournamentResultModal from './TournamentResultModal';

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
    tournamentConfig,
    tournamentProgress,
    spectatorIds,
    rankList,
    showTournamentResult,
    dismissTournamentResult,
  } = useGame();

  const [showRanking, setShowRanking] = useState(false);
  const [showHostMenu, setShowHostMenu] = useState(false);
  const [showGuestMenu, setShowGuestMenu] = useState(false);
  const [sbInput, setSbInput] = useState(sb);
  const [bbInput, setBbInput] = useState(bb);
  const [leaving, setLeaving] = useState(false);
  const { width, height } = useWindowSize();
  const { stackUnit, toggleStackUnit } = useStackUnit();
  const {
    visibleCommunityCount,
    phaseBanner,
    showTableHands,
    showShowdownHands,
    showShowdownResult,
    isAnimating,
  } = usePhaseAnimation(pokerState);

  if (!pokerState) return null;

  const state = pokerState;
  const myIndex = state.players.findIndex((p) => p.id === myPlayerId);
  const myPlayer = myIndex >= 0 ? state.players[myIndex] : undefined;
  const isSpectating = spectatorIds.includes(myPlayerId ?? '');
  const isTournament = !!tournamentConfig?.enabled;

  async function handleLeaveGame() {
    if (!confirm('途中退席しますか？現在のチップ数で精算されます。')) return;
    setLeaving(true);
    try { await leaveGame(); } finally { setLeaving(false); }
  }

  function handleUpdateBlinds() {
    updateBlinds(sbInput, bbInput);
    setShowHostMenu(false);
  }

  // ---- 観戦Mode ----
  if (isSpectating || (!myPlayer && !isSpectating && state.spectatorIds?.includes(myPlayerId ?? ''))) {
    const positions = width > 0 ? getOpponentPositions(state.players.length, width, height) : [];
    const canReentry = isTournament &&
      tournamentProgress !== null &&
      tournamentConfig !== null &&
      tournamentProgress.currentLevel < tournamentConfig.reentryUntilLevel;

    return (
      <div id="game-screen" className="playing">
        {isTournament && (
          <BlindLevelWidget
            tournamentConfig={tournamentConfig}
            tournamentProgress={tournamentProgress}
            handNumber={state.handNumber}
            compact={width <= 480}
          />
        )}

        {/* SPECTATING バッジ */}
        <div
          style={{
            position: 'fixed',
            top: '10px',
            right: '10px',
            background: 'rgba(99,102,241,0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(99,102,241,0.5)',
            borderRadius: '8px',
            padding: '5px 12px',
            fontSize: '11px',
            fontWeight: '700',
            color: '#fff',
            letterSpacing: '1.5px',
            zIndex: 100,
          }}
        >
          SPECTATING
        </div>

        <div id="game-area">
          <div className="game-container">
            <div className="table-area">
              <CommunityCards
                community={state.community}
                pot={state.pot}
                visibleCount={state.community.length}
              />
              <div className="players-container">
                {state.players.map((player, index) => {
                  const posIdx = index > 0 ? index - 1 : 0;
                  if (posIdx >= positions.length) return null;
                  const position = positions[posIdx];
                  return (
                    <PlayerSeat
                      key={player.id}
                      player={player}
                      isActive={index === state.turnIndex}
                      isDealer={index === state.dealerIndex}
                      x={position.x}
                      y={position.y}
                      revealedHand={!player.folded && player.hand?.length ? player.hand : undefined}
                      bb={bb}
                      stackUnit={stackUnit}
                    />
                  );
                })}
              </div>
            </div>

            {/* 観戦中: スタック情報と手牌エリアのみ表示（アクションなし） */}
            <div className="bottom-area">
              <div className="bottom-row">
                <div className="my-stack-area">
                  <div className="my-stack-box">
                    <div className="my-stack-label">観戦中</div>
                    <div className="my-stack-value" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
                      {state.phase}
                    </div>
                  </div>
                </div>
                <div className="my-hand-area">
                  <div className="my-hand-label">Hand #{state.handNumber ?? 0}</div>
                  <div className="my-cards" style={{ justifyContent: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', padding: '8px 0' }}>
                      カードは配られていません
                    </div>
                  </div>
                </div>
                <div className="action-area">
                  {canReentry && (
                    <button
                      onClick={requestReentry}
                      style={{
                        padding: '12px 16px',
                        background: 'linear-gradient(145deg, #f59e0b, #d97706)',
                        border: 'none',
                        borderRadius: '10px',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        marginTop: '4px',
                      }}
                    >
                      リエントリー
                      <br />
                      <span style={{ fontSize: '11px', fontWeight: '400' }}>({buyin}チップ)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* スタック切り替えボタン */}
        <button
          onClick={toggleStackUnit}
          style={{
            position: 'fixed',
            bottom: '90px',
            right: '12px',
            padding: '6px 10px',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer',
            zIndex: 100,
          }}
        >
          {stackUnit === 'chips' ? 'chips→BB' : 'BB→chips'}
        </button>

        {showTournamentResult && (
          <TournamentResultModal rankList={rankList} onClose={dismissTournamentResult} />
        )}
      </div>
    );
  }

  // ---- バスト後の通常（リエントリー待ち）ビュー ----
  if (!myPlayer) {
    return (
      <div id="game-screen" className="playing">
        {isTournament && (
          <BlindLevelWidget
            tournamentConfig={tournamentConfig}
            tournamentProgress={tournamentProgress}
            handNumber={state.handNumber}
            compact={width <= 480}
          />
        )}
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
        {showTournamentResult && (
          <TournamentResultModal rankList={rankList} onClose={dismissTournamentResult} />
        )}
      </div>
    );
  }

  // ---- WINNER フェーズ ----
  if (state.phase === 'WINNER') {
    return (
      <div id="game-screen" className="playing">
        {isTournament && (
          <BlindLevelWidget
            tournamentConfig={tournamentConfig}
            tournamentProgress={tournamentProgress}
            handNumber={state.handNumber}
            compact={width <= 480}
          />
        )}
        <div id="game-area" style={{ marginTop: 0, height: 'auto' }}>
          <WinnerView state={state} />
        </div>
        {showTournamentResult && (
          <TournamentResultModal rankList={rankList} onClose={dismissTournamentResult} />
        )}
      </div>
    );
  }

  // ---- SHOWDOWN フェーズ ----
  if (state.phase === 'SHOWDOWN' && showShowdownHands) {
    return (
      <div id="game-screen" className="playing">
        {isTournament && (
          <BlindLevelWidget
            tournamentConfig={tournamentConfig}
            tournamentProgress={tournamentProgress}
            handNumber={state.handNumber}
            compact={width <= 480}
          />
        )}
        <div id="game-area" style={{ marginTop: 0, height: 'auto' }}>
          <ShowdownView state={state} showHands={showShowdownHands} showResult={showShowdownResult} />
        </div>
        {showTournamentResult && (
          <TournamentResultModal rankList={rankList} onClose={dismissTournamentResult} />
        )}
      </div>
    );
  }

  // ---- 通常ゲーム卓 ----
  const positions = width > 0 ? getOpponentPositions(state.players.length, width, height) : [];

  return (
    <div id="game-screen" className="playing">
      {/* フェーズバナー */}
      {phaseBanner && (
        <div
          style={{
            position: 'fixed', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.72)', zIndex: 500, pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontSize: '56px', fontWeight: '900', color: '#ffd700',
              letterSpacing: '10px',
              textShadow: '0 0 40px rgba(255, 215, 0, 0.9), 0 0 80px rgba(255, 215, 0, 0.4), 2px 2px 6px rgba(0,0,0,0.8)',
            }}
          >
            {phaseBanner}
          </span>
        </div>
      )}

      {/* ブラインドレベルウィジェット（トーナメント時） */}
      {isTournament && (
        <BlindLevelWidget
          tournamentConfig={tournamentConfig}
          tournamentProgress={tournamentProgress}
          handNumber={state.handNumber}
          compact={width <= 480}
        />
      )}

      <div id="game-area">
        <div className="game-container">
          <div className="table-area">
            <CommunityCards
              community={state.community}
              pot={state.pot}
              visibleCount={visibleCommunityCount}
            />
            <div className="players-container">
              {state.players.map((player, index) => {
                if (player.id === myPlayerId) return null;
                const opponentIndex = index > myIndex ? index - 1 : index;
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
                    bb={bb}
                    stackUnit={stackUnit}
                  />
                );
              })}
            </div>
          </div>

          {(!isAnimating || showTableHands) && (
            <ActionPanel
              state={state}
              myPlayer={myPlayer}
              myIndex={myIndex}
              onToggleRanking={() => setShowRanking((v) => !v)}
              hideActions={isAnimating}
              stackUnit={stackUnit}
            />
          )}

          {showRanking && (
            <RankingModal players={state.players} onClose={() => setShowRanking(false)} />
          )}
        </div>
      </div>

      {/* スタック単位切り替えボタン */}
      <button
        onClick={toggleStackUnit}
        style={{
          position: 'fixed',
          bottom: '90px',
          right: '12px',
          padding: '6px 10px',
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '8px',
          color: '#fff',
          fontSize: '11px',
          fontWeight: '600',
          cursor: 'pointer',
          zIndex: 100,
        }}
      >
        {stackUnit === 'chips' ? 'chips→BB' : 'BB→chips'}
      </button>

      {/* ホストメニューボタン */}
      {isHost && (
        <button
          style={{
            position: 'fixed', top: '10px', left: '10px',
            width: '44px', height: '44px',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px',
            color: '#fff', fontSize: '18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, cursor: 'pointer',
          }}
          onClick={() => setShowHostMenu(true)}
        >
          ⚙️
        </button>
      )}

      {/* ゲスト用メニューボタン */}
      {!isHost && (
        <button
          style={{
            position: 'fixed', top: '10px', left: '10px',
            width: '44px', height: '44px',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px',
            color: '#fff', fontSize: '18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, cursor: 'pointer',
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
          onClick={(e) => { if (e.target === e.currentTarget) setShowGuestMenu(false); }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3>メニュー</h3>
              <button className="close-btn" onClick={() => setShowGuestMenu(false)}>×</button>
            </div>
            <div className="modal-body">
              <button
                disabled={leaving}
                onClick={async () => { setShowGuestMenu(false); await handleLeaveGame(); }}
                style={{
                  width: '100%', padding: '14px',
                  background: leaving ? 'rgba(100,100,100,0.3)' : 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.4)', borderRadius: '10px',
                  color: leaving ? 'rgba(255,255,255,0.4)' : '#f87171',
                  fontSize: '15px', fontWeight: '600',
                  cursor: leaving ? 'not-allowed' : 'pointer',
                }}
              >
                {leaving ? '退席中...' : '途中退席'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ホストメニューモーダル */}
      {showHostMenu && (
        <div
          className="modal"
          style={{ display: 'flex' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowHostMenu(false); }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3>ホストメニュー</h3>
              <button className="close-btn" onClick={() => setShowHostMenu(false)}>×</button>
            </div>
            <div className="modal-body">
              {!isTournament && (
                <div className="blinds-section">
                  <h4>ブラインド設定</h4>
                  <div className="input-group">
                    <label>SB</label>
                    <input type="number" value={sbInput} min={5} step={5}
                      onChange={(e) => setSbInput(Number(e.target.value))} />
                  </div>
                  <div className="input-group">
                    <label>BB</label>
                    <input type="number" value={bbInput} min={10} step={10}
                      onChange={(e) => setBbInput(Number(e.target.value))} />
                  </div>
                  <button className="modal-btn" onClick={handleUpdateBlinds}>更新</button>
                </div>
              )}
              {isTournament && (
                <div style={{ padding: '8px 0', color: 'rgba(255,255,255,0.5)', fontSize: '13px', textAlign: 'center' }}>
                  トーナメントMode中のブラインドは<br />自動で管理されています
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* トーナメント結果モーダル */}
      {showTournamentResult && (
        <TournamentResultModal rankList={rankList} onClose={dismissTournamentResult} />
      )}
    </div>
  );
}
