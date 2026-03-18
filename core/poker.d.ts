export interface CardType {
  suit: string;
  rank: string;
}

export interface PlayerState {
  id: string;
  name: string;
  chips: number;
  hand: CardType[];
  bet: number;
  folded: boolean;
  lastAction: string | null;
  position: number;
  acted: boolean;
  totalBetThisHand: number;
}

export interface PotResultType {
  player: PlayerState;
  amount: number;
  handName: string;
  potType: string;
}

export interface GameState {
  players: PlayerState[];
  community: CardType[];
  pot: number;
  currentBet: number;
  phase: string;
  turnIndex: number;
  dealerIndex: number;
  sb: number;
  bb: number;
  winner?: PlayerState;
  winAmount?: number;
  winningHand?: string;
  potResults?: PotResultType[];
  nextHandReady?: string[];
}

export class PokerGame {
  constructor(
    players: Array<{ id: string; name: string; chips: number }>,
    sb: number,
    bb: number
  );
  players: PlayerState[];
  sb: number;
  bb: number;
  dealerIndex: number;
  start(): void;
  fold(playerIndex: number): void;
  check(playerIndex: number): void;
  call(playerIndex: number): void;
  bet(playerIndex: number, amount: number): void;
  getState(): GameState;
}
