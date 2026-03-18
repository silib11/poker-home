'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import WaitingRoom from '@/components/WaitingRoom';
import GameScreen from '@/components/GameScreen';
import GameOverView from '@/components/GameOverView';

export default function GamePage() {
  const { screen } = useGame();
  const router = useRouter();

  useEffect(() => {
    if (screen === 'setup') {
      router.replace('/');
    }
  }, [screen, router]);

  if (screen === 'waiting') return <WaitingRoom />;
  if (screen === 'playing') return <GameScreen />;
  if (screen === 'gameover') return <GameOverView />;
  return null;
}
