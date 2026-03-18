'use client';

import type { Player } from '@/types';

interface Props {
  player: Player;
  isActive: boolean;
  isDealer: boolean;
  x: number;
  y: number;
}

export default function PlayerSeat({
  player,
  isActive,
  isDealer,
  x,
  y,
}: Props) {
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
      <div className="opponent-box">
        <span className="dealer-chip">D</span>
        <span className="opponent-name">{player.name}</span>
        <span className="opponent-stack">${player.chips}</span>
        {player.folded ? (
          <span className="opponent-action opponent-action-fold">FOLD</span>
        ) : player.lastAction ? (
          <span className="opponent-action">{player.lastAction}</span>
        ) : null}
      </div>
      <div className="opponent-cards">
        <div className={`mini-card${player.folded ? ' folded' : ''}`} />
        <div className={`mini-card${player.folded ? ' folded' : ''}`} />
      </div>
      {player.bet && player.bet > 0 ? (
        <div className="bet-badge">${player.bet}</div>
      ) : null}
    </div>
  );
}
