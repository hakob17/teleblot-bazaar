import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import LobbyView from './views/LobbyView';
import GameView from './views/GameView';

const AppRoutes = () => {
  const { isLoading, token } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-game-bg text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-game-accent"></div>
      </div>
    );
  }

  // If no auth token (meaning mock failed or telegram auth failed), usually we'd show an error screen
  if (!token) {
     return <div className="p-4 text-center mt-20 text-red-400">Authentication Failed. Please open via Telegram.</div>
  }

  return (
    <Routes>
      <Route path="/" element={<LobbyView />} />
      <Route path="/game/:matchId" element={<GameView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  const manifestUrl = "https://raw.githubusercontent.com/ton-community/tutorials/main/03-client/test/public/tonconnect-manifest.json"; // Placeholder manifest 

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
