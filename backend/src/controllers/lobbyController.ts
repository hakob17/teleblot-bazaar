import { Request, Response } from 'express';
import { prisma, io } from '../index';
import { getMatchFancyNames } from '../game/fancyNames';

export const getLobbies = async (req: Request, res: Response): Promise<void> => {
  try {
    const lobbies = await prisma.match.findMany({
      where: {
        status: 'WAITING'
      },
      include: {
        players: {
          include: {
            user: {
              select: { id: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Add fancy names and strip real identities
    const lobbiesWithNames = lobbies.map(lobby => ({
      ...lobby,
      fancyNames: getMatchFancyNames(lobby.id),
      players: lobby.players.map(p => ({
        ...p,
        user: { id: p.user.id }
      }))
    }));

    res.json(lobbiesWithNames);
  } catch (error) {
    console.error('Error fetching lobbies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createLobby = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { betAmount, betCurrency } = req.body;

    if (!betAmount || !betCurrency) {
       res.status(400).json({ error: 'betAmount and betCurrency are required' });
       return;
    }

    const match = await prisma.match.create({
      data: {
        betAmount,
        betCurrency,
        status: 'WAITING',
        players: {
          create: {
            userId,
            seatIndex: 0
          }
        }
      },
      include: {
        players: {
          include: { user: { select: { id: true } } }
        }
      }
    });

    // Notify all players in 'lobbies' channel
    io.to('lobbies').emit('lobbyCreated', match);

    res.json(match);
  } catch (error) {
    console.error('Error creating lobby:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const joinLobby = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { matchId } = req.body;

    if (!matchId) {
       res.status(400).json({ error: 'matchId is required' });
       return;
    }

    // Use transaction to avoid race conditions
    const result = await prisma.$transaction(async (tx: any) => {
      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: { players: true }
      });

      if (!match) throw new Error('Match not found');
      if (match.status !== 'WAITING') throw new Error('Match is no longer waiting');
      if (match.players.length >= 4) throw new Error('Match is full');
      if (match.players.find((p: any) => p.userId === userId)) throw new Error('Already joined');

      // Find available seat index (0,1,2,3)
      const takenSeats = match.players.map((p: any) => p.seatIndex);
      let seatIndex = 0;
      while (takenSeats.includes(seatIndex)) {
        seatIndex++;
      }

      await tx.player.create({
        data: {
          userId,
          matchId,
          seatIndex
        }
      });

      const updatedPlayers = await tx.player.count({ where: { matchId } });
      let statusToUpdate = match.status;

      // If full, start the game (Auction phase)
      if (updatedPlayers === 4) {
        statusToUpdate = 'AUCTION';
        const playerIds = match.players.map((p: any) => p.userId);
        playerIds.push(userId); // Add the 4th player joining right now
        
        // Import must be added at top, but we'll deal with it or assume engine can be required.
        const { BazaarBlotEngine } = require('../game/engine');
        const initialState = BazaarBlotEngine.initializeGame(matchId, playerIds);
        
        await tx.match.update({
          where: { id: matchId },
          data: { 
             status: statusToUpdate,
             stateJson: JSON.stringify(initialState)
          }
        });
      }

      return tx.match.findUnique({
        where: { id: matchId },
        include: {
          players: {
            include: { user: { select: { id: true } } }
          }
        }
      });
    });

    // Notify lobby list
    io.to('lobbies').emit('lobbyUpdated', result);
    // Notify users inside this match room
    io.to(`match_${matchId}`).emit('matchStateUpdated', result);

    res.json(result);
  } catch (error: any) {
    console.error('Error joining lobby:', error);
    res.status(400).json({ error: error.message || 'Internal server error' });
  }
};
