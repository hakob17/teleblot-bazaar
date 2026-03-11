# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Teleblot is a Telegram Mini App for playing "Bazaar Blot" (a trick-taking card game) with monetary betting. It's a monorepo with separate `backend/` and `frontend/` directories.

## Commands

### Backend (`cd backend`)
- `npm run dev` — Dev server with hot reload (nodemon + ts-node)
- `npm run build` — Compile TypeScript to `dist/`
- `npm start` — Run Prisma migrations then start compiled server
- `npx prisma migrate dev` — Create/apply DB migrations
- `npx prisma generate` — Regenerate Prisma client after schema changes

### Frontend (`cd frontend`)
- `npm run dev` — Vite dev server with HMR
- `npm run build` — TypeScript check + production build
- `npm run lint` — ESLint
- `npm run preview` — Serve production build locally

### Root
- `npm run build` — Build backend
- `npm start` — Start backend

## Architecture

**Backend**: Express 5 + TypeScript, PostgreSQL via Prisma ORM, Socket.io for real-time game state.

**Frontend**: React 19 + TypeScript + Vite, Tailwind CSS, Telegram Web App SDK (`@twa-dev/sdk`), TON Connect for blockchain wallet integration, Framer Motion.

### Auth Flow
Telegram Web App `initData` → POST `/api/auth/login` → backend validates signature with Bot Token → returns JWT → frontend uses JWT for all subsequent requests.

### Real-time Communication
Socket.io rooms: `lobbies` (lobby list updates), `match_{matchId}` (game state broadcasts). Server emits `gameStateUpdated` after each action; clients re-render from server-authoritative state.

### Game Engine (`backend/src/game/engine.ts`)
`BazaarBlotEngine` is a pure logic class handling the full game lifecycle: deck creation → dealing → auction (bids 8-16, Kaput=25, Contra/Recontra) → trick-based play → scoring. All state stored as JSON in `Match.stateJson`. Three phases: AUCTION → PLAYING → FINISHED.

Card values differ between trump and non-trump suits (e.g., trump Jack=20, trump 9=14 vs non-trump Jack=2, non-trump 9=0). +10 bonus for last trick.

### Key Modules
- `backend/src/index.ts` — Express app, routes, Socket.io event handlers
- `backend/src/controllers/` — `authController`, `lobbyController`, `gameController`
- `backend/src/services/settlementService.ts` — Payout calculation (5% platform commission)
- `backend/prisma/schema.prisma` — User, Match, Player, Transaction models
- `frontend/src/context/AuthContext.tsx` — Telegram login + JWT state
- `frontend/src/context/SocketContext.tsx` — Socket.io connection management
- `frontend/src/views/GameView.tsx` — Main game UI
- `frontend/src/views/LobbyView.tsx` — Match creation/joining

### Database Models
- **User**: Telegram user with Stars/TON balances
- **Match**: Game session (status: WAITING → AUCTION → PLAYING → FINISHED), stores game state as JSON
- **Player**: Seat assignment (0-3) linking User to Match
- **Transaction**: All financial operations (bets, winnings, commissions)

## Environment Variables

**Backend** (`.env`): `DATABASE_URL`, `JWT_SECRET`, `BOT_TOKEN`, `PORT` (default 3001)

**Frontend** (`.env.production`): `VITE_API_URL` (backend URL)

Frontend supports mock Telegram auth in development mode.
