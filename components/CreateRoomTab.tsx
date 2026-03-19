'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useGame } from '@/context/GameContext';

export default function CreateRoomTab() {
  const { profile } = useAuth();
  const { createRoom } = useGame();

  const [buyinInput, setBuyinInput] = useState(1000);
  const [sbInput, setSbInput] = useState(10);
  const [bbInput, setBbInput] = useState(20);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!profile) return;
    setLoading(true);
    try {
      await createRoom(buyinInput, sbInput, bbInput);
    } catch {
      alert('ルーム作成に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: '480px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '24px' }}>
        ルーム作成
      </h2>

      <div
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>プレイヤー名</span>
        <span style={{ fontWeight: '600', fontSize: '16px' }}>{profile?.playerName ?? '-'}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
        <div>
          <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px', display: 'block' }}>
            バイイン（初期チップ）
          </label>
          <input
            type="number"
            value={buyinInput}
            min={100}
            step={100}
            onChange={(e) => setBuyinInput(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '15px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px', display: 'block' }}>
            スモールブラインド
          </label>
          <input
            type="number"
            value={sbInput}
            min={5}
            step={5}
            onChange={(e) => setSbInput(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '15px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px', display: 'block' }}>
            ビッグブラインド
          </label>
          <input
            type="number"
            value={bbInput}
            min={10}
            step={10}
            onChange={(e) => setBbInput(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '15px',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={loading}
        style={{
          width: '100%',
          padding: '14px',
          background: loading ? '#555' : 'linear-gradient(145deg, #22c55e, #16a34a)',
          borderRadius: '12px',
          fontWeight: '700',
          fontSize: '16px',
          color: '#fff',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '作成中...' : 'ルーム作成して参加'}
      </button>
    </div>
  );
}
