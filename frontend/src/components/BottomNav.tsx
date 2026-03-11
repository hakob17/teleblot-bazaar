import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Swords, Wallet, BarChart3, Trophy, Play } from 'lucide-react';

const tabs = [
  { path: '/', label: 'Lobby', icon: Swords },
  { path: '/wallet', label: 'Wallet', icon: Wallet },
  { path: '/stats', label: 'Stats', icon: BarChart3 },
  { path: '/leaderboard', label: 'Leaders', icon: Trophy },
  { path: '/replays', label: 'Replay', icon: Play },
];

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-game-card/90 backdrop-blur-md border-t border-slate-700/50 safe-area-bottom">
      <div className="max-w-lg mx-auto flex justify-around items-center h-16">
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive ? 'text-game-accent' : 'text-slate-500'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
