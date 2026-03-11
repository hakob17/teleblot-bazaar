import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinMatchRoom: (matchId: string) => void;
  leaveMatchRoom: (matchId: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    // We attach token for potential auth middleware on socket (if implemented backend side)
    const newSocket = io(API_URL, {
      auth: { token }
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
      // Automatically join lobby room on connection
      newSocket.emit('joinLobbyRoom');
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  const joinMatchRoom = (matchId: string) => {
    if (socket) {
      socket.emit('joinMatchRoom', matchId);
    }
  };

  const leaveMatchRoom = (_matchId: string) => {
    if (socket) {
      // If we implement 'leaveMatchRoom' on backend later
      // socket.emit('leaveMatchRoom', _matchId);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, joinMatchRoom, leaveMatchRoom }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
