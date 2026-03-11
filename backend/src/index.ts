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
    origin: '*', // We'll restrict this in production
    methods: ['GET', 'POST']
  }
});

export const prisma = new PrismaClient();

import { login, getMe } from './controllers/authController';
import { requireAuth } from './middlewares/authMiddleware';
import { getLobbies, createLobby, joinLobby } from './controllers/lobbyController';
import { submitBid, playCard } from './controllers/gameController';

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

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // When a user selects to view the lobby list
  socket.on('joinLobbyRoom', () => {
    socket.join('lobbies');
  });

  // When a user enters a specific match waiting room
  socket.on('joinMatchRoom', (matchId: string) => {
    socket.join(`match_${matchId}`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Export io so controllers can emit events
export { io };

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
