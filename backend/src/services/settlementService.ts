import { prisma, io } from '../index';
import { GameState } from '../game/types';

export const settleMatch = async (matchId: string, gameState: GameState): Promise<void> => {
  // Determine winning team
  const pointsTeam0 = gameState.tricksCapturedByTeam[0];
  const pointsTeam1 = gameState.tricksCapturedByTeam[1];

  let winningTeamIndex = -1;
  if (pointsTeam0 > pointsTeam1) {
    winningTeamIndex = 0;
  } else if (pointsTeam1 > pointsTeam0) {
    winningTeamIndex = 1;
  }

  // Find match info
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { players: true }
  });

  if (!match) return;

  const totalPot = match.betAmount * 4;
  const platformCommissionPercentage = 0.05; // 5%
  const commission = totalPot * platformCommissionPercentage;
  const winningsPerPlayer = (totalPot - commission) / 2;

  // In a real application, you would interact with TON blockchain or Telegram Stars API here.
  // For now, we update the virtual balances and create Transaction records.

  await prisma.$transaction(async (tx) => {
     // Record commission
     await tx.transaction.create({
       data: {
          userId: match.players[0].userId, // Placeholder: tie commission to system admin ideally
          matchId: match.id,
          amount: commission,
          currency: match.betCurrency,
          type: 'COMMISSION'
       }
     });

     for (const player of match.players) {
       const isWinner = winningTeamIndex === -1 ? true : (player.seatIndex % 2 === winningTeamIndex);
       
       if (isWinner) {
         // This is a DRAW if winningTeamIndex -1, refund or handle gracefully.
         // Here we assume winningTeamIndex is valid.
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
     points: gameState.tricksCapturedByTeam
  });
};
