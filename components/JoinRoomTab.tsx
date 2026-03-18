'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useGame } from '@/context/GameContext';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import type { RoomMeta } from '@/types';

interface FriendRoom {
  uid: string;
  playerName: string;
  activeRoomId: string;
  meta: RoomMeta | null;
}

export default function JoinRoomTab() {
  const { profile, getFriendProfiles } = useAuth();
  const { joinRoom } = useGame();

  const [roomIdInput, setRoomIdInput] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [friendRooms, setFriendRooms] = useState<FriendRoom[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  const chipBalance = profile?.chipBalance ?? 0;

  useEffect(() => {
    let cancelled = false;
    async function loadFriendRooms() {
      setFriendsLoading(true);
      try {
        const friends = await getFriendProfiles();
        const rooms: FriendRoom[] = [];
        for (const f of friends) {
          if (!f.activeRoomId) continue;
          let meta: RoomMeta | null = null;
          try {
            const snap = await get(ref(db, `roomMeta/${f.activeRoomId}`));
            if (snap.exists()) meta = snap.val() as RoomMeta;
          } catch {
            // メタ取得失敗はスキップ
          }
          rooms.push({ uid: f.uid, playerName: f.playerName, activeRoomId: f.activeRoomId, meta });
        }
        if (!cancelled) setFriendRooms(rooms);
      } finally {
        if (!cancelled) setFriendsLoading(false);
      }
    }
    loadFriendRooms();
    return () => { cancelled = true; };
  }, [getFriendProfiles]);

  async function handleJoinById() {
    if (!roomIdInput.trim()) {
      alert('ルームIDを入力してください');
      return;
    }
    const roomId = roomIdInput.trim().toUpperCase();

    let meta: RoomMeta | null = null;
    try {
      const snap = await get(ref(db, `roomMeta/${roomId}`));
      if (snap.exists()) meta = snap.val() as RoomMeta;
    } catch {
      // メタなしでも参加試みる
    }

    if (meta && chipBalance < meta.buyin) {
      alert(`所持チップが不足しています（所持: $${chipBalance}、バイイン: $${meta.buyin}）`);
      return;
    }

    setLoading('input');
    try {
      await joinRoom(roomId);
    } catch {
      alert('参加に失敗しました');
    } finally {
      setLoading(null);
    }
  }

  async function handleJoinFriendRoom(room: FriendRoom) {
    if (room.meta && chipBalance < room.meta.buyin) {
      alert(`所持チップが不足しています（所持: $${chipBalance}、バイイン: $${room.meta.buyin}）`);
      return;
    }
    setLoading(room.activeRoomId);
    try {
      await joinRoom(room.activeRoomId);
    } catch {
      alert('参加に失敗しました');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: '480px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '24px' }}>
        ルーム参加
      </h2>

      <div
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>所持チップ</span>
        <span style={{ fontWeight: '700', fontSize: '18px', color: '#4ade80' }}>
          ${chipBalance.toLocaleString()}
        </span>
      </div>

      {/* フレンドの部屋 */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
          フレンドの部屋
        </h3>
        {friendsLoading ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '14px', padding: '20px 0' }}>
            読み込み中...
          </div>
        ) : friendRooms.length === 0 ? (
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.3)',
              fontSize: '13px',
            }}
          >
            フレンドが立てている部屋はありません
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {friendRooms.map((room) => {
              const canJoin = !room.meta || chipBalance >= room.meta.buyin;
              return (
                <div
                  key={room.activeRoomId}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '2px' }}>
                      {room.playerName}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                      {room.meta
                        ? `バイイン $${room.meta.buyin} / SB $${room.meta.sb} / BB $${room.meta.bb}`
                        : `ID: ${room.activeRoomId}`}
                    </div>
                    {!canJoin && (
                      <div style={{ fontSize: '11px', color: '#f87171', marginTop: '2px' }}>
                        チップ不足
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleJoinFriendRoom(room)}
                    disabled={loading === room.activeRoomId || !canJoin}
                    style={{
                      padding: '8px 16px',
                      background: !canJoin ? '#555' : 'linear-gradient(145deg, #3b82f6, #2563eb)',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '13px',
                      color: '#fff',
                      border: 'none',
                      cursor: !canJoin ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {loading === room.activeRoomId ? '参加中...' : '参加'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ルームID入力 */}
      <div>
        <h3 style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
          ルームID で参加
        </h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="ルームID（例: ABCDEF）"
            value={roomIdInput}
            onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
            maxLength={6}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '15px',
              letterSpacing: '2px',
            }}
          />
          <button
            onClick={handleJoinById}
            disabled={loading === 'input'}
            style={{
              padding: '12px 20px',
              background: loading === 'input' ? '#555' : 'linear-gradient(145deg, #3b82f6, #2563eb)',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '14px',
              color: '#fff',
              border: 'none',
              cursor: loading === 'input' ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {loading === 'input' ? '参加中...' : '参加'}
          </button>
        </div>
      </div>
    </div>
  );
}
