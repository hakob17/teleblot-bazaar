import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Coins } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

interface Match {
  id: string;
  betAmount: number;
  betCurrency: 'TON' | 'STARS';
  players: any[];
}

const LobbyView: React.FC = () => {
  const { user, token } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [lobbies, setLobbies] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        
        // If the match is filled and we are in it, redirect to game
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
        // User created it, wait here for others, maybe jump to waiting room UI 
        // We can just redirect them to the game wrapper immediately which shows waiting UI
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

  return (
    <div className="flex flex-col min-h-screen p-4 pb-20 max-w-lg mx-auto w-full relative">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Bazaar Blot</h1>
          <p className="text-sm text-slate-400">Hi, {user?.username || 'Player'}</p>
        </div>
        
        <div className="flex flex-col items-end space-y-1">
          <div className="flex items-center space-x-1.5 bg-game-card px-2 py-1 rounded-full border border-slate-700">
             <span className="text-yellow-400 text-sm">⭐</span>
             <span className="text-xs font-medium">{user?.starsBalance || 0}</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-game-card px-2 py-1 rounded-full border border-slate-700">
             <span className="text-blue-400 text-sm">💎</span>
             <span className="text-xs font-medium">{user?.tonBalance || 0} TON</span>
          </div>
        </div>
      </header>

      {/* Action Bar */}
      <button 
        onClick={() => setShowCreate(true)}
        className="w-full bg-game-accent hover:bg-sky-500 text-white font-semibold py-4 rounded-xl shadow-lg shadow-game-accent/20 transition-all flex items-center justify-center space-x-2 mb-8"
      >
        <Plus size={20} />
        <span>Create New Match</span>
      </button>

      {/* Lobbies List */}
      <h2 className="text-sm font-semibold text-slate-400 tracking-wider uppercase mb-4">Waiting Matches</h2>
      
      {isLoading ? (
         <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-game-accent"></div></div>
      ) : lobbies.length === 0 ? (
         <div className="text-center py-10 bg-game-card rounded-xl border border-slate-800">
            <Coins className="mx-auto h-12 w-12 text-slate-600 mb-3" />
            <p className="text-slate-400">No active matches found.<br/>Be the first to create one!</p>
         </div>
      ) : (
         <div className="space-y-3">
           {lobbies.map(lobby => (
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
                </div>

                <button 
                  onClick={() => handleJoinLobby(lobby.id)}
                  disabled={lobby.players.length >= 4 || lobby.players.some(p => p.userId === user?.id)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                     lobby.players.length >= 4 || lobby.players.some(p => p.userId === user?.id)
                     ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                     : 'bg-white text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  Join
                </button>
             </div>
           ))}
         </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}></div>
           <div className="glass-panel w-full max-w-sm rounded-t-2xl sm:rounded-2xl relative z-10 p-6 animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-8 duration-200">
              <h3 className="text-xl font-bold mb-6">Setup Match</h3>
              
              <div className="space-y-4 mb-8">
                 <div>
                   <label className="text-sm text-slate-400 block mb-2">Currency</label>
                   <div className="grid grid-cols-2 gap-2">
                     <button 
                        onClick={() => setBetCurrency('STARS')}
                        className={`py-3 rounded-lg border transition-colors flex justify-center items-center space-x-2 ${betCurrency === 'STARS' ? 'bg-game-card border-yellow-400 text-yellow-400' : 'border-slate-700 text-slate-400'}`}
                     >
                        <span>⭐ Stars</span>
                     </button>
                     <button 
                        onClick={() => setBetCurrency('TON')}
                        className={`py-3 rounded-lg border transition-colors flex justify-center items-center space-x-2 ${betCurrency === 'TON' ? 'bg-game-card border-blue-400 text-blue-400' : 'border-slate-700 text-slate-400'}`}
                     >
                        <span>💎 TON</span>
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
