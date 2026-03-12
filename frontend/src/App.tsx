import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import BottomNav from './components/BottomNav';
import LobbyView from './views/LobbyView';
import GameView from './views/GameView';
import WalletView from './views/WalletView';
import StatsView from './views/StatsView';
import LeaderboardView from './views/LeaderboardView';
import ReplayListView from './views/ReplayListView';
import ReplayView from './views/ReplayView';
import WebApp from '@twa-dev/sdk';

const HIDE_NAV_PATHS = ['/game/', '/replay/'];

// Handles deep link from Telegram start_param (?startapp=matchId)
const DeepLinkHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only process on initial load at root
    if (location.pathname !== '/') return;

    try {
      const startParam = WebApp.initDataUnsafe?.start_param;
      if (startParam) {
        // startParam is the matchId — navigate to the game room
        navigate(`/game/${startParam}`, { replace: true });
      }
    } catch {
      // Not in Telegram context or no start_param
    }
  }, []);

  return <>{children}</>;
};

const AppLayout = () => {
  const location = useLocation();
  const hideNav = HIDE_NAV_PATHS.some(p => location.pathname.startsWith(p));

  return (
    <DeepLinkHandler>
      <Routes>
        <Route path="/" element={<LobbyView />} />
        <Route path="/wallet" element={<WalletView />} />
        <Route path="/stats" element={<StatsView />} />
        <Route path="/leaderboard" element={<LeaderboardView />} />
        <Route path="/replays" element={<ReplayListView />} />
        <Route path="/replay/:matchId" element={<ReplayView />} />
        <Route path="/game/:matchId" element={<GameView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!hideNav && <BottomNav />}
    </DeepLinkHandler>
  );
};

const AppRoutes = () => {
  const { isLoading, token, error } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-game-bg text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-game-accent"></div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center p-4">
        <div className="bg-game-card border border-red-500/50 p-6 rounded-xl text-center max-w-sm w-full shadow-lg shadow-red-500/10">
          <h2 className="text-red-400 font-bold text-lg mb-2">Authentication Failed</h2>
          <p className="text-slate-300 text-sm mb-4">Please open this app via Telegram.</p>
          {error && (
            <div className="bg-red-500/10 text-red-300 text-xs p-3 rounded text-left font-mono break-all">
              Error: {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return <AppLayout />;
};

const App: React.FC = () => {
  const manifestUrl = "https://teleblot-bazaar.pages.dev/tonconnect-manifest.json";

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <AuthProvider>
        <SocketProvider>
          <BrowserRouter>
            <main className="min-h-screen bg-game-bg">
              <AppRoutes />
            </main>
          </BrowserRouter>
        </SocketProvider>
      </AuthProvider>
    </TonConnectUIProvider>
  );
};

export default App;
