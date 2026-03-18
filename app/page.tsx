'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import AuthScreen from '@/components/AuthScreen';
import CreateRoomTab from '@/components/CreateRoomTab';
import JoinRoomTab from '@/components/JoinRoomTab';
import ProfileTab from '@/components/ProfileTab';

type Tab = 'create' | 'join' | 'profile';

export default function Home() {
  const { screen, currentRoomId } = useGame();
  const { user, authLoading, profileLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('create');

  useEffect(() => {
    if (screen !== 'setup' && currentRoomId) {
      router.push(`/game/${currentRoomId}`);
    }
  }, [screen, currentRoomId, router]);

  if (authLoading || profileLoading) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>♠</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>読み込み中...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'create', label: 'ルーム作成', icon: '＋' },
    { id: 'join', label: 'ルーム参加', icon: '→' },
    { id: 'profile', label: 'プロフィール', icon: '👤' },
  ];

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
      }}
    >
      {/* ヘッダー */}
      <div
        style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}
      >
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '1px', textAlign: 'center' }}>
          ♠ ポーカー
        </h1>
      </div>

      {/* コンテンツ */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '80px' }}>
        {tab === 'create' && <CreateRoomTab />}
        {tab === 'join' && <JoinRoomTab />}
        {tab === 'profile' && <ProfileTab />}
      </div>

      {/* フッターナビ */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(15,23,42,0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          zIndex: 100,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: '10px 8px 14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderTop: `2px solid ${tab === t.id ? '#3b82f6' : 'transparent'}`,
            }}
          >
            <span style={{ fontSize: '18px' }}>{t.icon}</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: tab === t.id ? '700' : '400',
                color: tab === t.id ? '#3b82f6' : 'rgba(255,255,255,0.4)',
              }}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
