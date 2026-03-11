import { Request, Response } from 'express';
import { prisma, io } from '../index';
import { BazaarBlotEngine } from '../game/engine';
import { Bid, Card, GameState } from '../game/types';

export const submitBid = async (req: Request, res: Response): Promise<void> => {
   try {
     const userId = (req as any).user?.userId;
     const { matchId, bid } = req.body as { matchId: string, bid: Omit<Bid, 'playerIndex'> };

     const result = await prisma.$transaction(async (tx: any) => {
         const match = await tx.match.findUnique({ where: { id: matchId }, include: { players: true } });
         if (!match || !match.stateJson) throw new Error("Match not found or not initialized");

         let gameState: GameState = JSON.parse(match.stateJson);
         
         const playerIndex = match.players.find((p: any) => p.userId === userId)?.seatIndex;
         if (playerIndex === undefined) throw new Error("You are not part of this match");

         const newBid: Bid = { ...bid, playerIndex };
         gameState = BazaarBlotEngine.handleBid(gameState, playerIndex, newBid);

         await tx.match.update({
             where: { id: matchId },
             data: { 
                 stateJson: JSON.stringify(gameState),
                 status: gameState.phase
             }
         });

         return gameState;
     });

     io.to(`match_${matchId}`).emit('gameStateUpdated', result);
     res.json(result);
   } catch (error: any) {
     console.error("Bid error:", error);
     res.status(400).json({ error: error.message || "Internal error" });
   }
};

export const playCard = async (req: Request, res: Response): Promise<void> => {
   try {
     const userId = (req as any).user?.userId;
     const { matchId, card } = req.body as { matchId: string, card: Card };

     const result = await prisma.$transaction(async (tx: any) => {
         const match = await tx.match.findUnique({ where: { id: matchId }, include: { players: true } });
         if (!match || !match.stateJson) throw new Error("Match not found or not initialized");

         let gameState: GameState = JSON.parse(match.stateJson);
         
         const playerIndex = match.players.find((p: any) => p.userId === userId)?.seatIndex;
         if (playerIndex === undefined) throw new Error("You are not part of this match");

         gameState = BazaarBlotEngine.playCard(gameState, playerIndex, card);

         await tx.match.update({
             where: { id: matchId },
             data: { 
                 stateJson: JSON.stringify(gameState),
                 status: gameState.phase
             }
         });

         if (gameState.phase === 'FINISHED') {
             // Handle settlement!
             // E.g., distribute the pot based on points.
             // We will emit an event or call a separate service.
         }

         return gameState;
     });

     io.to(`match_${matchId}`).emit('gameStateUpdated', result);
     res.json(result);
   } catch (error: any) {
     console.error("Play card error:", error);
     res.status(400).json({ error: error.message || "Internal error" });
   }
};
