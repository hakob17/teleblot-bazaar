import { Request, Response } from 'express';
import { prisma } from '../index';
import { getMatchFancyNames } from '../game/fancyNames';

export const getMyHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    const players = await prisma.player.findMany({
      where: { userId },
      include: {
        match: {
          include: {
            players: {
              include: {
                user: { select: { id: true } }
              }
            }
          }
        }
      },
      orderBy: { joinedAt: 'desc' },
      take: 50
    });

    const history = players
      .filter(p => p.match.status === 'FINISHED')
      .map(p => {
        const match = p.match;
        const fancyNames = getMatchFancyNames(match.id);
        let result: 'win' | 'loss' | 'draw' = 'draw';

        if (match.stateJson) {
          const state = JSON.parse(match.stateJson);
          const team0 = state.tricksCapturedByTeam[0];
          const team1 = state.tricksCapturedByTeam[1];
          const myTeam = p.seatIndex % 2;
          if (team0 !== team1) {
            const winningTeam = team0 > team1 ? 0 : 1;
            result = myTeam === winningTeam ? 'win' : 'loss';
          }
        }

        return {
          matchId: match.id,
          betAmount: match.betAmount,
          betCurrency: match.betCurrency,
          mySeatIndex: p.seatIndex,
          fancyNames,
          result,
          playedAt: match.updatedAt
        };
      });

    res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMatchReplay = async (req: Request, res: Response): Promise<void> => {
  try {
    const matchId = req.params.matchId as string;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        players: {
          include: {
            user: { select: { id: true } }
          },
          orderBy: { seatIndex: 'asc' }
        }
      }
    });

    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    if (match.status !== 'FINISHED') {
      res.status(400).json({ error: 'Match is not finished yet' });
      return;
    }

    if (!match.stateJson) {
      res.status(400).json({ error: 'No game state available' });
      return;
    }

    const gameState = JSON.parse(match.stateJson);
    const fancyNames = getMatchFancyNames(match.id);

    res.json({
      matchId: match.id,
      betAmount: match.betAmount,
      betCurrency: match.betCurrency,
      fancyNames,
      initialHands: gameState.initialHands,
      movesLog: gameState.movesLog,
      trump: gameState.trump,
      finalScores: gameState.tricksCapturedByTeam,
      winningBid: gameState.winningBid
    });
  } catch (error) {
    console.error('Error fetching replay:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
