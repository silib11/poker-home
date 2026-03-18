'use client';

import type { Player } from '@/types';

interface Props {
  players: Player[];
  onClose: () => void;
}

export default function RankingModal({ players, onClose }: Props) {
  const sorted = [...players].sort((a, b) => b.chips - a.chips);

  function rankIcon(i: number) {
    if (i === 0) return '🥇';
    if (i === 1) return '🥈';
    if (i === 2) return '🥉';
    return `${i + 1}位`;
  }

  return (
    <div
      className="ranking-modal show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ranking-content" onClick={(e) => e.stopPropagation()}>
        <div className="ranking-header">
          <span className="ranking-title">🏆 Rankings</span>
          <button className="ranking-close" onClick={onClose}>
            ✕
          </button>
        </div>
        {sorted.map((player, i) => (
          <div key={player.id} className="ranking-item">
            <span className="ranking-rank">{rankIcon(i)}</span>
            <span className="ranking-name">{player.name}</span>
            <span className="ranking-chips">${player.chips}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
