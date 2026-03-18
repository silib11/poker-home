'use client';

import type { PokerState, Card } from '@/types';
import { useGame } from '@/context/GameContext';

function getCardColor(suit: string) {
  if (suit === '♠') return 'black';
  if (suit === '♥') return 'red';
  if (suit === '♦') return 'blue';
  if (suit === '♣') return 'green';
  return 'black';
}

function CardEl({ card }: { card: Card }) {
  return (
    <div className={`card ${getCardColor(card.suit)}`}>
      <span className="card-value">{card.rank}</span>
      <span className="card-suit">{card.suit}</span>
    </div>
  );
}

interface Props {
  state: PokerState;
}

export default function WinnerView({ state }: Props) {
  const { myPlayerId, readyNextHand } = useGame();
  const readyCount = state.nextHandReady?.length ?? 0;
  const activePlayers = state.players.filter((p) => p.chips > 0);
  const isReady =
    state.nextHandReady?.includes(myPlayerId ?? '') ?? false;

  if (state.phase === 'SHOWDOWN') {
    return (
      <div
        style={{ textAlign: 'center', margin: '20px 0', paddingBottom: '40px' }}
      >
        <h2>🏆 ショウダウン 🏆</h2>

        {state.potResults && state.potResults.length > 0 ? (
          (() => {
            const groups: Record<string, typeof state.potResults> = {};
            state.potResults!.forEach((r) => {
              if (!groups[r.potType]) groups[r.potType] = [];
              groups[r.potType].push(r);
            });

            return (
              <>
                {groups.main && (
                  <div
                    style={{
                      background: '#1a4d1a',
                      padding: '15px',
                      margin: '15px 0',
                      borderRadius: '8px',
                      border: '2px solid #ffd700',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: '#ffd700',
                      }}
                    >
                      メインポット
                    </div>
                    {groups.main.map((r, i) => (
                      <div key={i}>
                        <div style={{ fontSize: '20px', margin: '5px 0' }}>
                          {r.player.name} 👑
                        </div>
                        <div style={{ fontSize: '16px', margin: '5px 0' }}>
                          {r.handName}
                        </div>
                        <div style={{ fontSize: '18px', margin: '5px 0' }}>
                          獲得:{' '}
                          <span
                            style={{ color: '#00ff00', fontWeight: 'bold' }}
                          >
                            +{r.amount}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {Object.keys(groups)
                  .filter((k) => k !== 'main')
                  .map((potType, idx) => (
                    <div
                      key={potType}
                      style={{
                        background: '#2a4d2a',
                        padding: '15px',
                        margin: '15px 0',
                        borderRadius: '8px',
                        border: '2px solid #88aa88',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '16px',
                          fontWeight: 'bold',
                          color: '#88aa88',
                        }}
                      >
                        サイドポット {idx + 1}
                      </div>
                      {groups[potType]!.map((r, i) => (
                        <div key={i}>
                          <div style={{ fontSize: '18px', margin: '5px 0' }}>
                            {r.player.name}
                          </div>
                          <div style={{ fontSize: '14px', margin: '5px 0' }}>
                            {r.handName}
                          </div>
                          <div style={{ fontSize: '16px', margin: '5px 0' }}>
                            獲得:{' '}
                            <span
                              style={{ color: '#00ff00', fontWeight: 'bold' }}
                            >
                              +{r.amount}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
              </>
            );
          })()
        ) : state.winner ? (
          <div
            style={{
              background: '#1a4d1a',
              padding: '15px',
              margin: '15px 0',
              borderRadius: '8px',
              border: '2px solid #ffd700',
            }}
          >
            <div
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#ffd700',
              }}
            >
              勝者: {state.winner.name}
            </div>
            {state.winningHand && (
              <div style={{ fontSize: '18px', margin: '5px 0' }}>
                {state.winningHand}
              </div>
            )}
            <div style={{ fontSize: '20px', margin: '10px 0' }}>
              獲得:{' '}
              <span style={{ color: '#00ff00', fontWeight: 'bold' }}>
                +{state.winAmount}
              </span>{' '}
              チップ
            </div>
          </div>
        ) : null}

        <h3>ボード</h3>
        <div
          style={{
            display: 'flex',
            gap: '4px',
            justifyContent: 'center',
            margin: '15px 0',
          }}
        >
          {state.community.map((card, i) => (
            <CardEl key={i} card={card} />
          ))}
        </div>

        {state.players
          .filter((p) => !p.folded)
          .map((player) => {
            const wonPot = state.potResults?.find(
              (r) => r.player.id === player.id
            );
            const isWinner = !!wonPot;
            return (
              <div
                key={player.id}
                style={{
                  background: isWinner ? '#1a4d1a' : '#333',
                  padding: '15px',
                  margin: '10px 0',
                  borderRadius: '8px',
                  border: isWinner ? '2px solid #ffd700' : 'none',
                }}
              >
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                  {player.name} {isWinner ? '👑' : ''}
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '4px',
                    justifyContent: 'center',
                    margin: '10px 0',
                  }}
                >
                  {player.hand?.map((card, i) => (
                    <CardEl key={i} card={card} />
                  ))}
                </div>
                <div>チップ: {player.chips}</div>
              </div>
            );
          })}

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

  // WINNER phase
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
