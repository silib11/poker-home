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

/**
 * サイドポット表示の要否を判定する。
 * 掛け額が少ないプレイヤーがメインポットを勝ち、
 * より多く賭けた他プレイヤーへ別配分が発生した場合のみ表示する。
 */
function shouldDisplaySidePots(state: PokerState): boolean {
  const { potResults, players } = state;
  if (!potResults || potResults.length === 0) return false;
  if (!potResults.some((r) => r.potType !== 'main')) return false;

  const mainWinners = potResults.filter((r) => r.potType === 'main');
  if (mainWinners.length === 0) return false;

  const activePlayers = players.filter((p) => !p.folded);
  if (activePlayers.length === 0) return false;
  const maxBet = Math.max(...activePlayers.map((p) => p.totalBetThisHand ?? 0));

  return mainWinners.some((r) => (r.player.totalBetThisHand ?? 0) < maxBet);
}

interface Props {
  state: PokerState;
  showHands: boolean;
  showResult: boolean;
}

export default function ShowdownView({ state, showHands, showResult }: Props) {
  const { myPlayerId, readyNextHand } = useGame();
  const readyCount = state.nextHandReady?.length ?? 0;
  const activePlayers = state.players.filter((p) => p.chips > 0);
  const isReady = state.nextHandReady?.includes(myPlayerId ?? '') ?? false;
  const showSidePots = showResult && shouldDisplaySidePots(state);

  const mainWinnerIds = new Set(
    (state.potResults ?? [])
      .filter((r) => r.potType === 'main')
      .map((r) => r.player.id)
  );
  if (state.winner) mainWinnerIds.add(state.winner.id);

  const winnerIds = showSidePots
    ? mainWinnerIds
    : new Set([
        ...(state.potResults ?? []).map((r) => r.player.id),
        ...(state.winner ? [state.winner.id] : []),
      ]);

  return (
    <div style={{ textAlign: 'center', margin: '20px 0', paddingBottom: '40px' }}>
      <h2>🏆 ショウダウン 🏆</h2>

      {/* 結果表示 */}
      {showResult && (
        <>
          {showSidePots && state.potResults ? (
            (() => {
              const groups: Record<
                string,
                NonNullable<typeof state.potResults>
              > = {};
              state.potResults.forEach((r) => {
                if (!groups[r.potType]) groups[r.potType] = [];
                groups[r.potType].push(r);
              });
              return (
                <>
                  {groups.main && (
                    <div
                      style={{
                        background: '#1a4d1a',
                        padding: '12px',
                        margin: '10px 0',
                        borderRadius: '8px',
                        border: '2px solid #ffd700',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '16px',
                          fontWeight: 'bold',
                          color: '#ffd700',
                          marginBottom: '6px',
                        }}
                      >
                        メインポット
                      </div>
                      {groups.main.map((r, i) => (
                        <div key={i} style={{ margin: '4px 0' }}>
                          <span style={{ fontSize: '18px' }}>
                            {r.player.name} 👑{' '}
                          </span>
                          <span style={{ fontSize: '14px', color: '#ccc' }}>
                            {r.handName}
                          </span>
                          <div style={{ fontSize: '16px', marginTop: '2px' }}>
                            獲得:{' '}
                            <span
                              style={{
                                color: '#00ff00',
                                fontWeight: 'bold',
                              }}
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
                          background: '#2a2a2a',
                          padding: '12px',
                          margin: '10px 0',
                          borderRadius: '8px',
                          border: '1px solid #555',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 'bold',
                            color: '#999',
                            marginBottom: '6px',
                          }}
                        >
                          サイドポット {idx + 1}
                        </div>
                        {groups[potType].map((r, i) => (
                          <div key={i} style={{ margin: '4px 0' }}>
                            <span style={{ fontSize: '16px', color: '#ccc' }}>
                              {r.player.name}{' '}
                            </span>
                            <span style={{ fontSize: '13px', color: '#888' }}>
                              {r.handName}
                            </span>
                            <div style={{ fontSize: '14px', marginTop: '2px' }}>
                              獲得:{' '}
                              <span
                                style={{
                                  color: '#7dd87d',
                                  fontWeight: 'bold',
                                }}
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
                  fontSize: '22px',
                  fontWeight: 'bold',
                  color: '#ffd700',
                }}
              >
                {state.winner.name} 👑
              </div>
              {state.winningHand && (
                <div
                  style={{ fontSize: '16px', margin: '6px 0', color: '#ccc' }}
                >
                  {state.winningHand}
                </div>
              )}
              <div style={{ fontSize: '18px', margin: '8px 0' }}>
                獲得:{' '}
                <span style={{ color: '#00ff00', fontWeight: 'bold' }}>
                  +{state.winAmount}
                </span>{' '}
                チップ
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* ボード */}
      <h3 style={{ margin: '12px 0 8px' }}>ボード</h3>
      <div
        style={{
          display: 'flex',
          gap: '4px',
          justifyContent: 'center',
          margin: '8px 0',
        }}
      >
        {state.community.map((card, i) => (
          <CardEl key={i} card={card} />
        ))}
      </div>

      {/* プレイヤー手札 */}
      {showHands && (
        <div style={{ marginTop: '12px' }}>
          {state.players
            .filter((p) => !p.folded)
            .map((player) => {
              const isWinner = showResult && winnerIds.has(player.id);
              return (
                <div
                  key={player.id}
                  style={{
                    background: isWinner ? '#1a4d1a' : '#2a2a2a',
                    padding: '12px 16px',
                    margin: '8px 0',
                    borderRadius: '8px',
                    border: isWinner
                      ? '2px solid #ffd700'
                      : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 'bold',
                      marginBottom: '6px',
                    }}
                  >
                    {player.name} {isWinner ? '👑' : ''}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '4px',
                      justifyContent: 'center',
                      margin: '6px 0',
                    }}
                  >
                    {player.hand?.map((card, i) => (
                      <CardEl key={i} card={card} />
                    ))}
                  </div>
                  {showResult && (
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.5)',
                        marginTop: '4px',
                      }}
                    >
                      チップ: {player.chips}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* 次のハンドへボタン */}
      {showResult && (
        <div style={{ margin: '32px 0' }}>
          <div style={{ fontSize: '13px', color: '#aaa', margin: '8px 0' }}>
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
      )}
    </div>
  );
}
