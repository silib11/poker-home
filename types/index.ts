export interface Player {
  id: string;
  name: string;
  chips: number;
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
