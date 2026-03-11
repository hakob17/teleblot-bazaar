import {
  ALL_RANKS, ALL_SUITS, Card, GameState, PlayerState, Bid,
  TRUMP_HIERARCHY, NON_TRUMP_HIERARCHY, TRUMP_VALUES, NON_TRUMP_VALUES,
  Suit, Rank, MoveLogEntry, Declaration, DeclarationType, SEQUENCE_RANK_ORDER
} from './types';

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
    const initialHands: Card[][] = [];
    const players: PlayerState[] = playerIds.map((userId, index) => {
      const hand = deck.slice(index * 8, index * 8 + 8);
      initialHands.push([...hand]);
      return {
        userId,
        hand,
        pointsCaptured: 0,
        tricksTaken: 0
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
      isContra: false,
      isRecontra: false,
      trump: null,
      currentTrick: [],
      tricksCapturedByTeam: [0, 0],
      declarations: [],
      declarationPoints: [0, 0],
      belotDeclared: [false, false, false, false],
      initialHands,
      movesLog: []
    };
  }

  // ===================== AUCTION =====================

  static handleBid(state: GameState, playerIndex: number, bid: Bid): GameState {
    if (state.phase !== 'AUCTION') throw new Error("Not in auction phase");
    if (state.currentTurnIndex !== playerIndex) throw new Error("Not your turn");

    const newState = structuredClone(state);
    newState.movesLog.push({ type: 'bid', playerIndex, bid: { ...bid, playerIndex } });

    if (bid.isPass) {
      newState.passCount++;
      newState.bids.push({ ...bid, playerIndex });
    } else if (bid.isContra) {
      // Contra can be made by opponent team on the current winning bid
      if (!newState.winningBid) throw new Error("Cannot Contra without a bid");
      if (newState.winningBid.playerIndex % 2 === playerIndex % 2) throw new Error("Cannot Contra own team's bid");
      if (newState.isContra) throw new Error("Already Contra'd");

      newState.isContra = true;
      newState.bids.push({ ...bid, playerIndex });

      // Contra ends auction — opponent can only Recontra
      // Give the bidding team's partner a chance to Recontra
      // Actually per rules: Contra ends trade, opponent can only answer Recontra
      // We'll transition to playing unless Recontra is declared
      // For simplicity: set a flag and let the next turn be for the bid-winning team
      newState.currentTurnIndex = newState.winningBid.playerIndex;
      return newState;

    } else if (bid.isRecontra) {
      if (!newState.isContra) throw new Error("Can only Recontra after a Contra");
      if (newState.isRecontra) throw new Error("Already Recontra'd");
      // Must be from the team whose bid was Contra'd
      if (!newState.winningBid || newState.winningBid.playerIndex % 2 !== playerIndex % 2) {
        throw new Error("Only the bid-winning team can Recontra");
      }

      newState.isRecontra = true;
      newState.bids.push({ ...bid, playerIndex });

      // Recontra ends auction, move to playing
      newState.phase = 'PLAYING';
      newState.trump = newState.winningBid!.suit;
      newState.currentTurnIndex = (newState.dealerIndex + 1) % 4;
      this.detectDeclarations(newState);
      return newState;

    } else {
      // Normal bid
      if (newState.isContra) {
        // After Contra, only Recontra or Pass is allowed (no new bids)
        throw new Error("After Contra, you can only Recontra or Pass");
      }

      // After Kaput, only Kaput bids allowed
      if (newState.winningBid && newState.winningBid.amount === 25 && bid.amount !== 25) {
        throw new Error("After Kaput declaration, only Kaput bids are allowed");
      }

      if (newState.winningBid) {
        // Partner can raise by bidding same suit with higher number
        const isPartnerBid = newState.winningBid.playerIndex % 2 === playerIndex % 2;
        if (isPartnerBid) {
          // Partner must bid same suit and higher amount
          if (bid.suit !== newState.winningBid.suit) {
            throw new Error("Must bid the same suit as your partner");
          }
          if (bid.amount <= newState.winningBid.amount) {
            throw new Error("Must bid higher than partner's bid");
          }
        } else {
          // Opponent must bid strictly higher
          if (bid.amount <= newState.winningBid.amount && bid.amount !== 25) {
            throw new Error("Bid must be strictly higher than the current winning bid");
          }
        }
      } else {
        if (bid.amount < 8) {
          throw new Error("Initial bid must be at least 8");
        }
      }

      newState.passCount = 0;
      newState.winningBid = { ...bid, playerIndex };
      newState.bids.push({ ...bid, playerIndex });
    }

    // Check auction end conditions
    if (newState.passCount === 4 && !newState.winningBid) {
      // Everyone passed on first round: re-deal
      return this.initializeGame(newState.matchId, newState.players.map(p => p.userId));
    } else if (newState.passCount === 3 && newState.winningBid) {
      // 3 passes after a bid → Auction won
      newState.phase = 'PLAYING';
      newState.trump = newState.winningBid.suit;
      newState.currentTurnIndex = (newState.dealerIndex + 1) % 4;
      this.detectDeclarations(newState);
    } else if (newState.isContra && bid.isPass) {
      // After Contra, if the bid-winning team passes (doesn't Recontra), auction ends
      newState.phase = 'PLAYING';
      newState.trump = newState.winningBid!.suit;
      newState.currentTurnIndex = (newState.dealerIndex + 1) % 4;
      this.detectDeclarations(newState);
    } else {
      newState.currentTurnIndex = (newState.currentTurnIndex + 1) % 4;
    }

    return newState;
  }

  // ===================== DECLARATIONS =====================

  static detectDeclarations(state: GameState): void {
    if (!state.trump) return;

    const allDeclarations: Declaration[] = [];

    for (let pi = 0; pi < 4; pi++) {
      const hand = state.players[pi].hand;

      // Detect sequences (tertz, fifty, hundred) per suit
      for (const suit of ALL_SUITS) {
        const suitCards = hand
          .filter(c => c.suit === suit)
          .sort((a, b) => SEQUENCE_RANK_ORDER.indexOf(a.rank) - SEQUENCE_RANK_ORDER.indexOf(b.rank));

        if (suitCards.length < 3) continue;

        // Find consecutive runs
        let runStart = 0;
        for (let i = 1; i <= suitCards.length; i++) {
          const prevIdx = SEQUENCE_RANK_ORDER.indexOf(suitCards[i - 1].rank);
          const curIdx = i < suitCards.length ? SEQUENCE_RANK_ORDER.indexOf(suitCards[i].rank) : -1;

          if (curIdx !== prevIdx + 1 || i === suitCards.length) {
            const runLen = i - runStart;
            if (runLen >= 3) {
              const runCards = suitCards.slice(runStart, i);
              let type: DeclarationType;
              let points: number;
              if (runLen >= 5) { type = 'HUNDRED'; points = 100; }
              else if (runLen === 4) { type = 'FIFTY'; points = 50; }
              else { type = 'TERTZ'; points = 20; }

              allDeclarations.push({ type, playerIndex: pi, cards: runCards, points });
            }
            runStart = i;
          }
        }
      }

      // Detect four of a kind
      const rankCounts: Partial<Record<Rank, Card[]>> = {};
      for (const card of hand) {
        if (!rankCounts[card.rank]) rankCounts[card.rank] = [];
        rankCounts[card.rank]!.push(card);
      }
      for (const rank of ['J', '9', 'A', '10', 'K', 'Q'] as Rank[]) {
        if (rankCounts[rank]?.length === 4) {
          let type: DeclarationType;
          let points: number;
          if (rank === 'J') { type = 'FOUR_JACKS'; points = 200; }
          else if (rank === '9') { type = 'FOUR_NINES'; points = 150; }
          else { type = 'FOUR_ACES'; points = 100; } // reuse type for display
          if (rank === '10') type = 'FOUR_TENS';
          if (rank === 'K') type = 'FOUR_KINGS';
          if (rank === 'Q') type = 'FOUR_QUEENS';

          allDeclarations.push({ type, playerIndex: pi, cards: rankCounts[rank]!, points });
        }
      }

      // Detect Belot (K + Q of trump)
      const hasKingOfTrump = hand.some(c => c.suit === state.trump && c.rank === 'K');
      const hasQueenOfTrump = hand.some(c => c.suit === state.trump && c.rank === 'Q');
      if (hasKingOfTrump && hasQueenOfTrump) {
        allDeclarations.push({
          type: 'BELOT',
          playerIndex: pi,
          cards: hand.filter(c => c.suit === state.trump && (c.rank === 'K' || c.rank === 'Q')),
          points: 20
        });
      }
    }

    // Resolve which team's declarations count
    // Belot always counts regardless
    // For other declarations: only the team with the highest single declaration scores
    const belots = allDeclarations.filter(d => d.type === 'BELOT');
    const nonBelots = allDeclarations.filter(d => d.type !== 'BELOT');

    // Find highest non-belot declaration
    const team0Best = nonBelots
      .filter(d => d.playerIndex % 2 === 0)
      .sort((a, b) => this.compareDeclarations(b, a))[0];

    const team1Best = nonBelots
      .filter(d => d.playerIndex % 2 === 1)
      .sort((a, b) => this.compareDeclarations(b, a))[0];

    let winningTeam = -1;
    if (team0Best && team1Best) {
      const cmp = this.compareDeclarations(team0Best, team1Best);
      winningTeam = cmp > 0 ? 0 : cmp < 0 ? 1 : -1;
      // If equal and one is trump, trump wins
      if (cmp === 0) {
        const t0InTrump = team0Best.cards[0].suit === state.trump;
        const t1InTrump = team1Best.cards[0].suit === state.trump;
        if (t0InTrump && !t1InTrump) winningTeam = 0;
        else if (t1InTrump && !t0InTrump) winningTeam = 1;
        // else truly equal, first to play wins (team of player left of dealer)
        else winningTeam = (state.dealerIndex + 1) % 2;
      }
    } else if (team0Best) {
      winningTeam = 0;
    } else if (team1Best) {
      winningTeam = 1;
    }

    const scoringDeclarations: Declaration[] = [];

    // Add all declarations from winning team (non-belot)
    if (winningTeam >= 0) {
      scoringDeclarations.push(...nonBelots.filter(d => d.playerIndex % 2 === winningTeam));
    }

    // Belot always counts
    scoringDeclarations.push(...belots);

    state.declarations = scoringDeclarations;

    // Calculate declaration points per team
    for (const decl of scoringDeclarations) {
      const team = decl.playerIndex % 2;
      state.declarationPoints[team] += decl.points;
    }
  }

  static compareDeclarations(a: Declaration, b: Declaration): number {
    // Four of a kind > any sequence
    const aIsFour = a.type.startsWith('FOUR_');
    const bIsFour = b.type.startsWith('FOUR_');
    if (aIsFour && !bIsFour) return 1;
    if (!aIsFour && bIsFour) return -1;
    if (aIsFour && bIsFour) return a.points - b.points;

    // Both sequences: compare by length, then by highest card
    if (a.points !== b.points) return a.points - b.points;

    // Same length sequence: compare highest card rank
    const aHighest = SEQUENCE_RANK_ORDER.indexOf(a.cards[0].rank);
    const bHighest = SEQUENCE_RANK_ORDER.indexOf(b.cards[0].rank);
    return bHighest - aHighest; // Lower index = higher rank
  }

  // ===================== CARD PLAY =====================

  static isTrumpStrictlyGreater(card1: Card, card2: Card): boolean {
    return TRUMP_HIERARCHY[card1.rank] > TRUMP_HIERARCHY[card2.rank];
  }

  static calculateTrickWinner(trick: { playerIndex: number; card: Card }[], trump: Suit): number {
    const ledCard = trick[0].card;
    let winningIndex = 0;

    for (let i = 1; i < trick.length; i++) {
      const c1 = trick[i].card;
      const w1 = trick[winningIndex].card;

      if (c1.suit === trump && w1.suit !== trump) {
        winningIndex = i;
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

    const ledCard = newState.currentTrick.length > 0 ? newState.currentTrick[0].card : null;

    if (ledCard) {
      const hasSuit = player.hand.some(c => c.suit === ledCard.suit);

      if (hasSuit) {
        // Must follow suit
        if (card.suit !== ledCard.suit) {
          throw new Error("Must follow suit");
        }

        // If trump is led, must play higher trump if possible (even over partner)
        if (ledCard.suit === newState.trump) {
          const highestTrumpInTrick = newState.currentTrick
            .filter(t => t.card.suit === newState.trump)
            .sort((a, b) => TRUMP_HIERARCHY[b.card.rank] - TRUMP_HIERARCHY[a.card.rank])[0];

          if (highestTrumpInTrick && !this.isTrumpStrictlyGreater(card, highestTrumpInTrick.card)) {
            const hasHigher = player.hand.some(c =>
              c.suit === newState.trump && this.isTrumpStrictlyGreater(c, highestTrumpInTrick.card)
            );
            if (hasHigher) {
              throw new Error("Must play a higher trump card when trump is led");
            }
          }
        }
      } else {
        // Cannot follow suit
        if (ledCard.suit !== newState.trump) {
          // Non-trump suit was led and we can't follow
          const hasTrump = player.hand.some(c => c.suit === newState.trump);

          if (hasTrump) {
            // Check if opponent is currently winning
            const currentWinnerId = this.calculateTrickWinner(newState.currentTrick, newState.trump!);
            const opponentWinning = currentWinnerId % 2 !== playerIndex % 2;

            if (opponentWinning) {
              // Check if any trump in trick
              const highestTrumpInTrick = newState.currentTrick
                .filter(t => t.card.suit === newState.trump)
                .sort((a, b) => TRUMP_HIERARCHY[b.card.rank] - TRUMP_HIERARCHY[a.card.rank])[0];

              if (highestTrumpInTrick) {
                // Opponent has trumped - can we beat their trump?
                const canBeatTrump = player.hand.some(c =>
                  c.suit === newState.trump && this.isTrumpStrictlyGreater(c, highestTrumpInTrick.card)
                );

                if (canBeatTrump) {
                  // Must overtrump
                  if (card.suit !== newState.trump || !this.isTrumpStrictlyGreater(card, highestTrumpInTrick.card)) {
                    const hasOvertrump = player.hand.some(c =>
                      c.suit === newState.trump && this.isTrumpStrictlyGreater(c, highestTrumpInTrick.card)
                    );
                    if (hasOvertrump) {
                      throw new Error("Must play a trump that beats the opponent's trump");
                    }
                  }
                } else {
                  // Can't beat opponent's trump - can play any card (per Bazar Blot rules)
                  // No restriction
                }
              } else {
                // Opponent winning with non-trump, must trump
                if (card.suit !== newState.trump) {
                  throw new Error("Must trump when opponent is winning the trick");
                }
              }
            }
            // Partner winning → free to trump or discard any card
          }
          // No trump cards → can play anything
        }
        // Trump suit was led but we have no trump → can play anything
      }
    }

    // Play the card
    newState.movesLog.push({ type: 'play', playerIndex, card });
    newState.currentTrick.push({ playerIndex, card });
    player.hand.splice(cardIndex, 1);

    // Check for Belot declaration (K or Q of trump played)
    if (card.suit === newState.trump && (card.rank === 'K' || card.rank === 'Q')) {
      const hasBelot = newState.declarations.some(d =>
        d.type === 'BELOT' && d.playerIndex === playerIndex
      );
      if (hasBelot && !newState.belotDeclared[playerIndex]) {
        newState.belotDeclared[playerIndex] = true;
      }
    }

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

      // +10 for last trick (Dix de Der)
      const isLastTrick = player.hand.length === 0;
      if (isLastTrick) {
        trickPoints += 10;
      }

      newState.players[winnerIndex].pointsCaptured += trickPoints;
      newState.players[winnerIndex].tricksTaken++;
      const teamIndex = winnerIndex % 2;
      newState.tricksCapturedByTeam[teamIndex] += trickPoints;

      newState.currentTrick = [];
      newState.currentTurnIndex = winnerIndex;

      if (isLastTrick) {
        newState.phase = 'FINISHED';
      }
    } else {
      newState.currentTurnIndex = (newState.currentTurnIndex + 1) % 4;
    }

    return newState;
  }

  // ===================== SCORING =====================

  /**
   * Calculate final scores for a finished hand.
   * Returns [team0Score, team1Score] in "small points".
   *
   * Rules:
   * - Total trick points = 162 (= 16 small points)
   * - The bidding team must earn >= their bid to succeed
   * - On failure (dedans): opponents get all 16 + declaration points
   * - Kaput (bid=25): bidding team must take ALL 8 tricks
   * - Contra doubles, Recontra quadruples
   * - Declarations add to team totals
   * - Belot (20 large) always counts
   *
   * The "small points" system: total 162 large = 16 small
   * Each team's small points = Math.round(largePoints / 10)
   * But for simplicity we track large points and convert at the end.
   */
  static calculateHandScore(state: GameState): {
    team0Score: number;
    team1Score: number;
    biddingTeamWon: boolean;
  } {
    if (state.phase !== 'FINISHED' || !state.winningBid) {
      throw new Error("Game is not finished");
    }

    const bid = state.winningBid;
    const biddingTeam = bid.playerIndex % 2;
    const defendingTeam = 1 - biddingTeam;

    const trickPoints: [number, number] = [...state.tricksCapturedByTeam];
    const declPoints: [number, number] = [...state.declarationPoints];

    // Total large points per team (tricks + declarations)
    const totalLarge: [number, number] = [
      trickPoints[0] + declPoints[0],
      trickPoints[1] + declPoints[1]
    ];

    // Check Kaput
    const isKaput = bid.amount === 25;
    let biddingTeamWon: boolean;

    if (isKaput) {
      // Must take all 8 tricks
      const biddingTeamTricks = state.players
        .filter((_, i) => i % 2 === biddingTeam)
        .reduce((sum, p) => sum + p.tricksTaken, 0);
      biddingTeamWon = biddingTeamTricks === 8;
    } else {
      // Bidding team needs more points than defending team
      biddingTeamWon = totalLarge[biddingTeam] > totalLarge[defendingTeam];
    }

    // Calculate small points
    let team0Score: number;
    let team1Score: number;

    if (biddingTeamWon) {
      if (isKaput) {
        // Kaput success = 25 small points
        team0Score = biddingTeam === 0 ? 25 : 0;
        team1Score = biddingTeam === 1 ? 25 : 0;
      } else {
        // Both teams score their points (rounded to small)
        team0Score = Math.round(totalLarge[0] / 10);
        team1Score = Math.round(totalLarge[1] / 10);
      }
    } else {
      // Dedans: bidding team gets 0, defending team gets everything
      if (isKaput) {
        // Failed Kaput = opponents get 25
        team0Score = biddingTeam === 0 ? 0 : 25;
        team1Score = biddingTeam === 1 ? 0 : 25;
      } else {
        const allPoints = totalLarge[0] + totalLarge[1];
        team0Score = biddingTeam === 0 ? 0 : Math.round(allPoints / 10);
        team1Score = biddingTeam === 1 ? 0 : Math.round(allPoints / 10);
      }
    }

    // Apply multipliers
    let multiplier = 1;
    if (state.isContra) multiplier = 2;
    if (state.isRecontra) multiplier = 4;

    team0Score *= multiplier;
    team1Score *= multiplier;

    return { team0Score, team1Score, biddingTeamWon };
  }
}
