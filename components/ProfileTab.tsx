'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import type { UserProfile } from '@/types';

interface FriendInfo {
  uid: string;
  playerName: string;
  activeRoomId: string | null;
}

export default function ProfileTab() {
  const { user, profile, profileLoading, logOut, updatePlayerName, topUpChips, addFriend, removeFriend } = useAuth();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  const [topUpAmount, setTopUpAmount] = useState(1000);
  const [topUpLoading, setTopUpLoading] = useState(false);

  const [friendUidInput, setFriendUidInput] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);
  const [friendInfos, setFriendInfos] = useState<FriendInfo[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  const [uidCopied, setUidCopied] = useState(false);

  useEffect(() => {
    if (profile?.playerName != null && !editingName) {
      setNameInput(profile.playerName);
    }
  }, [profile?.playerName, editingName]);

  useEffect(() => {
    if (!profile || profile.friendIds.length === 0) {
      setFriendInfos([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setFriendsLoading(true);
      const infos: FriendInfo[] = [];
      for (const uid of profile!.friendIds) {
        try {
          const snap = await getDoc(doc(firestore, 'users', uid));
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            infos.push({ uid, playerName: data.playerName, activeRoomId: data.activeRoomId });
          }
        } catch {
          // スキップ
        }
      }
      if (!cancelled) {
        setFriendInfos(infos);
        setFriendsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [profile?.friendIds.join(',')]);

  async function handleSaveName() {
    if (!nameInput.trim()) return;
    setNameSaving(true);
    try {
      await updatePlayerName(nameInput.trim());
      setEditingName(false);
    } finally {
      setNameSaving(false);
    }
  }

  async function handleTopUp() {
    if (topUpAmount <= 0) return;
    setTopUpLoading(true);
    try {
      await topUpChips(topUpAmount);
      alert(`$${topUpAmount} を追加しました（生涯収支から差し引かれます）`);
    } finally {
      setTopUpLoading(false);
    }
  }

  async function handleAddFriend() {
    if (!friendUidInput.trim()) return;
    setAddingFriend(true);
    try {
      const snap = await getDoc(doc(firestore, 'users', friendUidInput.trim()));
      if (!snap.exists()) {
        alert('ユーザーが見つかりません');
        return;
      }
      await addFriend(friendUidInput.trim());
      setFriendUidInput('');
    } catch {
      alert('エラーが発生しました');
    } finally {
      setAddingFriend(false);
    }
  }

  async function handleCopyUid() {
    const uid = user?.uid;
    if (!uid) return;
    try {
      await navigator.clipboard.writeText(uid);
      setUidCopied(true);
      setTimeout(() => setUidCopied(false), 2000);
    } catch {
      alert('コピーに失敗しました');
    }
  }

  const profitColor = !profile
    ? '#fff'
    : profile.lifetimeProfit > 0
    ? '#4ade80'
    : profile.lifetimeProfit < 0
    ? '#f87171'
    : '#fff';

  return (
    <div className="profile-tab" style={{ padding: '24px 20px', maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>プロフィール</h2>
        <button
          onClick={logOut}
          style={{
            padding: '6px 14px',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
          }}
        >
          ログアウト
        </button>
      </div>

      {/* プレイヤー名 */}
      <div
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px',
        }}
      >
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>プレイヤー名</div>
        {editingName ? (
          <div className="profile-tab-row">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={10}
              autoFocus
              className="profile-tab-input"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '16px',
              }}
            />
            <button
              onClick={handleSaveName}
              disabled={nameSaving}
              className="profile-tab-btn profile-tab-btn-primary"
              style={{
                padding: '8px 12px',
                background: '#22c55e',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '13px',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              保存
            </button>
            <button
              onClick={() => setEditingName(false)}
              className="profile-tab-btn"
              style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              取消
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '18px', fontWeight: '600' }}>
              {profileLoading ? '読み込み中...' : (profile?.playerName?.trim() || '未設定')}
            </span>
            <button
              onClick={() => { setNameInput(profile?.playerName ?? ''); setEditingName(true); }}
              style={{
                padding: '4px 12px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '6px',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
              }}
            >
              編集
            </button>
          </div>
        )}
      </div>

      {/* メールアドレス */}
      <div
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px',
        }}
      >
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>メールアドレス</div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>{user?.email}</div>
      </div>

      {/* UID（フレンド追加用） */}
      <div
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px',
        }}
      >
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>あなたのUID（フレンド追加に使用）</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: '12px', color: 'rgba(255,255,255,0.5)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
            {user?.uid}
          </div>
          <button
            type="button"
            onClick={handleCopyUid}
            style={{
              padding: '6px 12px',
              background: uidCopied ? '#22c55e' : 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#fff',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {uidCopied ? 'コピーしました' : 'コピー'}
          </button>
        </div>
      </div>

      {/* 持ちチップ・生涯収支 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '16px',
          }}
        >
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>持ちチップ</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#4ade80' }}>
            ${(profile?.chipBalance ?? 0).toLocaleString()}
          </div>
        </div>
        <div
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '16px',
          }}
        >
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>生涯収支</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: profitColor }}>
            {(profile?.lifetimeProfit ?? 0) >= 0 ? '+' : ''}
            ${(profile?.lifetimeProfit ?? 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* チップ追加 */}
      <div
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
        }}
      >
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>
          チップ追加（生涯収支から差し引かれます）
        </div>
        <div className="profile-tab-row">
          <input
            type="number"
            value={topUpAmount}
            min={100}
            step={100}
            onChange={(e) => setTopUpAmount(Number(e.target.value))}
            className="profile-tab-input"
            style={{
              flex: 1,
              minWidth: 0,
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '16px',
            }}
          />
          <button
            onClick={handleTopUp}
            disabled={topUpLoading}
            className="profile-tab-btn"
            style={{
              padding: '8px 14px',
              background: topUpLoading ? '#555' : 'linear-gradient(145deg, #f59e0b, #d97706)',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '13px',
              color: '#fff',
              border: 'none',
              cursor: topUpLoading ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {topUpLoading ? '追加中...' : '追加'}
          </button>
        </div>
      </div>

      {/* フレンド一覧 */}
      <div>
        <h3 style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
          フレンド一覧
        </h3>

        <div className="profile-tab-row" style={{ marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="フレンドのUID"
            value={friendUidInput}
            onChange={(e) => setFriendUidInput(e.target.value.trim())}
            className="profile-tab-input"
            style={{
              flex: 1,
              minWidth: 0,
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '16px',
            }}
          />
          <button
            onClick={handleAddFriend}
            disabled={addingFriend || !friendUidInput.trim()}
            className="profile-tab-btn"
            style={{
              padding: '8px 14px',
              background: addingFriend || !friendUidInput.trim() ? '#555' : 'linear-gradient(145deg, #3b82f6, #2563eb)',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '13px',
              color: '#fff',
              border: 'none',
              cursor: addingFriend || !friendUidInput.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {addingFriend ? '追加中...' : '追加'}
          </button>
        </div>

        {friendsLoading ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '13px', padding: '16px 0' }}>
            読み込み中...
          </div>
        ) : friendInfos.length === 0 ? (
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: '10px',
              padding: '16px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.3)',
              fontSize: '13px',
            }}
          >
            フレンドがいません
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {friendInfos.map((f) => (
              <div
                key={f.uid}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>{f.playerName}</div>
                  <div style={{ fontSize: '11px', color: f.activeRoomId ? '#4ade80' : 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                    {f.activeRoomId ? '● プレイ中' : '○ オフライン'}
                  </div>
                </div>
                <button
                  onClick={() => removeFriend(f.uid)}
                  style={{
                    padding: '4px 10px',
                    background: 'rgba(239,68,68,0.15)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#f87171',
                    cursor: 'pointer',
                  }}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
