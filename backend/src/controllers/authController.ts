import { Request, Response } from 'express';
import { validateTelegramWebAppData, parseTelegramUser } from '../auth';
import { prisma } from '../index';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { initData } = req.body;

    if (!initData) {
      res.status(400).json({ error: 'initData is required' });
      return;
    }

    const isValid = validateTelegramWebAppData(initData, BOT_TOKEN);
    // In dev mode, we might want to bypass strict verification if testing without real telegram
    // if (!isValid && process.env.NODE_ENV === 'production') {
    //   res.status(401).json({ error: 'Invalid initData' });
    //   return;
    // }

    const tgUser = parseTelegramUser(initData);
    if (!tgUser || !tgUser.id) {
       res.status(400).json({ error: 'Failed to parse user from initData' });
       return;
    }

    // Upsert user in database
    const user = await prisma.user.upsert({
      where: { telegramId: String(tgUser.id) },
      update: {
        username: tgUser.username || null,
      },
      create: {
        telegramId: String(tgUser.id),
        username: tgUser.username || null,
      }
    });

    const token = jwt.sign({ userId: user.id, telegramId: user.telegramId }, JWT_SECRET, {
      expiresIn: '24h'
    });

    res.json({ token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
       res.status(401).json({ error: 'Unauthorized' });
       return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
       res.status(404).json({ error: 'User not found' });
       return;
    }

    res.json(user);
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
