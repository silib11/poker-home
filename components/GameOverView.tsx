'use client';

import { useGame } from '@/context/GameContext';

export default function GameOverView() {
  const { isHost, roomPlayers, restartGame } = useGame();
  const winner = roomPlayers.length === 1 ? roomPlayers[0] : null;

  return (
    <div id="game-screen">
      <div
        style={{ textAlign: 'center', margin: '20px', paddingTop: '60px' }}
      >
        <h2>🎉 ゲーム終了 🎉</h2>
        {winner ? (
          <>
            <div
              style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: '#ffd700',
                margin: '20px 0',
              }}
            >
              優勝: {winner.name}
            </div>
            <div style={{ fontSize: '20px', margin: '10px 0' }}>
              最終チップ: {winner.chips}
            </div>
          </>
        ) : (
          <div style={{ fontSize: '20px', margin: '20px 0' }}>
            プレイヤーが足りません
          </div>
        )}
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', margin: '12px 0' }}>
          チップ精算が完了しました。プロフィールに反映されます。
        </div>
        {isHost ? (
          <button
            onClick={restartGame}
            style={{
              width: '80%',
              padding: '20px',
              fontSize: '18px',
              margin: '20px 0',
              background: '#00aa00',
            }}
          >
            ロビーへ戻る
          </button>
        ) : (
          <div style={{ margin: '20px 0', color: '#aaa' }}>
            ホストがロビーへ戻るまでお待ちください
          </div>
        )}
      </div>
    </div>
  );
}
