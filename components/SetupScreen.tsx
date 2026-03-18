'use client';

import { useState } from 'react';
import { useGame } from '@/context/GameContext';

export default function SetupScreen() {
  const { createRoom, joinRoom } = useGame();

  const [hostName, setHostName] = useState('');
  const [buyinInput, setBuyinInput] = useState(1000);
  const [sbInput, setSbInput] = useState(10);
  const [bbInput, setBbInput] = useState(20);

  const [joinName, setJoinName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');

  const [loading, setLoading] = useState<'create' | 'join' | null>(null);

  async function handleCreateRoom() {
    if (!hostName.trim()) {
      alert('名前を入力してください');
      return;
    }
    setLoading('create');
    try {
      await createRoom(hostName.trim(), buyinInput, sbInput, bbInput);
    } catch {
      alert('ルーム作成に失敗しました');
    } finally {
      setLoading(null);
    }
  }

  async function handleJoinRoom() {
    if (!joinName.trim()) {
      alert('名前を入力してください');
      return;
    }
    if (!roomIdInput.trim()) {
      alert('ルームIDを入力してください');
      return;
    }
    setLoading('join');
    try {
      await joinRoom(roomIdInput.trim().toUpperCase(), joinName.trim());
    } catch {
      alert('参加に失敗しました');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div id="setup-screen">
      <h1>ポーカー</h1>

      <div id="host-section">
        <h2>ルーム作成</h2>
        <input
          type="text"
          placeholder="名前"
          maxLength={10}
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
        />
        <label>バイイン（初期チップ）</label>
        <input
          type="number"
          value={buyinInput}
          min={100}
          step={100}
          onChange={(e) => setBuyinInput(Number(e.target.value))}
        />
        <label>スモールブラインド</label>
        <input
          type="number"
          value={sbInput}
          min={5}
          step={5}
          onChange={(e) => setSbInput(Number(e.target.value))}
        />
        <label>ビッグブラインド</label>
        <input
          type="number"
          value={bbInput}
          min={10}
          step={10}
          onChange={(e) => setBbInput(Number(e.target.value))}
        />
        <button onClick={handleCreateRoom} disabled={loading !== null}>
          {loading === 'create' ? '作成中...' : 'ルーム作成して参加'}
        </button>
      </div>

      <div id="join-section">
        <h2>参加</h2>
        <input
          type="text"
          placeholder="ルームID"
          value={roomIdInput}
          onChange={(e) => setRoomIdInput(e.target.value)}
        />
        <input
          type="text"
          placeholder="名前"
          maxLength={10}
          value={joinName}
          onChange={(e) => setJoinName(e.target.value)}
        />
        <button onClick={handleJoinRoom} disabled={loading !== null}>
          {loading === 'join' ? '参加中...' : '参加'}
        </button>
      </div>
    </div>
  );
}
