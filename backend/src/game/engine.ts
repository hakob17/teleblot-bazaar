import { ALL_RANKS, ALL_SUITS, Card, GamePhase, GameState, PlayerState, Bid, TRUMP_HIERARCHY, NON_TRUMP_HIERARCHY, TRUMP_VALUES, NON_TRUMP_VALUES, Suit } from './types';

export class BazaarBlotEngine {
  
  static createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        deck.push({ suit, rank });
      }
    }
    return deck;
  }

  static shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  static initializeGame(matchId: string, playerIds: string[]): GameState {
    if (playerIds.length !== 4) {
      throw new Error("Match requires exactly 4 players");
    }

    const deck = this.shuffleDeck(this.createDeck());
    const players: PlayerState[] = playerIds.map((userId, index) => {
      // Deal 8 cards to each player
      const hand = deck.slice(index * 8, index * 8 + 8);
      return {
        userId,
        hand,
        pointsCaptured: 0
      };
    });

    return {
      matchId,
      phase: 'AUCTION',
      players,
      dealerIndex: 0,
      currentTurnIndex: 1, // Player left of dealer starts
      bids: [],
      winningBid: null,
      passCount: 0,
      trump: null,
      currentTrick: [],
      tricksCapturedByTeam: [0, 0]
    };
  }

  static handleBid(state: GameState, playerIndex: number, bid: Bid): GameState {
    if (state.phase !== 'AUCTION') throw new Error("Not in auction phase");
    if (state.currentTurnIndex !== playerIndex) throw new Error("Not your turn");

    const newState = structuredClone(state);
    
    // Process the bid
    if (bid.isPass) {
      newState.passCount++;
      newState.bids.push({ ...bid, playerIndex });
    } else {
      // Validate Bid rules
      // (1) Must be higher than the current winning bid if it is a regular bid
      // (2) Handle Contra / Recontra
      if (bid.isContra) {
        if (!newState.winningBid) throw new Error("Cannot Contra an empty bid");
        if (newState.winningBid.playerIndex % 2 === playerIndex % 2) throw new Error("Cannot Contra own team");
        newState.bids.push({ ...bid, playerIndex });
        // Game essentially enters playing mode immediately or waits for Recontra/Pass
        // For simplicity: Contra ends auction unless Recontra happens next turn
        // Real Bazaar Blot rules might have nuances here, but we'll adapt.
      } else if (bid.isRecontra) {
        const lastBid = newState.bids[newState.bids.length - 1];
        if (!lastBid || !lastBid.isContra) throw new Error("Can only Recontra after a Contra");
        newState.bids.push({ ...bid, playerIndex });
        newState.phase = 'PLAYING';
        newState.trump = newState.winningBid!.suit;
        newState.currentTurnIndex = (newState.dealerIndex + 1) % 4;
        return newState;
      } else {
        // Normal bid
        if (newState.winningBid) {
          if (bid.amount <= newState.winningBid.amount && bid.amount !== 25 /* 25 = Kaput */) {
            throw new Error("Bid must be strictly higher than the current winning bid");
          }
        } else if (bid.amount < 8) {
             throw new Error("Initial bid must be at least 8");
        }
        
        newState.passCount = 0; // Reset pass count on a new valid bid
        newState.winningBid = { ...bid, playerIndex };
        newState.bids.push({ ...bid, playerIndex });
      }
    }

    // Checking Auction end conditions
    if (newState.passCount === 4 && newState.bids.length === 4) {
      // Everyone passed on first round: Re-deal required (Cancel or Reset game state)
      // We will reset game state
      return this.initializeGame(newState.matchId, newState.players.map(p => p.userId));
    } else if (newState.passCount === 3 && newState.winningBid) {
      // 3 passes after a bid -> Auction won
      newState.phase = 'PLAYING';
      newState.trump = newState.winningBid.suit;
      newState.currentTurnIndex = (newState.dealerIndex + 1) % 4; // Player left of dealer starts the play
    } else {
      newState.currentTurnIndex = (newState.currentTurnIndex + 1) % 4;
    }

    return newState;
  }

  static isTrumpStrictlyGreater(card1: Card, card2: Card): boolean {
    return TRUMP_HIERARCHY[card1.rank] > TRUMP_HIERARCHY[card2.rank];
  }

  static calculateTrickWinner(trick: { playerIndex: number; card: Card }[], trump: Suit): number {
    const ledCard = trick[0].card;
    let winningIndex = 0;
    
    for (let i = 1; i < trick.length; i++) {
        const curRecord = trick[i];
        const winningRecord = trick[winningIndex];

        const c1 = curRecord.card;
        const w1 = winningRecord.card;

        if (c1.suit === trump && w1.suit !== trump) {
            winningIndex = i; // Trump beats non-trump
        } else if (c1.suit === trump && w1.suit === trump) {
            if (this.isTrumpStrictlyGreater(c1, w1)) {
                 winningIndex = i;
            }
        } else if (c1.suit === ledCard.suit && w1.suit === ledCard.suit) {
             if (NON_TRUMP_HIERARCHY[c1.rank] > NON_TRUMP_HIERARCHY[w1.rank]) {
                 winningIndex = i;
             }
        }
    }
    return trick[winningIndex].playerIndex;
  }

  static playCard(state: GameState, playerIndex: number, card: Card): GameState {
     if (state.phase !== 'PLAYING') throw new Error("Not playing phase");
     if (state.currentTurnIndex !== playerIndex) throw new Error("Not your turn");

     const newState = structuredClone(state);
     const player = newState.players[playerIndex];

     // Validate card ownership
     const cardIndex = player.hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
     if (cardIndex === -1) throw new Error("You don't have this card");

     // --- RULES OF DRAWING Validation ---
     const ledCard = newState.currentTrick.length > 0 ? newState.currentTrick[0].card : null;
     
     if (ledCard) {
        const hasSuit = player.hand.some(c => c.suit === ledCard.suit);
        if (hasSuit && card.suit !== ledCard.suit) {
             throw new Error("Must follow suit");
        }

        if (!hasSuit && ledCard.suit !== newState.trump) {
             const hasTrump = player.hand.some(c => c.suit === newState.trump);
             // If opponent is winning, MUST trump if possible
             if (hasTrump) {
                 // Determine current winner
                 const currentWinnerId = this.calculateTrickWinner(newState.currentTrick, newState.trump!);
                 // If opposing team winning, MUST trump.
                 if (currentWinnerId % 2 !== playerIndex % 2 && card.suit !== newState.trump) {
                     throw new Error("Must trump if opponent is winning trick");
                 }

                 // Must beat highest trump if we are trumping
                 if (card.suit === newState.trump) {
                     const highestTrump = newState.currentTrick
                         .filter(t => t.card.suit === newState.trump)
                         .sort((a, b) => TRUMP_HIERARCHY[b.card.rank] - TRUMP_HIERARCHY[a.card.rank])[0];
                     
                     if (highestTrump && this.isTrumpStrictlyGreater(highestTrump.card, card)) {
                         // Check if we HAVE a higher trump
                         const hasHigherTrump = player.hand.some(c => 
                             c.suit === newState.trump && this.isTrumpStrictlyGreater(c, highestTrump.card)
                         );
                         if (hasHigherTrump) {
                              throw new Error("Must play a higher trump card");
                         }
                     }
                 }
             }
        }
     }

     // Play the card
     newState.currentTrick.push({ playerIndex, card });
     player.hand.splice(cardIndex, 1);

     if (newState.currentTrick.length === 4) {
         // Trick complete
         const winnerIndex = this.calculateTrickWinner(newState.currentTrick, newState.trump!);
         
         // Calculate points
         let trickPoints = 0;
         for (const t of newState.currentTrick) {
             trickPoints += (t.card.suit === newState.trump) 
                 ? TRUMP_VALUES[t.card.rank] 
                 : NON_TRUMP_VALUES[t.card.rank];
         }
         
         // 10 extra points for last trick
         if (player.hand.length === 0) {
             trickPoints += 10;
         }

         newState.players[winnerIndex].pointsCaptured += trickPoints;
         const teamIndex = winnerIndex % 2;
         newState.tricksCapturedByTeam[teamIndex] += trickPoints;

         newState.currentTrick = [];
         newState.currentTurnIndex = winnerIndex; // Winner leads next trick
         
         if (player.hand.length === 0) {
             // Game over
             newState.phase = 'FINISHED';
         }
     } else {
         newState.currentTurnIndex = (newState.currentTurnIndex + 1) % 4;
     }

     return newState;
  }
}
