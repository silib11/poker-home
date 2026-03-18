'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import SetupScreen from '@/components/SetupScreen';

export default function Home() {
  const { screen, currentRoomId } = useGame();
  const router = useRouter();

  useEffect(() => {
    if (screen !== 'setup' && currentRoomId) {
      router.push(`/game/${currentRoomId}`);
    }
  }, [screen, currentRoomId, router]);

  return <SetupScreen />;
}
