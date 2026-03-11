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

// Helper for sorting cards (hierarchy) inside Trump suit
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

// Helper for sorting cards (hierarchy) inside Non-Trump suit
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

export interface Bid {
  playerIndex: number;
  amount: number; // 8, 9, 10, ..., 16, 25 (Kaput)
  suit: Suit;
  isPass: boolean;
  isContra: boolean;
  isRecontra: boolean;
}

export interface PlayerState {
  userId: string;
  hand: Card[]; // Array of 8 cards
  pointsCaptured: number;
}

export interface GameState {
  matchId: string;
  phase: GamePhase;
  players: PlayerState[]; // Array of 4 players
  
  // Auction specific
  dealerIndex: number;
  currentTurnIndex: number;
  bids: Bid[];
  winningBid: Bid | null;
  passCount: number;

  // Playing specific
  trump: Suit | null;
  currentTrick: { playerIndex: number; card: Card }[];
  tricksCapturedByTeam: [number, number]; // [Team0_2, Team1_3]
}
