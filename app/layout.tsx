import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { GameProvider } from '@/context/GameContext';

export const metadata: Metadata = {
  title: 'ポーカー',
  description: 'WebRTC P2P ポーカーゲーム',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <AuthProvider>
          <GameProvider>{children}</GameProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
