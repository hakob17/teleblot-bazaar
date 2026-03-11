import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import PlayingCard from '../components/PlayingCard';
import SuitIcon from '../components/SuitIcon';
import { getMatchFancyNames } from '../utils/fancyNames';
import { apiFetch } from '../utils/api';

const GameView: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const { user, token } = useAuth();
  const { socket, joinMatchRoom } = useSocket();
  const navigate = useNavigate();

  const [gameState, setGameState] = useState<any>(null);
  const [lobbyState, setLobbyState] = useState<any>(null);
  const [mySeatIndex, setMySeatIndex] = useState<number | null>(null);
  const [settleResult, setSettleResult] = useState<any>(null);

  const fancyNames = matchId ? getMatchFancyNames(matchId) : ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

  const processMatchState = useCallback((match: any) => {
    setLobbyState(match);
    if (match.stateJson) {
      const parsed = JSON.parse(match.stateJson);
      setGameState(parsed);
      if (user) {
        const me = parsed.players.find((p: any) => p.userId === user.id);
        if (me) {
          setMySeatIndex(parsed.players.indexOf(me));
        }
      }
    }
  }, [user]);

  // Fetch initial match state via REST API
  useEffect(() => {
    if (!matchId || !token) return;
    apiFetch(`/api/matches/${matchId}`, token)
      .then(processMatchState)
      .catch(err => console.error('Failed to fetch match:', err));
  }, [matchId, token, processMatchState]);

  // Listen for real-time updates via socket
  useEffect(() => {
    if (!matchId) return;
    joinMatchRoom(matchId);

    if (socket) {
      socket.on('matchStateUpdated', processMatchState);

      socket.on('gameStateUpdated', (state) => {
        setGameState(state);
      });

      socket.on('matchSettled', (result) => {
        setSettleResult(result);
      });
    }

    return () => {
      if (socket) {
        socket.off('matchStateUpdated');
        socket.off('gameStateUpdated');
        socket.off('matchSettled');
      }
    };
  }, [socket, matchId, joinMatchRoom, processMatchState]);

  const handlePlayCard = async (card: any) => {
    if (gameState?.phase !== 'PLAYING' || gameState?.currentTurnIndex !== mySeatIndex) return;
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    try {
      await fetch(`${API_URL}/api/game/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matchId, card })
      });
    } catch (err) {
      console.error("Play failed", err);
    }
  };

  const handleBid = async (amount: number, suit: string, isPass: boolean, isContra: boolean, isRecontra: boolean) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    try {
      await fetch(`${API_URL}/api/game/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matchId, bid: { amount, suit, isPass, isContra, isRecontra } })
      });
    } catch (err) {
      console.error("Bid failed", err);
    }
  };

  // Loading state
  if (!lobbyState && !gameState) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-game-accent mb-6"></div>
        <button onClick={() => navigate('/')} className="flex items-center text-slate-400 text-sm">
          <ArrowLeft size={16} className="mr-1" /> Back to Lobby
        </button>
      </div>
    );
  }

  // Waiting Lobby
  if (lobbyState?.status === 'WAITING' || !gameState) {
    return (
      <div className="flex flex-col min-h-screen p-4 max-w-lg mx-auto">
        <button onClick={() => navigate('/')} className="mb-8 flex items-center text-slate-400">
          <ArrowLeft size={20} className="mr-2" /> Back to Lobbies
        </button>

        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-2">Waiting for Players</h2>
          <p className="text-slate-400">Match ID: {matchId?.slice(0, 8)}...</p>
          <div className="inline-flex items-center space-x-2 bg-game-card px-4 py-2 rounded-full mt-4 border border-slate-700">
            <span className="font-bold">{lobbyState?.betAmount}</span>
            <span className="text-sm font-medium text-slate-400">{lobbyState?.betCurrency}</span>
          </div>
        </div>

        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => {
            const player = lobbyState?.players[i];
            const isMe = player && player.userId === user?.id;
            return (
              <div key={i} className={`p-4 rounded-xl border ${player ? 'bg-game-card/50 border-game-accent/50' : 'bg-slate-900 border-slate-800 border-dashed'} flex items-center`}>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center mr-4 ${player ? 'bg-game-accent text-slate-900' : 'bg-slate-800 text-slate-600'}`}>
                  <Users size={20} />
                </div>
                <div>
                  <p className={`font-medium ${player ? 'text-white' : 'text-slate-600'}`}>
                    {player ? fancyNames[player.seatIndex] : 'Waiting...'}
                  </p>
                  {isMe && <span className="text-xs text-game-accent">You</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Active Game Board
  const isMyTurn = gameState.currentTurnIndex === mySeatIndex;
  const myInfo = gameState.players[mySeatIndex ?? 0];

  // Calculate other player positions relative to me
  const getRelativePosition = (seatIndex: number) => {
    return ((seatIndex - (mySeatIndex || 0)) + 4) % 4;
  };

  const otherPlayers = [1, 2, 3].map(offset => {
    const seatIdx = ((mySeatIndex || 0) + offset) % 4;
    return { seatIndex: seatIdx, position: offset, name: fancyNames[seatIdx] };
  });

  return (
    <div className="flex flex-col min-h-screen bg-green-900 overflow-hidden relative selection:bg-transparent">
      {/* Table Background */}
      <div className="absolute inset-x-0 top-[-20%] bottom-[-20%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-800 to-green-950 rounded-[40%] shadow-inner pointer-events-none opacity-50"></div>

      <header className="absolute top-4 left-4 right-4 flex justify-between z-10">
        <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium text-slate-300 border border-white/10">
          Team 1: {gameState.tricksCapturedByTeam[0]}
        </div>
        <div className="flex items-center space-x-2">
          {gameState.trump && (
            <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-white border border-white/10 flex items-center">
              Trump: <span className="ml-1"><SuitIcon suit={gameState.trump} /></span>
            </div>
          )}
          <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium text-slate-300 border border-white/10">
            Team 2: {gameState.tricksCapturedByTeam[1]}
          </div>
        </div>
      </header>

      {/* Other Player Labels */}
      {/* Left player */}
      <div className="absolute top-1/2 -translate-y-1/2 left-2 z-10">
        <span className={`bg-black/40 backdrop-blur-md px-2 py-1 rounded text-xs border border-white/10 ${
          gameState.currentTurnIndex === otherPlayers[0].seatIndex ? 'text-game-accent font-bold' : 'text-slate-300'
        }`}>
          {otherPlayers[0].name}
        </span>
      </div>
      {/* Top player */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10">
        <span className={`bg-black/40 backdrop-blur-md px-2 py-1 rounded text-xs border border-white/10 ${
          gameState.currentTurnIndex === otherPlayers[1].seatIndex ? 'text-game-accent font-bold' : 'text-slate-300'
        }`}>
          {otherPlayers[1].name}
        </span>
      </div>
      {/* Right player */}
      <div className="absolute top-1/2 -translate-y-1/2 right-2 z-10">
        <span className={`bg-black/40 backdrop-blur-md px-2 py-1 rounded text-xs border border-white/10 ${
          gameState.currentTurnIndex === otherPlayers[2].seatIndex ? 'text-game-accent font-bold' : 'text-slate-300'
        }`}>
          {otherPlayers[2].name}
        </span>
      </div>

      {/* Auction Phase UI Overlay */}
      {gameState.phase === 'AUCTION' && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 text-center">
            <h3 className="text-xl font-bold mb-2">Auction Phase</h3>
            {gameState.winningBid ? (
              <div className="mb-6 bg-slate-900/50 rounded-lg p-3 inline-block">
                <p className="text-xs text-slate-400 mb-1">Current Highest Bid</p>
                <div className="flex items-center justify-center space-x-2 text-xl font-bold">
                  <span>{gameState.winningBid.amount}</span>
                  <SuitIcon suit={gameState.winningBid.suit} size={24} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  by {fancyNames[gameState.winningBid.playerIndex]}
                </p>
              </div>
            ) : (
              <p className="text-slate-400 mb-6">No bids yet</p>
            )}

            {isMyTurn ? (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-2">
                  {['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'].map(suit => (
                    <button key={suit} onClick={() => handleBid(gameState.winningBid ? gameState.winningBid.amount + 1 : 8, suit, false, false, false)} className="bg-game-card hover:bg-slate-700 p-3 rounded-lg flex items-center justify-center border border-slate-700 transition-colors">
                      <SuitIcon suit={suit} size={24} />
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleBid(0, 'HEARTS', true, false, false)} className="bg-slate-800 hover:bg-slate-700 py-3 rounded-lg font-medium transition-colors">Pass</button>
                  <button onClick={() => handleBid(0, 'HEARTS', false, true, false)} disabled={!gameState.winningBid} className="bg-game-danger/80 hover:bg-game-danger py-3 rounded-lg font-medium transition-colors disabled:opacity-50">Contra</button>
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center animate-pulse">
                <AlertCircle className="text-game-accent mb-2" />
                <p className="text-game-accent">
                  Waiting for {fancyNames[gameState.currentTurnIndex]}...
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Current Trick Table Center */}
      <div className="flex-1 flex items-center justify-center relative z-20">
        {gameState.currentTrick.map((t: any, idx: number) => {
          const offset = getRelativePosition(t.playerIndex);
          let translateClass = '';
          if (offset === 0) translateClass = 'translate-y-12';
          if (offset === 1) translateClass = '-translate-x-12 -rotate-90';
          if (offset === 2) translateClass = '-translate-y-12';
          if (offset === 3) translateClass = 'translate-x-12 rotate-90';

          return (
            <div key={idx} className={`absolute transition-all duration-300 ${translateClass}`}>
              <PlayingCard rank={t.card.rank} suit={t.card.suit} />
            </div>
          );
        })}
      </div>

      {/* Player's Hand */}
      <div className="h-40 relative z-30 pointer-events-none">
        {myInfo && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center px-4">
            <div className="flex -space-x-6 sm:-space-x-4 pointer-events-auto">
              {myInfo.hand.map((card: any, idx: number) => (
                <PlayingCard
                  key={idx}
                  rank={card.rank}
                  suit={card.suit}
                  active={false}
                  disabled={!isMyTurn || gameState.phase !== 'PLAYING'}
                  onClick={() => handlePlayCard(card)}
                />
              ))}
            </div>
          </div>
        )}
        {/* My name label */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10">
          <span className={`bg-black/40 backdrop-blur-md px-2 py-1 rounded text-xs border border-white/10 ${
            isMyTurn ? 'text-game-accent font-bold' : 'text-slate-300'
          }`}>
            {fancyNames[mySeatIndex ?? 0]} (You)
          </span>
        </div>
      </div>

      {/* Turn Indicator */}
      {isMyTurn && gameState.phase === 'PLAYING' && (
        <div className="absolute inset-x-0 bottom-32 flex justify-center z-10 pointer-events-none animate-bounce">
          <div className="bg-game-accent text-slate-900 px-4 py-1.5 rounded-full font-bold shadow-lg shadow-game-accent/50">
            Your Turn
          </div>
        </div>
      )}

      {/* Settlement Modal */}
      {settleResult && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl p-8 text-center max-w-sm w-full">
            <h3 className="text-2xl font-bold mb-4">
              {settleResult.winningTeamIndex === (mySeatIndex !== null ? mySeatIndex % 2 : -1)
                ? 'Victory!'
                : 'Defeat'
              }
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className={`p-3 rounded-lg ${settleResult.winningTeamIndex === 0 ? 'bg-game-success/20 border border-game-success/30' : 'bg-slate-800'}`}>
                <p className="text-xs text-slate-400 mb-1">Team 1</p>
                <p className="text-2xl font-bold">{settleResult.points[0]}</p>
              </div>
              <div className={`p-3 rounded-lg ${settleResult.winningTeamIndex === 1 ? 'bg-game-success/20 border border-game-success/30' : 'bg-slate-800'}`}>
                <p className="text-xs text-slate-400 mb-1">Team 2</p>
                <p className="text-2xl font-bold">{settleResult.points[1]}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/')}
              className="bg-game-accent text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-game-accent/20"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameView;
