'use client';

import type { TournamentRank } from '@/types';
import { useGame } from '@/context/GameContext';

interface Props {
  rankList: TournamentRank[];
  onClose: () => void;
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function TournamentResultModal({ rankList, onClose }: Props) {
  const { isHost, restartGame } = useGame();

  const sorted = [...rankList].sort((a, b) => a.rank - b.rank);
  const winner = sorted[0];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.88)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f23 100%)',
          border: '1px solid rgba(255,215,0,0.3)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '420px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 60px rgba(255,215,0,0.15)',
        }}
      >
        {/* ヘッダー */}
        <div
          style={{
            padding: '24px 24px 16px',
            textAlign: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ fontSize: '13px', color: '#f59e0b', fontWeight: '600', letterSpacing: '2px', marginBottom: '8px' }}>
            TOURNAMENT RESULT
          </div>
          <div style={{ fontSize: '26px', fontWeight: '900', color: '#ffd700', marginBottom: '4px' }}>
            {winner?.playerName ?? '-'}
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
            優勝おめでとうございます！
          </div>
        </div>

        {/* 順位リスト */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {sorted.map((entry) => {
            const isFirst = entry.rank === 1;
            const medal = MEDAL[entry.rank];
            return (
              <div
                key={entry.playerId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  marginBottom: '8px',
                  background: isFirst
                    ? 'rgba(255,215,0,0.12)'
                    : 'rgba(255,255,255,0.04)',
                  border: isFirst
                    ? '1px solid rgba(255,215,0,0.3)'
                    : '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {/* 順位 */}
                <div
                  style={{
                    width: '36px',
                    textAlign: 'center',
                    fontSize: medal ? '20px' : '16px',
                    fontWeight: '800',
                    color: isFirst ? '#ffd700' : 'rgba(255,255,255,0.5)',
                    flexShrink: 0,
                  }}
                >
                  {medal ?? `${entry.rank}位`}
                </div>

                {/* 名前 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: isFirst ? '700' : '500',
                      color: isFirst ? '#ffd700' : '#fff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entry.playerName}
                  </div>
                  {entry.rank > 1 && (
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                      Level {entry.bustLevel} · Hand #{entry.bustHandNumber}
                    </div>
                  )}
                </div>

                {/* 順位バッジ */}
                {!medal && (
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: 'rgba(255,255,255,0.4)',
                      flexShrink: 0,
                    }}
                  >
                    {entry.rank}位
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* フッター */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            gap: '10px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '13px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            閉じる
          </button>
          {isHost && (
            <button
              onClick={() => { onClose(); restartGame(); }}
              style={{
                flex: 1,
                padding: '13px',
                background: 'linear-gradient(145deg, #22c55e, #16a34a)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              ロビーへ戻る
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
