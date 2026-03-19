'use client';

import type { PokerState } from '@/types';
import { useGame } from '@/context/GameContext';

interface Props {
  state: PokerState;
}

export default function WinnerView({ state }: Props) {
  const { myPlayerId, readyNextHand } = useGame();
  const readyCount = state.nextHandReady?.length ?? 0;
  const activePlayers = state.players.filter((p) => p.chips > 0);
  const isReady = state.nextHandReady?.includes(myPlayerId ?? '') ?? false;

  return (
    <div
      style={{ textAlign: 'center', margin: '20px 0', paddingBottom: '40px' }}
    >
      <h2>🏆 勝者決定 🏆</h2>
      {state.winner && (
        <>
          <div
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: '#ffd700',
              margin: '20px 0',
            }}
          >
            {state.winner.name}
          </div>
          <div style={{ fontSize: '20px', margin: '10px 0' }}>
            獲得:{' '}
            <span style={{ color: '#00ff00', fontWeight: 'bold' }}>
              +{state.winAmount}
            </span>{' '}
            チップ
          </div>
          <div style={{ fontSize: '16px', color: '#888', margin: '10px 0' }}>
            現在のチップ: {state.winner.chips}
          </div>
        </>
      )}
      <div style={{ margin: '40px 0' }}>
        <div
          style={{ fontSize: '14px', color: '#aaa', margin: '10px 0' }}
        >
          準備完了: {readyCount}/{activePlayers.length}
        </div>
        {isReady ? (
          <button
            disabled
            style={{
              width: '80%',
              padding: '20px',
              fontSize: '18px',
              background: '#555',
              color: '#aaa',
            }}
          >
            準備完了 ✓
          </button>
        ) : (
          <button
            onClick={readyNextHand}
            style={{ width: '80%', padding: '20px', fontSize: '18px' }}
          >
            次のハンドへ
          </button>
        )}
      </div>
    </div>
  );
}
