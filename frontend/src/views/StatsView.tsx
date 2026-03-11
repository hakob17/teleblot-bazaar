import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, XCircle, Minus, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

interface MatchHistory {
  matchId: string;
  betAmount: number;
  betCurrency: 'TON' | 'STARS';
  mySeatIndex: number;
  fancyNames: string[];
  result: 'win' | 'loss' | 'draw';
  playedAt: string;
}

const StatsView: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<MatchHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [token]);

  const loadHistory = async () => {
    try {
      const data = await apiFetch('/api/matches/history', token);
      setHistory(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const wins = history.filter(h => h.result === 'win').length;
  const losses = history.filter(h => h.result === 'loss').length;
  const winRate = history.length > 0 ? Math.round((wins / history.length) * 100) : 0;

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'win': return <span className="flex items-center space-x-1 text-game-success text-xs font-bold"><Trophy size={12} /> <span>WIN</span></span>;
      case 'loss': return <span className="flex items-center space-x-1 text-game-danger text-xs font-bold"><XCircle size={12} /> <span>LOSS</span></span>;
      default: return <span className="flex items-center space-x-1 text-slate-400 text-xs font-bold"><Minus size={12} /> <span>DRAW</span></span>;
    }
  };

  return (
    <div className="flex flex-col min-h-screen p-4 pb-24 max-w-lg mx-auto w-full">
      <h1 className="text-2xl font-bold text-white mb-6">Statistics</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        <div className="bg-game-card border border-slate-700 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-white">{history.length}</p>
          <p className="text-[10px] text-slate-400 uppercase">Played</p>
        </div>
        <div className="bg-game-card border border-game-success/30 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-game-success">{wins}</p>
          <p className="text-[10px] text-slate-400 uppercase">Wins</p>
        </div>
        <div className="bg-game-card border border-game-danger/30 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-game-danger">{losses}</p>
          <p className="text-[10px] text-slate-400 uppercase">Losses</p>
        </div>
        <div className="bg-game-card border border-game-accent/30 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-game-accent">{winRate}%</p>
          <p className="text-[10px] text-slate-400 uppercase">Win Rate</p>
        </div>
      </div>

      {/* Match History */}
      <h2 className="text-sm font-semibold text-slate-400 tracking-wider uppercase mb-4">Match History</h2>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-game-accent"></div>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-10 bg-game-card rounded-xl border border-slate-800">
          <p className="text-slate-400">No matches played yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map(match => (
            <div
              key={match.matchId}
              className={`bg-game-card border rounded-xl p-4 ${
                match.result === 'win' ? 'border-game-success/20' :
                match.result === 'loss' ? 'border-game-danger/20' :
                'border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getResultBadge(match.result)}
                  <span className={`text-xs px-2 py-0.5 rounded-sm ${
                    match.betCurrency === 'STARS' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {match.betAmount} {match.betCurrency}
                  </span>
                </div>
                <button
                  onClick={() => navigate(`/replay/${match.matchId}`)}
                  className="flex items-center space-x-1 text-game-accent text-xs hover:text-sky-300 transition-colors"
                >
                  <Play size={12} />
                  <span>Replay</span>
                </button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  You played as <span className="text-slate-300">{match.fancyNames[match.mySeatIndex]}</span>
                </p>
                <p className="text-xs text-slate-600">{new Date(match.playedAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StatsView;
