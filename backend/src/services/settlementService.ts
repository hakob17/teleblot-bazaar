import { prisma, io } from '../index';
import { GameState } from '../game/types';
import { BazaarBlotEngine } from '../game/engine';

export const settleMatch = async (matchId: string, gameState: GameState): Promise<void> => {
  const { team0Score, team1Score, biddingTeamWon } = BazaarBlotEngine.calculateHandScore(gameState);

  // Determine winning team by trick points
  const pointsTeam0 = gameState.tricksCapturedByTeam[0];
  const pointsTeam1 = gameState.tricksCapturedByTeam[1];

  let winningTeamIndex = -1;
  if (pointsTeam0 > pointsTeam1) {
    winningTeamIndex = 0;
  } else if (pointsTeam1 > pointsTeam0) {
    winningTeamIndex = 1;
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { players: true }
  });

  if (!match) return;

  const totalPot = match.betAmount * 4;
  const platformCommissionPercentage = 0.05;
  const commission = totalPot * platformCommissionPercentage;
  const winningsPerPlayer = (totalPot - commission) / 2;

  await prisma.$transaction(async (tx: any) => {
    await tx.transaction.create({
      data: {
        userId: match.players[0].userId,
        matchId: match.id,
        amount: commission,
        currency: match.betCurrency,
        type: 'COMMISSION'
      }
    });

    for (const player of match.players) {
      const isWinner = winningTeamIndex === -1 ? true : (player.seatIndex % 2 === winningTeamIndex);

      if (isWinner) {
        const payout = winningTeamIndex === -1 ? match.betAmount : winningsPerPlayer;

        await tx.transaction.create({
          data: {
            userId: player.userId,
            matchId: match.id,
            amount: payout,
            currency: match.betCurrency,
            type: 'WINNINGS'
          }
        });

        if (match.betCurrency === 'STARS') {
          await tx.user.update({
            where: { id: player.userId },
            data: { starsBalance: { increment: payout } }
          });
        } else {
          await tx.user.update({
            where: { id: player.userId },
            data: { tonBalance: { increment: payout } }
          });
        }
      }
    }
  });

  io.to(`match_${matchId}`).emit('matchSettled', {
    winningTeamIndex,
    points: gameState.tricksCapturedByTeam,
    team0Score,
    team1Score,
    biddingTeamWon,
    declarations: gameState.declarations
  });
};
