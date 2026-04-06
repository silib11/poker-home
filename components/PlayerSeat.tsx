'use client';

import { useState } from 'react';
import type { Player, Card } from '@/types';

interface Props {
  player: Player;
  isActive: boolean;
  isDealer: boolean;
  x: number;
  y: number;
  revealedHand?: Card[];
  bb?: number;
  stackUnit?: 'chips' | 'bb';
}

function suitColor(suit: string) {
  return suit === '♥' || suit === '♦' ? '#e74c3c' : '#111111';
}

export function formatStack(chips: number, bb: number, unit: 'chips' | 'bb'): string {
  if (unit === 'bb') {
    return `${(chips / bb).toFixed(1)}BB`;
  }
  return chips.toLocaleString();
}

function avatarColor(name: string): string {
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return `hsl(${hue}, 55%, 38%)`;
}

export default function PlayerSeat({
  player,
  isActive,
  isDealer,
  x,
  y,
  revealedHand,
  bb = 20,
  stackUnit = 'chips',
}: Props) {
  const [showName, setShowName] = useState(false);
  const isShortStack = player.chips > 0 && player.chips < bb * 10;
  const initial = player.name.charAt(0).toUpperCase();

  const classes = [
    'opponent',
    isActive ? 'is-active' : '',
    isDealer ? 'is-dealer' : '',
    player.bet && player.bet > 0 ? 'has-bet' : '',
    player.folded ? 'folded' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={{ left: x, top: y }}>
      <div className="opponent-box" onClick={() => setShowName((v) => !v)}>
        <span className="dealer-chip">D</span>
        {showName && (
          <div className="opponent-name-popup">{player.name}</div>
        )}
        <div
          className="opponent-avatar"
          style={{ background: avatarColor(player.name) }}
        >
          {initial}
        </div>
        <span
          className="opponent-stack"
          style={isShortStack ? { color: '#ef4444' } : undefined}
        >
          {formatStack(player.chips, bb, stackUnit)}
        </span>
        {player.folded ? (
          <span className="opponent-action opponent-action-fold">FOLD</span>
        ) : player.lastAction ? (
          <span className="opponent-action">{player.lastAction}</span>
        ) : null}
      </div>
      <div className="opponent-cards">
        {revealedHand && revealedHand.length > 0 ? (
          revealedHand.map((card, i) => (
            <div
              key={i}
              style={{
                width: '28px',
                height: '40px',
                background: '#fff',
                borderRadius: '4px',
                boxShadow: '0 3px 8px rgba(0,0,0,0.6)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1px',
                color: suitColor(card.suit),
                fontSize: '11px',
                fontWeight: '700',
                lineHeight: 1,
              }}
            >
              <span>{card.rank}</span>
              <span style={{ fontSize: '10px' }}>{card.suit}</span>
            </div>
          ))
        ) : (
          <>
            <div className={`mini-card${player.folded ? ' folded' : ''}`} />
            <div className={`mini-card${player.folded ? ' folded' : ''}`} />
          </>
        )}
      </div>
      {player.bet && player.bet > 0 ? (
        <div className="bet-badge">{formatStack(player.bet, bb, stackUnit)}</div>
      ) : null}
    </div>
  );
}
