import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

export const prisma = new PrismaClient();

import { login, getMe } from './controllers/authController';
import { requireAuth } from './middlewares/authMiddleware';
import { getLobbies, createLobby, joinLobby } from './controllers/lobbyController';
import { submitBid, playCard } from './controllers/gameController';
import { getMyHistory, getMatchReplay } from './controllers/statsController';
import { depositStars, depositTon, getTransactions } from './controllers/walletController';
import { getLeaderboard } from './controllers/leaderboardController';

app.get('/', (req, res) => {
  res.send('Bazaar Blot Backend API is running');
});

// Authentication Routes
app.post('/api/auth/login', login);
app.get('/api/auth/me', requireAuth, getMe);

// Lobby Routes
app.get('/api/lobbies', requireAuth, getLobbies);
app.post('/api/lobbies', requireAuth, createLobby);
app.post('/api/lobbies/join', requireAuth, joinLobby);

// Game Routes
app.post('/api/game/bid', requireAuth, submitBid);
app.post('/api/game/play', requireAuth, playCard);

// Stats & Replay Routes
app.get('/api/matches/history', requireAuth, getMyHistory);
app.get('/api/matches/:matchId/replay', requireAuth, getMatchReplay);

// Wallet Routes
app.post('/api/wallet/deposit/stars', requireAuth, depositStars);
app.post('/api/wallet/deposit/ton', requireAuth, depositTon);
app.get('/api/wallet/transactions', requireAuth, getTransactions);

// Leaderboard Routes
app.get('/api/leaderboard', requireAuth, getLeaderboard);

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('joinLobbyRoom', () => {
    socket.join('lobbies');
  });

  socket.on('joinMatchRoom', (matchId: string) => {
    socket.join(`match_${matchId}`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

export { io };

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
