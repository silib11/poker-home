'use client';

import type { Card } from '@/types';

function getCardColor(suit: string) {
  if (suit === '♠') return 'black';
  if (suit === '♥') return 'red';
  if (suit === '♦') return 'blue';
  if (suit === '♣') return 'green';
  return 'black';
}

function CardEl({ card }: { card: Card }) {
  const color = getCardColor(card.suit);
  return (
    <div className={`card ${color}`}>
      <span className="card-value">{card.rank}</span>
      <span className="card-suit">{card.suit}</span>
    </div>
  );
}

interface Props {
  community: Card[];
  pot: number;
  visibleCount?: number;
  bb?: number;
  stackUnit?: 'chips' | 'bb';
}

export default function CommunityCards({ community, pot, visibleCount, bb = 20, stackUnit = 'chips' }: Props) {
  const displayCount = Math.min(
    visibleCount !== undefined ? visibleCount : community.length,
    community.length
  );
  const hidden = 5 - displayCount;

  return (
    <div className="poker-table">
      <div className="pot-display">
        <div className="pot-label">Pot</div>
        <div className="pot-amount">
          {stackUnit === 'bb' ? `${(pot / bb).toFixed(1)}BB` : `$${pot}`}
        </div>
      </div>
      <div className="community-cards">
        {community.slice(0, displayCount).map((card, i) => (
          <CardEl key={i} card={card} />
        ))}
        {Array.from({ length: hidden }).map((_, i) => (
          <div key={`hidden-${i}`} className="card hidden" />
        ))}
      </div>
    </div>
  );
}
