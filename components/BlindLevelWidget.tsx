'use client';

import { useState, useEffect } from 'react';
import type { TournamentConfig, TournamentProgress } from '@/types';

interface BlindLevelWidgetProps {
  tournamentConfig: TournamentConfig | null;
  tournamentProgress: TournamentProgress | null;
  handNumber?: number;
}

export default function BlindLevelWidget({
  tournamentConfig,
  tournamentProgress,
  handNumber,
}: BlindLevelWidgetProps) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!tournamentConfig || !tournamentProgress) return;
    const levelDef = tournamentConfig.blindLevels[tournamentProgress.currentLevel];
    if (!levelDef) return;

    const update = () => {
      const totalMs = levelDef.durationMinutes * 60 * 1000;
      const elapsed = Date.now() - tournamentProgress.levelStartedAt;
      setRemaining(Math.max(0, totalMs - elapsed));
    };
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [tournamentConfig, tournamentProgress]);

  if (!tournamentConfig || !tournamentProgress) return null;

  const levelDef = tournamentConfig.blindLevels[tournamentProgress.currentLevel];
  if (!levelDef) return null;

  const nextLevelDef = tournamentConfig.blindLevels[tournamentProgress.currentLevel + 1];
  const remSec = Math.ceil(remaining / 1000);
  const mm = String(Math.floor(remSec / 60)).padStart(2, '0');
  const ss = String(remSec % 60).padStart(2, '0');
  const timerColor = remSec <= 30 ? '#ef4444' : remSec <= 60 ? '#f59e0b' : 'rgba(255,255,255,0.7)';
  const blink = remSec <= 30 && remSec % 2 === 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: '12px',
        padding: '6px 14px',
        zIndex: 50,
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: '#f59e0b', fontWeight: '700', letterSpacing: '1px' }}>
          LEVEL {levelDef.level}
        </div>
        <div style={{ fontSize: '13px', fontWeight: '800', color: '#fff' }}>
          {levelDef.sb}/{levelDef.bb}
          {levelDef.ante > 0 && (
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginLeft: '4px' }}>
              ante {levelDef.ante}
            </span>
          )}
        </div>
      </div>

      <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.15)' }} />

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px' }}>
          NEXT LEVEL
        </div>
        <div
          style={{
            fontSize: '13px',
            fontWeight: '800',
            color: timerColor,
            opacity: blink ? 0.4 : 1,
            transition: 'opacity 0.5s',
          }}
        >
          {mm}:{ss}
        </div>
      </div>

      {nextLevelDef && (
        <>
          <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>次</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>
              {nextLevelDef.sb}/{nextLevelDef.bb}
            </div>
          </div>
        </>
      )}

      {handNumber !== undefined && handNumber > 0 && (
        <>
          <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
            Hand #{handNumber}
          </div>
        </>
      )}
    </div>
  );
}
