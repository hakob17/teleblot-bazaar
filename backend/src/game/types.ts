export type Suit = 'HEARTS' | 'DIAMONDS' | 'CLUBS' | 'SPADES';
export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const ALL_SUITS: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
export const ALL_RANKS: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export type GamePhase = 'AUCTION' | 'PLAYING' | 'FINISHED';

// Value in points for a given card if Trump
export const TRUMP_VALUES: Record<Rank, number> = {
  'J': 20,
  '9': 14,
  'A': 11,
  '10': 10,
  'K': 4,
  'Q': 3,
  '8': 0,
  '7': 0
};

// Value in points for a given card if NON-Trump
export const NON_TRUMP_VALUES: Record<Rank, number> = {
  'A': 11,
  '10': 10,
  'K': 4,
  'Q': 3,
  'J': 2,
  '9': 0,
  '8': 0,
  '7': 0
};

// Hierarchy for sorting/comparison inside Trump suit
// J(V) > 9 > A(T) > 10 > K > Q > 8 > 7
export const TRUMP_HIERARCHY: Record<Rank, number> = {
  'J': 8,
  '9': 7,
  'A': 6,
  '10': 5,
  'K': 4,
  'Q': 3,
  '8': 2,
  '7': 1
};

// Hierarchy for sorting/comparison inside Non-Trump suit
// A > 10 > K > Q > J > 9 > 8 > 7
export const NON_TRUMP_HIERARCHY: Record<Rank, number> = {
  'A': 8,
  '10': 7,
  'K': 6,
  'Q': 5,
  'J': 4,
  '9': 3,
  '8': 2,
  '7': 1
};

// Sequence rank order for declarations (A highest, 7 lowest)
export const SEQUENCE_RANK_ORDER: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];

export interface Bid {
  playerIndex: number;
  amount: number; // 8-16, or 25 (Kaput)
  suit: Suit;
  isPass: boolean;
  isContra: boolean;
  isRecontra: boolean;
}

export interface PlayerState {
  userId: string;
  hand: Card[];
  pointsCaptured: number;
  tricksTaken: number;
}

// Declarations / Combinations
export type DeclarationType = 'TERTZ' | 'FIFTY' | 'HUNDRED' | 'FOUR_JACKS' | 'FOUR_NINES' | 'FOUR_ACES' | 'FOUR_TENS' | 'FOUR_KINGS' | 'FOUR_QUEENS' | 'BELOT';

export interface Declaration {
  type: DeclarationType;
  playerIndex: number;
  cards: Card[];
  points: number;
}

export interface MoveLogEntry {
  type: 'bid' | 'play';
  playerIndex: number;
  bid?: Bid;
  card?: Card;
}

export interface GameState {
  matchId: string;
  phase: GamePhase;
  players: PlayerState[];

  // Auction specific
  dealerIndex: number;
  currentTurnIndex: number;
  bids: Bid[];
  winningBid: Bid | null;
  passCount: number;
  isContra: boolean;
  isRecontra: boolean;

  // Playing specific
  trump: Suit | null;
  currentTrick: { playerIndex: number; card: Card }[];
  tricksCapturedByTeam: [number, number]; // [Team0(seats 0,2), Team1(seats 1,3)]

  // Declarations
  declarations: Declaration[];
  declarationPoints: [number, number]; // per team

  // Belot tracking (K+Q of trump)
  belotDeclared: boolean[];

  // Replay data
  initialHands?: Card[][];
  movesLog: MoveLogEntry[];
}
