import { Request, Response } from 'express';
import { prisma } from '../index';

export const depositStars = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }

    // In production, this would verify a Telegram Stars payment via the Bot API.
    // For now, we credit the balance directly.
    const user = await prisma.$transaction(async (tx: any) => {
      await tx.transaction.create({
        data: {
          userId,
          amount,
          currency: 'STARS',
          type: 'DEPOSIT'
        }
      });

      return tx.user.update({
        where: { id: userId },
        data: { starsBalance: { increment: amount } }
      });
    });

    res.json({ starsBalance: user.starsBalance, tonBalance: user.tonBalance });
  } catch (error) {
    console.error('Deposit stars error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const depositTon = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }

    // In production, this would verify an on-chain TON transaction.
    // For now, we credit the balance directly.
    const user = await prisma.$transaction(async (tx: any) => {
      await tx.transaction.create({
        data: {
          userId,
          amount,
          currency: 'TON',
          type: 'DEPOSIT'
        }
      });

      return tx.user.update({
        where: { id: userId },
        data: { tonBalance: { increment: amount } }
      });
    });

    res.json({ starsBalance: user.starsBalance, tonBalance: user.tonBalance });
  } catch (error) {
    console.error('Deposit TON error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json(transactions);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
