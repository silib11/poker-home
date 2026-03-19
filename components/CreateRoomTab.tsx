'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useGame } from '@/context/GameContext';
import type { BlindLevel, TournamentConfig } from '@/types';

function roundToNice(n: number): number {
  if (n <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(n)));
  const normalized = n / magnitude;
  let nice: number;
  if (normalized < 1.5) nice = 1;
  else if (normalized < 3.5) nice = 2;
  else if (normalized < 7.5) nice = 5;
  else nice = 10;
  return nice * magnitude;
}

/** current より大きい最小のキリの良い数を返す */
function nextNiceAbove(current: number): number {
  const bases = [1, 2, 5];
  const magnitude = Math.pow(10, Math.floor(Math.log10(current)));
  for (let m = magnitude; m <= current * 100; m *= 10) {
    for (const b of bases) {
      if (b * m > current) return b * m;
    }
  }
  return current * 2;
}

function generateBlindLevels(
  initialBb: number,
  count: number,
  durationMinutes: number,
  anteStartLevel: number
): BlindLevel[] {
  const levels: BlindLevel[] = [];
  let bb = initialBb;
  let sb = Math.max(1, roundToNice(Math.round(bb / 2)));

  for (let i = 0; i < count; i++) {
    const level = i + 1;
    const ante = anteStartLevel > 0 && level >= anteStartLevel ? bb : 0;
    levels.push({ level, sb, bb, ante, durationMinutes });

    const candidate = roundToNice(Math.round(bb * 1.5));
    bb = candidate > bb ? candidate : nextNiceAbove(bb);
    sb = roundToNice(Math.round(bb / 2));
  }
  return levels;
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '14px',
  boxSizing: 'border-box' as const,
};

const labelStyle = {
  fontSize: '12px',
  color: 'rgba(255,255,255,0.55)',
  marginBottom: '4px',
  display: 'block',
};

export default function CreateRoomTab() {
  const { profile } = useAuth();
  const { createRoom } = useGame();

  const [buyinInput, setBuyinInput] = useState(1000);
  const [sbInput, setSbInput] = useState(10);
  const [bbInput, setBbInput] = useState(20);
  const [loading, setLoading] = useState(false);

  const [isTournament, setIsTournament] = useState(false);
  const [levelDuration, setLevelDuration] = useState(15);
  const [levelCount, setLevelCount] = useState(10);
  const [reentryUntilLevel, setReentryUntilLevel] = useState(4);
  const [anteStartLevel, setAnteStartLevel] = useState(5);
  const [blindLevels, setBlindLevels] = useState<BlindLevel[]>(() =>
    generateBlindLevels(20, 10, 15, 5)
  );

  function handleRegenerateLevels() {
    setBlindLevels(generateBlindLevels(bbInput, levelCount, levelDuration, anteStartLevel));
  }

  function updateLevel(index: number, field: keyof BlindLevel, value: number) {
    setBlindLevels((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function handleCreate() {
    if (!profile) return;
    setLoading(true);
    try {
      const tournamentConfig: TournamentConfig | undefined = isTournament
        ? { enabled: true, blindLevels, reentryUntilLevel }
        : undefined;
      await createRoom(buyinInput, sbInput, bbInput, tournamentConfig);
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

      {/* プレイヤー名 */}
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

      {/* ゲームMode切り替え */}
      <div
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '12px',
          padding: '4px',
          marginBottom: '20px',
          display: 'flex',
          gap: '4px',
        }}
      >
        {(['キャッシュゲーム', 'トーナメント'] as const).map((label, i) => (
          <button
            key={label}
            onClick={() => setIsTournament(i === 1)}
            style={{
              flex: 1,
              padding: '10px',
              background: isTournament === (i === 1)
                ? i === 1
                  ? 'linear-gradient(145deg, #f59e0b, #d97706)'
                  : 'rgba(255,255,255,0.15)'
                : 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: isTournament === (i === 1) ? '700' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 共通設定 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
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
            {isTournament ? '初期スモールブラインド' : 'スモールブラインド'}
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
            {isTournament ? '初期ビッグブラインド' : 'ビッグブラインド'}
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

      {/* トーナメント設定 */}
      {isTournament && (
        <div
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#f59e0b', marginBottom: '16px' }}>
            トーナメント設定
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>レベル時間（分）</label>
              <input
                type="number"
                value={levelDuration}
                min={1}
                step={1}
                onChange={(e) => setLevelDuration(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>レベル数</label>
              <input
                type="number"
                value={levelCount}
                min={3}
                max={20}
                step={1}
                onChange={(e) => setLevelCount(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>リエントリー締め切りLv</label>
              <input
                type="number"
                value={reentryUntilLevel}
                min={0}
                step={1}
                onChange={(e) => setReentryUntilLevel(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>アンティ開始Lv（0=なし）</label>
              <input
                type="number"
                value={anteStartLevel}
                min={0}
                step={1}
                onChange={(e) => setAnteStartLevel(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
          </div>

          <button
            onClick={handleRegenerateLevels}
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(245,158,11,0.2)',
              border: '1px solid rgba(245,158,11,0.4)',
              borderRadius: '8px',
              color: '#f59e0b',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              marginBottom: '16px',
            }}
          >
            ブラインドテーブルを再生成
          </button>

          {/* ブラインドテーブルプレビュー */}
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', fontWeight: '600' }}>
            ブラインドテーブル（各行を直接編集可能）
          </div>
          <div
            style={{
              maxHeight: '220px',
              overflowY: 'auto',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              padding: '8px',
            }}
          >
            {/* ヘッダー */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 1fr 1fr 1fr 1fr',
                gap: '4px',
                marginBottom: '4px',
              }}
            >
              {['Lv', 'SB', 'BB', 'Ante', '時間(分)'].map((h) => (
                <div key={h} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                  {h}
                </div>
              ))}
            </div>

            {blindLevels.map((lv, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr 1fr 1fr 1fr',
                  gap: '4px',
                  marginBottom: '4px',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.5)',
                    fontWeight: '600',
                  }}
                >
                  {lv.level}
                </div>
                {(['sb', 'bb', 'ante', 'durationMinutes'] as const).map((field) => (
                  <input
                    key={field}
                    type="number"
                    value={lv[field]}
                    min={0}
                    step={field === 'durationMinutes' ? 1 : 5}
                    onChange={(e) => updateLevel(i, field, Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '11px',
                      boxSizing: 'border-box' as const,
                      textAlign: 'center',
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={loading}
        style={{
          width: '100%',
          padding: '14px',
          background: loading
            ? '#555'
            : isTournament
            ? 'linear-gradient(145deg, #f59e0b, #d97706)'
            : 'linear-gradient(145deg, #22c55e, #16a34a)',
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
