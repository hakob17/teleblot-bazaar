import { Request, Response } from 'express';
import { prisma } from '../index';

export const getLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get all finished matches with their players and states
    const finishedMatches = await prisma.match.findMany({
      where: { status: 'FINISHED' },
      include: {
        players: {
          include: {
            user: { select: { id: true, username: true } }
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 200
    });

    // Aggregate stats per user
    const statsMap = new Map<string, {
      oddsId: string; // For display without revealing telegram info
      wins: number;
      losses: number;
      draws: number;
      totalEarnings: number;
      gamesPlayed: number;
    }>();

    for (const match of finishedMatches) {
      if (!match.stateJson) continue;
      const state = JSON.parse(match.stateJson);
      const team0 = state.tricksCapturedByTeam[0];
      const team1 = state.tricksCapturedByTeam[1];

      for (const player of match.players) {
        const uid = player.userId;
        if (!statsMap.has(uid)) {
          statsMap.set(uid, {
            oddsId: uid.slice(0, 8),
            wins: 0,
            losses: 0,
            draws: 0,
            totalEarnings: 0,
            gamesPlayed: 0
          });
        }
        const stats = statsMap.get(uid)!;
        stats.gamesPlayed++;

        const myTeam = player.seatIndex % 2;
        if (team0 === team1) {
          stats.draws++;
        } else {
          const winningTeam = team0 > team1 ? 0 : 1;
          if (myTeam === winningTeam) {
            stats.wins++;
            const commission = match.betAmount * 4 * 0.05;
            stats.totalEarnings += (match.betAmount * 4 - commission) / 2 - match.betAmount;
          } else {
            stats.losses++;
            stats.totalEarnings -= match.betAmount;
          }
        }
      }
    }

    const leaderboard = Array.from(statsMap.entries())
      .map(([userId, stats]) => ({
        oddsId: stats.oddsId,
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        gamesPlayed: stats.gamesPlayed,
        totalEarnings: Math.round(stats.totalEarnings * 100) / 100,
        winRate: stats.gamesPlayed > 0
          ? Math.round((stats.wins / stats.gamesPlayed) * 100)
          : 0
      }))
      .sort((a, b) => b.wins - a.wins || b.totalEarnings - a.totalEarnings)
      .slice(0, 50);

    res.json(leaderboard);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
