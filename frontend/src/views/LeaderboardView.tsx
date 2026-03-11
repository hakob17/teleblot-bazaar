import React, { useEffect, useState } from 'react';
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

interface LeaderboardEntry {
  oddsId: string;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  totalEarnings: number;
  winRate: number;
}

const LeaderboardView: React.FC = () => {
  const { token } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, [token]);

  const loadLeaderboard = async () => {
    try {
      const data = await apiFetch('/api/leaderboard', token);
      setEntries(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center"><Trophy size={16} className="text-yellow-400" /></div>;
    if (index === 1) return <div className="w-8 h-8 rounded-full bg-slate-400/20 flex items-center justify-center"><Trophy size={16} className="text-slate-300" /></div>;
    if (index === 2) return <div className="w-8 h-8 rounded-full bg-amber-700/20 flex items-center justify-center"><Trophy size={16} className="text-amber-600" /></div>;
    return <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">{index + 1}</div>;
  };

  return (
    <div className="flex flex-col min-h-screen p-4 pb-24 max-w-lg mx-auto w-full">
      <h1 className="text-2xl font-bold text-white mb-6">Leaderboard</h1>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-game-accent"></div>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-10 bg-game-card rounded-xl border border-slate-800">
          <Trophy className="mx-auto h-12 w-12 text-slate-600 mb-3" />
          <p className="text-slate-400">No players on the leaderboard yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, idx) => (
            <div
              key={entry.oddsId}
              className={`bg-game-card border rounded-xl p-3 flex items-center space-x-3 ${
                idx < 3 ? 'border-yellow-500/20' : 'border-slate-700'
              }`}
            >
              {getRankBadge(idx)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">Player #{entry.oddsId}</p>
                <div className="flex items-center space-x-3 text-xs text-slate-400">
                  <span>{entry.gamesPlayed} games</span>
                  <span className="text-game-success">{entry.wins}W</span>
                  <span className="text-game-danger">{entry.losses}L</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-game-accent">{entry.winRate}%</p>
                <div className="flex items-center justify-end space-x-1">
                  {entry.totalEarnings >= 0
                    ? <TrendingUp size={12} className="text-game-success" />
                    : <TrendingDown size={12} className="text-game-danger" />
                  }
                  <span className={`text-xs font-medium ${entry.totalEarnings >= 0 ? 'text-game-success' : 'text-game-danger'}`}>
                    {entry.totalEarnings >= 0 ? '+' : ''}{entry.totalEarnings}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LeaderboardView;
