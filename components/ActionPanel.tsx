'use client';

import { useState, useRef, useEffect } from 'react';
import type { Player, PokerState } from '@/types';
import { useGame } from '@/context/GameContext';
import { formatStack } from './PlayerSeat';

function getCardColor(suit: string) {
  if (suit === '♠') return 'black';
  if (suit === '♥') return 'red';
  if (suit === '♦') return 'blue';
  if (suit === '♣') return 'green';
  return 'black';
}

interface Props {
  state: PokerState;
  myPlayer: Player | undefined;
  myIndex: number;
  onToggleRanking: () => void;
  hideActions?: boolean;
  stackUnit?: 'chips' | 'bb';
}

export default function ActionPanel({
  state,
  myPlayer,
  myIndex,
  onToggleRanking,
  hideActions = false,
  stackUnit = 'chips',
}: Props) {
  const { sendAction } = useGame();
  const isTurn = myIndex === state.turnIndex;
  const bb = state.bb;

  const minRaise = state.currentBet === 0 ? bb : state.currentBet;
  const minTotalBet = state.currentBet + minRaise;
  const minBetAmount = myPlayer ? minTotalBet - (myPlayer.bet ?? 0) : 0;
  const maxBetAmount = myPlayer?.chips ?? 0;
  const showSlider = isTurn && myPlayer && !myPlayer.folded && minBetAmount <= maxBetAmount;

  const [betAmount, setBetAmount] = useState(minBetAmount);
  const sliderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isTurn) setBetAmount(minBetAmount);
  }, [isTurn, minBetAmount]);

  const [showFoldConfirm, setShowFoldConfirm] = useState(false);

  // アクションタイマー カウントダウン
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  useEffect(() => {
    const deadline = state.turnDeadlineAt;
    if (!deadline || !isTurn || myPlayer?.folded) {
      setTimeLeft(null);
      return;
    }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    update();
    const id = setInterval(update, 300);
    return () => clearInterval(id);
  }, [state.turnDeadlineAt, isTurn, myPlayer?.folded]);

  function handleFold() {
    const canCheck = state.currentBet === 0 || state.currentBet === (myPlayer?.bet ?? 0);
    if (canCheck) {
      setShowFoldConfirm(true);
    } else {
      sendAction('fold');
    }
  }

  function handleCheck() { sendAction('check'); }
  function handleCall() { sendAction('call'); }
  function handleBet() { sendAction('bet', betAmount); }

  const halfPot = Math.max(minBetAmount, Math.floor((state.pot + state.currentBet) / 2));
  const fullPot = Math.max(minBetAmount, state.pot + state.currentBet);
  const sliderPct =
    maxBetAmount > minBetAmount
      ? ((betAmount - minBetAmount) / (maxBetAmount - minBetAmount)) * 100
      : 0;

  const isCheck = state.currentBet === 0 || state.currentBet === (myPlayer?.bet ?? 0);
  const callAmount = state.currentBet - (myPlayer?.bet ?? 0);
  const buttonText = state.currentBet === 0 ? 'Bet' : 'Raise';
  const totalBetNeeded = minTotalBet - (myPlayer?.bet ?? 0);

  const myChips = myPlayer?.chips ?? 0;
  const isShortStack = myChips > 0 && myChips < bb * 10;

  // タイマーバーの色
  const timerColor =
    timeLeft !== null && timeLeft <= 5
      ? '#ef4444'
      : timeLeft !== null && timeLeft <= 10
      ? '#f59e0b'
      : '#22c55e';

  return (
    <>
      {/* フォールド確認モーダル */}
      {showFoldConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
              borderRadius: '16px',
              padding: '28px 24px',
              width: '80%',
              maxWidth: '320px',
              border: '1px solid rgba(255,255,255,0.15)',
              textAlign: 'center',
              boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
              本当にフォールドしますか？
            </div>
            <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '24px' }}>
              チェックできます。フォールドしなくても大丈夫です。
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowFoldConfirm(false)}
                style={{
                  flex: 1, padding: '14px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: 600, margin: 0,
                }}
              >
                キャンセル
              </button>
              <button
                onClick={() => { setShowFoldConfirm(false); sendAction('fold'); }}
                style={{
                  flex: 1, padding: '14px',
                  background: 'linear-gradient(145deg, #ef4444, #dc2626)',
                  border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: 700, margin: 0,
                }}
              >
                フォールド
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bottom-area">
        {/* アクションタイマーバー（自分のターン時） */}
        {isTurn && timeLeft !== null && !hideActions && myPlayer && !myPlayer.folded && (
          <div
            style={{
              padding: '0 16px',
              marginBottom: '4px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '4px',
              }}
            >
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>残り時間</span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: timerColor,
                  transition: 'color 0.3s',
                }}
              >
                {timeLeft}秒
              </span>
            </div>
            <div
              style={{
                height: '4px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${(timeLeft / 25) * 100}%`,
                  background: timerColor,
                  borderRadius: '2px',
                  transition: 'width 0.3s linear, background 0.3s',
                }}
              />
            </div>
          </div>
        )}

        {/* ショートスタック警告 */}
        {isShortStack && isTurn && !hideActions && myPlayer && !myPlayer.folded && (
          <div
            style={{
              margin: '0 16px 6px',
              padding: '6px 12px',
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#f87171',
              fontWeight: '600',
              textAlign: 'center',
            }}
          >
            ショートスタック ({(myChips / bb).toFixed(1)}BB)
          </div>
        )}

        {/* ベットスライダー */}
        {!hideActions && showSlider && (
          <div className="slider-area">
            <div className="slider-header">
              <span className="slider-label">BET AMOUNT</span>
              <span className="slider-value">
                {stackUnit === 'bb'
                  ? `${(betAmount / bb).toFixed(1)}BB`
                  : `$${betAmount}`}
              </span>
            </div>
            <div className="slider-wrapper">
              <div className="slider-track" />
              <div className="slider-fill" style={{ width: `${sliderPct}%` }} />
              <input
                ref={sliderRef}
                type="range"
                className="bet-slider"
                min={minBetAmount}
                max={maxBetAmount}
                value={betAmount}
                step={1}
                onChange={(e) => setBetAmount(Number(e.target.value))}
              />
            </div>
            <div className="quick-bets">
              <button
                className={`quick-bet-btn${betAmount === minBetAmount ? ' active' : ''}`}
                onClick={() => setBetAmount(minBetAmount)}
              >
                MIN
              </button>
              <button
                className={`quick-bet-btn${betAmount === Math.min(halfPot, maxBetAmount) ? ' active' : ''}`}
                onClick={() => setBetAmount(Math.min(halfPot, maxBetAmount))}
              >
                1/2
              </button>
              <button
                className={`quick-bet-btn${betAmount === Math.min(fullPot, maxBetAmount) ? ' active' : ''}`}
                onClick={() => setBetAmount(Math.min(fullPot, maxBetAmount))}
              >
                POT
              </button>
              <button
                className={`quick-bet-btn${betAmount === maxBetAmount ? ' active' : ''}`}
                onClick={() => setBetAmount(maxBetAmount)}
              >
                ALL-IN
              </button>
            </div>
          </div>
        )}

        <div className="bottom-row">
          {/* 自分のスタック */}
          <div className="my-stack-area">
            <div className={`my-stack-box${isTurn && myPlayer && !myPlayer.folded ? ' is-my-turn' : ''}`}>
              <div className="my-stack-label">Stack</div>
              <div
                className="my-stack-value"
                style={isShortStack ? { color: '#ef4444' } : undefined}
              >
                {formatStack(myChips, bb, stackUnit)}
              </div>
              {myPlayer && (myPlayer.bet ?? 0) > 0 && (
                <div className="my-bet-amount">
                  Bet: {formatStack(myPlayer.bet ?? 0, bb, stackUnit)}
                </div>
              )}
            </div>
          </div>

          {/* 手札 */}
          <div className="my-hand-area">
            <div className="my-hand-label">Your Hand</div>
            <div className="my-cards">
              {myPlayer?.hand?.map((card, i) => (
                <div key={i} className={`my-card ${getCardColor(card.suit)}`}>
                  <span className="card-value">{card.rank}</span>
                  <span className="card-suit">{card.suit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* アクションボタン（横並び） */}
        {!hideActions && isTurn && myPlayer && !myPlayer.folded && (
          <div className="action-row">
            <button className="action-btn btn-fold" onClick={handleFold}>
              Fold
            </button>
            {isCheck ? (
              <button className="action-btn btn-call" onClick={handleCheck}>
                Check
              </button>
            ) : (
              <button className="action-btn btn-call" onClick={handleCall}>
                Call
                <span className="btn-amount">
                  {stackUnit === 'bb'
                    ? `${(callAmount / bb).toFixed(1)}BB`
                    : `$${callAmount}`}
                </span>
              </button>
            )}
            {totalBetNeeded <= maxBetAmount && (
              <button className="action-btn btn-raise" onClick={handleBet}>
                {buttonText}
                <span className="btn-amount">
                  {stackUnit === 'bb'
                    ? `${(betAmount / bb).toFixed(1)}BB`
                    : `$${betAmount}`}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ランキングボタン */}
      <button className="ranking-btn" onClick={onToggleRanking}>
        🏆
      </button>
    </>
  );
}
