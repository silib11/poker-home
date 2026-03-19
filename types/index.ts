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
  allInRunout?: boolean;
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
  lifetimeProfit: number;
  friendIds: string[];
  activeRoomId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface GameResult {
  roomId: string;
  totalBuyin: number;
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
