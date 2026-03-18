'use client';

import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import HostMenuModal from './HostMenuModal';

export default function WaitingRoom() {
  const { currentRoomId, roomPlayers, isHost, startGame } = useGame();
  const [showHostMenu, setShowHostMenu] = useState(false);

  function handleCopyRoomId() {
    if (currentRoomId) {
      navigator.clipboard.writeText(currentRoomId).catch(() => {});
    }
  }

  return (
    <div id="game-screen">
      <div id="top-bar">
        <div id="room-id-info">
          ルームID: {currentRoomId} | {roomPlayers.length}人
        </div>
        {isHost && (
          <button
            id="host-menu-btn"
            onClick={() => setShowHostMenu(true)}
          >
            ⚙️
          </button>
        )}
      </div>

      <div
        style={{
          padding: '80px 20px 20px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            ルームID
          </div>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 'bold',
              letterSpacing: '4px',
              color: '#fde047',
              marginBottom: '12px',
            }}
          >
            {currentRoomId}
          </div>
          <button
            onClick={handleCopyRoomId}
            style={{
              width: 'auto',
              padding: '8px 20px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
            }}
          >
            コピー
          </button>
        </div>

        <h2 style={{ marginBottom: '16px' }}>
          参加中 ({roomPlayers.length}人)
        </h2>
        <div style={{ marginBottom: '32px' }}>
          {roomPlayers.map((player) => (
            <div
              key={player.id}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: '600' }}>{player.name}</span>
              <span style={{ color: '#4ade80', fontWeight: '600' }}>
                ${player.chips}
              </span>
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            onClick={startGame}
            disabled={roomPlayers.length < 2}
            style={{
              background:
                roomPlayers.length >= 2
                  ? 'linear-gradient(145deg, #22c55e, #16a34a)'
                  : '#555',
              color: '#fff',
            }}
          >
            ゲーム開始 ({roomPlayers.length}人)
          </button>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
            ホストがゲームを開始するまでお待ちください...
          </div>
        )}
      </div>

      {showHostMenu && (
        <HostMenuModal onClose={() => setShowHostMenu(false)} />
      )}
    </div>
  );
}
