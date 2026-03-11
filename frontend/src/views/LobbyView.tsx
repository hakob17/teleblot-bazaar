import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Coins, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

interface Match {
  id: string;
  betAmount: number;
  betCurrency: 'TON' | 'STARS';
  players: any[];
  fancyNames?: string[];
}

const LobbyView: React.FC = () => {
  const { user, token } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [lobbies, setLobbies] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showMyGames, setShowMyGames] = useState(false);

  // Form states
  const [showCreate, setShowCreate] = useState(false);
  const [betAmount, setBetAmount] = useState(10);
  const [betCurrency, setBetCurrency] = useState<'TON' | 'STARS'>('STARS');

  const fetchLobbies = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/lobbies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLobbies(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLobbies();

    if (socket) {
      socket.on('lobbyCreated', (newMatch: Match) => {
        setLobbies(prev => [newMatch, ...prev]);
      });

      socket.on('lobbyUpdated', (updatedMatch: Match) => {
        setLobbies(prev =>
          prev.map(m => m.id === updatedMatch.id ? updatedMatch : m)
        );

        if (updatedMatch.players.length === 4) {
          const amIInMatch = updatedMatch.players.some(p => p.userId === user?.id);
          if (amIInMatch) {
            navigate(`/game/${updatedMatch.id}`);
          }
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('lobbyCreated');
        socket.off('lobbyUpdated');
      }
    };
  }, [socket, token, user, navigate]);

  const handleCreateLobby = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/lobbies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ betAmount, betCurrency })
      });
      if (res.ok) {
        const newMatch = await res.json();
        setShowCreate(false);
        navigate(`/game/${newMatch.id}`);
      }
    } catch (err) {
      console.error('Failed to create lobby', err);
    }
  };

  const handleJoinLobby = async (matchId: string) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/lobbies/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ matchId })
      });
      if (res.ok) {
        navigate(`/game/${matchId}`);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to join lobby');
      }
    } catch (err) {
      console.error('Failed to join lobby', err);
    }
  };

  const filteredLobbies = showMyGames
    ? lobbies.filter(l => l.players.some(p => p.userId === user?.id))
    : lobbies;

  return (
    <div className="flex flex-col min-h-screen p-4 pb-24 max-w-lg mx-auto w-full relative">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Bazaar Blot</h1>
          <p className="text-sm text-slate-400">Hi, {user?.username || 'Player'}</p>
        </div>

        <div className="flex flex-col items-end space-y-1">
          <div className="flex items-center space-x-1.5 bg-game-card px-2 py-1 rounded-full border border-slate-700">
            <span className="text-yellow-400 text-sm">&#11088;</span>
            <span className="text-xs font-medium">{user?.starsBalance || 0}</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-game-card px-2 py-1 rounded-full border border-slate-700">
            <span className="text-blue-400 text-sm">&#128142;</span>
            <span className="text-xs font-medium">{user?.tonBalance || 0} TON</span>
          </div>
        </div>
      </header>

      {/* Action Bar */}
      <button
        onClick={() => setShowCreate(true)}
        className="w-full bg-game-accent hover:bg-sky-500 text-white font-semibold py-4 rounded-xl shadow-lg shadow-game-accent/20 transition-all flex items-center justify-center space-x-2 mb-4"
      >
        <Plus size={20} />
        <span>Create New Match</span>
      </button>

      {/* Filter */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-400 tracking-wider uppercase">Waiting Matches</h2>
        <button
          onClick={() => setShowMyGames(!showMyGames)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
            showMyGames
              ? 'bg-game-accent/20 border-game-accent/50 text-game-accent'
              : 'bg-game-card border-slate-700 text-slate-400'
          }`}
        >
          <Filter size={12} />
          <span>My Games</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-game-accent"></div></div>
      ) : filteredLobbies.length === 0 ? (
        <div className="text-center py-10 bg-game-card rounded-xl border border-slate-800">
          <Coins className="mx-auto h-12 w-12 text-slate-600 mb-3" />
          <p className="text-slate-400">
            {showMyGames ? 'You haven\'t joined any matches yet.' : 'No active matches found.'}
            <br />
            {!showMyGames && 'Be the first to create one!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLobbies.map((lobby) => {
            const isInMatch = lobby.players.some(p => p.userId === user?.id);
            return (
              <div key={lobby.id} className="bg-game-card border border-slate-700 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-lg font-bold">{lobby.betAmount}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-sm ${lobby.betCurrency === 'STARS' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {lobby.betCurrency}
                    </span>
                  </div>
                  <div className="flex items-center text-slate-400 text-xs">
                    <Users size={14} className="mr-1" />
                    <span>{lobby.players.length} / 4 Players</span>
                  </div>
                  {lobby.fancyNames && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {lobby.players.map((p, i) => (
                        <span key={i} className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                          {lobby.fancyNames![p.seatIndex]}{p.userId === user?.id ? ' (You)' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => isInMatch ? navigate(`/game/${lobby.id}`) : handleJoinLobby(lobby.id)}
                  disabled={!isInMatch && lobby.players.length >= 4}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex-shrink-0 ml-3 ${
                    isInMatch
                      ? 'bg-game-accent text-white'
                      : lobby.players.length >= 4
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-white text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {isInMatch ? 'Resume' : 'Join'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}></div>
          <div className="glass-panel w-full max-w-sm rounded-t-2xl sm:rounded-2xl relative z-10 p-6">
            <h3 className="text-xl font-bold mb-6">Setup Match</h3>

            <div className="space-y-4 mb-8">
              <div>
                <label className="text-sm text-slate-400 block mb-2">Currency</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setBetCurrency('STARS')}
                    className={`py-3 rounded-lg border transition-colors flex justify-center items-center space-x-2 ${betCurrency === 'STARS' ? 'bg-game-card border-yellow-400 text-yellow-400' : 'border-slate-700 text-slate-400'}`}
                  >
                    <span>&#11088; Stars</span>
                  </button>
                  <button
                    onClick={() => setBetCurrency('TON')}
                    className={`py-3 rounded-lg border transition-colors flex justify-center items-center space-x-2 ${betCurrency === 'TON' ? 'bg-game-card border-blue-400 text-blue-400' : 'border-slate-700 text-slate-400'}`}
                  >
                    <span>&#128142; TON</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-2">Bet Amount (Per Player)</label>
                <input
                  type="number"
                  min={1}
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-game-accent"
                />
                <p className="text-xs text-slate-500 mt-2">Total Pot: <span className="text-slate-300">{betAmount * 4} {betCurrency}</span></p>
              </div>
            </div>

            <button
              onClick={handleCreateLobby}
              className="w-full bg-game-accent text-white py-3.5 rounded-xl font-semibold text-lg shadow-lg shadow-game-accent/20"
            >
              Create & Wait
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LobbyView;
