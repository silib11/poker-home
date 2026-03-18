'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ERROR_ALREADY_LOGGED_IN } from '@/types';

export default function AuthScreen() {
  const { signUp, logIn } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }
    if (mode === 'signup' && !playerName.trim()) {
      setError('プレイヤー名を入力してください');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(email.trim(), password, playerName.trim());
      } else {
        await logIn(email.trim(), password);
      }
    } catch (e: unknown) {
      const msg = (e as { message?: string }).message ?? '';
      if (msg.includes(ERROR_ALREADY_LOGGED_IN)) {
        setError('すでに別の端末でログイン中です。そちらでログアウトするか、しばらくお待ちください。');
      } else if (msg.includes('email-already-in-use')) {
        setError('このメールアドレスはすでに使われています');
      } else if (msg.includes('wrong-password') || msg.includes('user-not-found') || msg.includes('invalid-credential')) {
        setError('メールアドレスまたはパスワードが間違っています');
      } else if (msg.includes('weak-password')) {
        setError('パスワードは6文字以上で入力してください');
      } else {
        setError('エラーが発生しました。もう一度お試しください');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <h1
          style={{
            textAlign: 'center',
            fontSize: '32px',
            fontWeight: 'bold',
            marginBottom: '8px',
            letterSpacing: '2px',
          }}
        >
          ♠ ポーカー
        </h1>
        <p
          style={{
            textAlign: 'center',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '13px',
            marginBottom: '32px',
          }}
        >
          フレンドと遊べる P2P ポーカー
        </p>

        <div
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            padding: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '10px',
              padding: '4px',
              marginBottom: '24px',
            }}
          >
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '14px',
                  background: mode === m ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: mode === m ? '#fff' : 'rgba(255,255,255,0.4)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {m === 'login' ? 'ログイン' : '新規登録'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mode === 'signup' && (
              <input
                type="text"
                placeholder="プレイヤー名（最大10文字）"
                maxLength={10}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
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
            )}
            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            <input
              type="password"
              placeholder="パスワード（6文字以上）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
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

          {error && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 14px',
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px',
                color: '#fca5a5',
                fontSize: '13px',
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              marginTop: '20px',
              padding: '14px',
              background: loading ? '#555' : 'linear-gradient(145deg, #3b82f6, #2563eb)',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '16px',
              color: '#fff',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウント作成（5000$付与）'}
          </button>
        </div>
      </div>
    </div>
  );
}
