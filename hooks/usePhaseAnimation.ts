'use client';

import { useState, useRef, useEffect } from 'react';
import type { PokerState } from '@/types';

const PHASE_ORDER = ['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];
const COMM_COUNT: Record<string, number> = { FLOP: 3, TURN: 4, RIVER: 5, SHOWDOWN: 5 };
const PHASE_LABEL: Record<string, string> = { FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

export function usePhaseAnimation(pokerState: PokerState | null) {
  const [visibleCommunityCount, setVisibleCommunityCount] = useState(0);
  const [phaseBanner, setPhaseBanner] = useState<string | null>(null);
  const [showTableHands, setShowTableHands] = useState(false);
  const [showShowdownHands, setShowShowdownHands] = useState(false);
  const [showShowdownResult, setShowShowdownResult] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const animTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevPhaseRef = useRef<string>('PREFLOP');
  const isInitialRef = useRef(true);

  useEffect(() => {
    if (!pokerState) return;
    const newPhase = pokerState.phase;

    if (isInitialRef.current) {
      isInitialRef.current = false;
      setVisibleCommunityCount(pokerState.community.length);
      prevPhaseRef.current = newPhase;
      if (newPhase === 'SHOWDOWN') { setShowShowdownHands(true); setShowShowdownResult(true); }
      setIsAnimating(false);
      return;
    }

    if (newPhase === 'PREFLOP' && pokerState.community.length === 0) {
      animTimersRef.current.forEach(clearTimeout);
      animTimersRef.current = [];
      setVisibleCommunityCount(0);
      setPhaseBanner(null);
      setShowTableHands(false);
      setShowShowdownHands(false);
      setShowShowdownResult(false);
      setIsAnimating(false);
      prevPhaseRef.current = 'PREFLOP';
      return;
    }

    const prevPhase = prevPhaseRef.current;
    if (newPhase === prevPhase) return;
    prevPhaseRef.current = newPhase;

    if (newPhase === 'WINNER') {
      animTimersRef.current.forEach(clearTimeout);
      animTimersRef.current = [];
      setIsAnimating(false);
      return;
    }

    const fromIdx = PHASE_ORDER.indexOf(prevPhase);
    const toIdx = PHASE_ORDER.indexOf(newPhase);
    if (fromIdx === -1 || toIdx === -1 || toIdx <= fromIdx) return;

    const phases = PHASE_ORDER.slice(fromIdx + 1, toIdx + 1);
    animTimersRef.current.forEach(clearTimeout);
    animTimersRef.current = [];
    setIsAnimating(true);

    const timers: ReturnType<typeof setTimeout>[] = [];
    let delay = 0;
    const isAllInRunout = !!pokerState.allInRunout;

    if (isAllInRunout) {
      timers.push(setTimeout(() => setShowTableHands(true), 0));
      delay += 2500;
    }

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const isLast = i === phases.length - 1;
      const bannerDuration = isAllInRunout ? 1000 : 500;
      const interPhasePause = isAllInRunout ? 2500 : 1500;

      if (phase === 'FLOP' || phase === 'TURN' || phase === 'RIVER') {
        timers.push(setTimeout(() => setPhaseBanner(PHASE_LABEL[phase]), delay));
        delay += bannerDuration;
        const count = COMM_COUNT[phase];
        if (isLast) {
          timers.push(setTimeout(() => { setPhaseBanner(null); setVisibleCommunityCount(count); setIsAnimating(false); }, delay));
        } else {
          timers.push(setTimeout(() => { setPhaseBanner(null); setVisibleCommunityCount(count); }, delay));
          delay += interPhasePause;
        }
      } else if (phase === 'SHOWDOWN') {
        timers.push(setTimeout(() => setPhaseBanner(PHASE_LABEL['SHOWDOWN']), delay));
        delay += bannerDuration;
        if (isAllInRunout) {
          timers.push(setTimeout(() => { setPhaseBanner(null); setShowTableHands(false); setShowShowdownHands(true); setShowShowdownResult(true); setIsAnimating(false); }, delay));
        } else {
          timers.push(setTimeout(() => { setPhaseBanner(null); setShowTableHands(true); }, delay));
          delay += 1500;
          timers.push(setTimeout(() => { setShowTableHands(false); setShowShowdownHands(true); setShowShowdownResult(true); setIsAnimating(false); }, delay));
        }
      }
    }

    animTimersRef.current = timers;
  }, [pokerState?.phase, pokerState?.community?.length, pokerState?.allInRunout]);

  useEffect(() => {
    return () => { animTimersRef.current.forEach(clearTimeout); };
  }, []);

  return {
    visibleCommunityCount,
    phaseBanner,
    showTableHands,
    showShowdownHands,
    showShowdownResult,
    isAnimating,
  };
}
