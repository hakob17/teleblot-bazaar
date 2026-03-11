import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Clock } from 'lucide-react';
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

const ReplayListView: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMatches();
  }, [token]);

  const loadMatches = async () => {
    try {
      const data = await apiFetch('/api/matches/history', token);
      setMatches(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen p-4 pb-24 max-w-lg mx-auto w-full">
      <h1 className="text-2xl font-bold text-white mb-2">Game Replays</h1>
      <p className="text-sm text-slate-400 mb-6">Watch finished games to learn strategies</p>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-game-accent"></div>
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-10 bg-game-card rounded-xl border border-slate-800">
          <Clock className="mx-auto h-12 w-12 text-slate-600 mb-3" />
          <p className="text-slate-400">No finished games to replay</p>
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map(match => (
            <button
              key={match.matchId}
              onClick={() => navigate(`/replay/${match.matchId}`)}
              className="w-full bg-game-card border border-slate-700 rounded-xl p-4 flex items-center justify-between hover:border-game-accent/50 transition-colors text-left"
            >
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-sm font-bold ${
                    match.result === 'win' ? 'bg-game-success/20 text-game-success' :
                    match.result === 'loss' ? 'bg-game-danger/20 text-game-danger' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {match.result.toUpperCase()}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-sm ${
                    match.betCurrency === 'STARS' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {match.betAmount} {match.betCurrency}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {match.fancyNames.join(' vs ')}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">{new Date(match.playedAt).toLocaleDateString()}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-game-accent/10 flex items-center justify-center flex-shrink-0 ml-3">
                <Play size={18} className="text-game-accent" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReplayListView;
