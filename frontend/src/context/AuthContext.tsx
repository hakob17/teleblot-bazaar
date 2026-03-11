import React, { createContext, useContext, useEffect, useState } from 'react';
import WebApp from '@twa-dev/sdk';

interface User {
  id: string;
  telegramId: string;
  username: string | null;
  starsBalance: number;
  tonBalance: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: () => Promise<void>;
  updateBalance: (currency: 'TON'|'STARS', amount: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const login = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      let initData = WebApp.initData;

      // --- DEVELOPMENT MOCK ---
      // If we are developing locally outside of Telegram, inject a mock initData
      if (import.meta.env.MODE === 'development' && !initData) {
         console.warn("Using mock Telegram initData for local development");
         const mockUser = encodeURIComponent(JSON.stringify({
            id: 123456789,
            first_name: "Test",
            last_name: "User",
            username: "testuser",
            language_code: "en"
         }));
         initData = `query_id=mock_query_id&user=${mockUser}&auth_date=${Math.floor(Date.now()/1000)}&hash=mock_hash`;
      }

      if (!initData) {
        throw new Error("No Telegram init data available");
      }

      // We assume backend is running on same network for now, but usually it's from env
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Login failed');
      }

      const data = await response.json();
      setToken(data.token);
      setUser(data.user);

      // Store token safely if needed
      localStorage.setItem('teleblot_token', data.token);

    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateBalance = (currency: 'TON'|'STARS', amount: number) => {
      if(!user) return;
      if(currency === 'TON') {
          setUser({...user, tonBalance: user.tonBalance + amount});
      } else {
          setUser({...user, starsBalance: user.starsBalance + amount});
      }
  }

  useEffect(() => {
    // Attempt auto-login when component mounts
    WebApp.ready();
    WebApp.expand(); // Make it full screen
    login();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, error, login, updateBalance }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
