export interface Player {
  id: string;
  name: string;
  chips: number;
  uid?: string;
  hand?: Card[];
  bet?: number;
  folded?: boolean;
  lastAction?: string | null;
  position?: number;
  acted?: boolean;
  totalBetThisHand?: number;
}

export interface Card {
  suit: string;
  rank: string;
}

export interface PotResult {
  player: Player;
  amount: number;
  handName: string;
  potType: string;
}

export interface PokerState {
  players: Player[];
  community: Card[];
  pot: number;
  currentBet: number;
  phase: string;
  turnIndex: number;
  dealerIndex: number;
  sb: number;
  bb: number;
  winner?: Player;
  winAmount?: number;
  winningHand?: string;
  potResults?: PotResult[];
  nextHandReady?: string[];
}

export interface RoomState {
  players: Player[];
  buyin: number;
  sb: number;
  bb: number;
}

export type Screen = 'setup' | 'waiting' | 'playing' | 'gameover';

export interface UserProfile {
  uid: string;
  email: string;
  playerName: string;
  chipBalance: number;
  lifetimeProfit: number;
  totalTopUp: number;
  friendIds: string[];
  activeRoomId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface GameResult {
  roomId: string;
  buyin: number;
  finalStack: number;
  gameDelta: number;
  savedAt: number;
}

export interface RoomMeta {
  buyin: number;
  sb: number;
  bb: number;
  hostUid: string;
  hostName: string;
  createdAt: number;
}

/** RTDB userSessions/{uid} の形状。単一ログイン拒否用。 */
export interface UserSession {
  sessionId: string;
  lastSeen: number;
  activeRoomId: string | null;
  status: 'online';
}

/** セッション有効期限（ms）。この時間 heartbeat がなければ別端末からログイン可能。 */
export const SESSION_TTL_MS = 45_000;

/** heartbeat 更新間隔（ms）。TTL より十分短くする。 */
export const SESSION_HEARTBEAT_INTERVAL_MS = 12_000;

/** 多重ログイン拒否時に throw する識別用メッセージ。 */
export const ERROR_ALREADY_LOGGED_IN = 'session-already-active';
