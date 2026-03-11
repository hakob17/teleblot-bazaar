import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Users, AlertCircle, ArrowLeft } from 'lucide-react';

const SuitIcon: React.FC<{ suit: string, size?: number }> = ({ suit, size = 16 }) => {
  const getIcon = () => {
     switch (suit) {
        case 'HEARTS': return <span style={{fontSize: size}} className="text-red-500">♥</span>;
        case 'DIAMONDS': return <span style={{fontSize: size}} className="text-red-500">♦</span>;
        case 'CLUBS': return <span style={{fontSize: size}} className="text-slate-900 dark:text-slate-100">♣</span>;
        case 'SPADES': return <span style={{fontSize: size}} className="text-slate-900 dark:text-slate-100">♠</span>;
        default: return null;
     }
  };
  return getIcon();
};

const PlayingCard: React.FC<{ rank: string, suit: string, onClick?: () => void, disabled?: boolean, active?: boolean }> = ({ rank, suit, onClick, disabled, active }) => {
   const isRed = suit === 'HEARTS' || suit === 'DIAMONDS';
   return (
       <div 
         onClick={!disabled ? onClick : undefined}
         className={`playing-card w-14 sm:w-20 ${isRed ? 'red' : 'black'} ${disabled ? 'opacity-50 cursor-not-allowed transform-none' : ''} ${active ? '-translate-y-4 shadow-xl ring-2 ring-game-accent' : ''}`}
       >
          <div className="absolute top-1 left-1.5 flex flex-col items-center">
             <span className="text-sm sm:text-lg font-bold leading-none">{rank}</span>
             <SuitIcon suit={suit} size={14} />
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
             <SuitIcon suit={suit} size={40} />
          </div>
          
          <div className="absolute bottom-1 right-1.5 flex flex-col items-center rotate-180">
             <span className="text-sm sm:text-lg font-bold leading-none">{rank}</span>
             <SuitIcon suit={suit} size={14} />
          </div>
       </div>
   );
};

const GameView: React.FC = () => {
   const { matchId } = useParams<{ matchId: string }>();
   const { user, token } = useAuth();
   const { socket, joinMatchRoom } = useSocket();
   const navigate = useNavigate();
   
   const [gameState, setGameState] = useState<any>(null);
   const [lobbyState, setLobbyState] = useState<any>(null);
   const [mySeatIndex, setMySeatIndex] = useState<number | null>(null);

   useEffect(() => {
     if (!matchId) return;
     joinMatchRoom(matchId);

     if (socket) {
        socket.on('matchStateUpdated', (match) => {
           setLobbyState(match);
           if (match.stateJson) {
              const parsed = JSON.parse(match.stateJson);
              setGameState(parsed);
              
              if (user) {
                 const me = parsed.players.find((p:any) => p.userId === user.id);
                 if (me) {
                    const idx = parsed.players.indexOf(me);
                    setMySeatIndex(idx);
                 }
              }
           }
        });

        socket.on('gameStateUpdated', (state) => {
           setGameState(state);
        });
        
        socket.on('matchSettled', (result) => {
            // Can display a nice modal instead of alert here
            alert(`Match Settled! Winning Team: ${result.winningTeamIndex === 0 ? 'Team 1 (You/Partner)' : 'Team 2'}`);
        });
     }

     return () => {
        if (socket) {
            socket.off('matchStateUpdated');
            socket.off('gameStateUpdated');
            socket.off('matchSettled');
        }
     }
   }, [socket, matchId, joinMatchRoom, user]);


   // Handlers
   const handlePlayCard = async (card: any) => {
       if (gameState?.phase !== 'PLAYING' || gameState?.currentTurnIndex !== mySeatIndex) return;

       const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
       try {
           await fetch(`${API_URL}/api/game/play`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ matchId, card })
           });
       } catch (err) {
           console.error("Play failed", err);
       }
   };

   const handleBid = async (amount: number, suit: string, isPass: boolean, isContra: boolean, isRecontra: boolean) => {
       const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
       try {
           await fetch(`${API_URL}/api/game/bid`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ matchId, bid: { amount, suit, isPass, isContra, isRecontra } })
           });
       } catch (err) {
           console.error("Bid failed", err);
       }
   }

   // Loading states
   if (!lobbyState && !gameState) {
      return (
          <div className="flex min-h-screen items-center justify-center p-4">
             <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-game-accent"></div>
          </div>
      );
   }

   // Waiting Lobby
   if (lobbyState?.status === 'WAITING' || !gameState) {
      return (
         <div className="flex flex-col min-h-screen p-4 max-w-lg mx-auto">
            <button onClick={() => navigate('/')} className="mb-8 flex items-center text-slate-400">
               <ArrowLeft size={20} className="mr-2" /> Back to Lobbies
            </button>
            
            <div className="text-center mb-12">
               <h2 className="text-3xl font-bold text-white mb-2">Waiting for Players</h2>
               <p className="text-slate-400">Match ID: {matchId?.slice(0,8)}...</p>
               <div className="inline-flex items-center space-x-2 bg-game-card px-4 py-2 rounded-full mt-4 border border-slate-700">
                  <span className="font-bold">{lobbyState?.betAmount}</span>
                  <span className="text-sm font-medium text-slate-400">{lobbyState?.betCurrency}</span>
               </div>
            </div>

            <div className="space-y-4">
               {Array.from({length: 4}).map((_, i) => {
                  const player = lobbyState?.players[i];
                  return (
                      <div key={i} className={`p-4 rounded-xl border ${player ? 'bg-game-card/50 border-game-accent/50' : 'bg-slate-900 border-slate-800 border-dashed'} flex items-center`}>
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center mr-4 ${player ? 'bg-game-accent text-slate-900' : 'bg-slate-800 text-slate-600'}`}>
                             <Users size={20} />
                          </div>
                          <div>
                             <p className={`font-medium ${player ? 'text-white' : 'text-slate-600'}`}>
                                {player ? player.user.username || 'Anonymous' : 'Waiting...'}
                             </p>
                             {player && player.userId === user?.id && <span className="text-xs text-game-accent">You</span>}
                          </div>
                      </div>
                  );
               })}
            </div>
         </div>
      );
   }

   // Active Game Board 
   const isMyTurn = gameState.currentTurnIndex === mySeatIndex;
   const myInfo = gameState.players[mySeatIndex ?? 0];

   return (
       <div className="flex flex-col min-h-screen bg-green-900 overflow-hidden relative selection:bg-transparent">
           {/* Table Background */}
           <div className="absolute inset-x-0 top-[-20%] bottom-[-20%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-800 to-green-950 rounded-[40%] shadow-inner pointer-events-none opacity-50"></div>

           <header className="absolute top-4 left-4 right-4 flex justify-between z-10">
               <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium text-slate-300 border border-white/10">
                   Team 1: {gameState.tricksCapturedByTeam[0]}
               </div>
               <div className="flex items-center space-x-2">
                   {gameState.trump && (
                       <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-white border border-white/10 flex items-center">
                          Trump: <span className="ml-1"><SuitIcon suit={gameState.trump} /></span>
                       </div>
                   )}
                   <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium text-slate-300 border border-white/10">
                       Team 2: {gameState.tricksCapturedByTeam[1]}
                   </div>
               </div>
           </header>

           {/* Auction Phase UI Overlay */}
           {gameState.phase === 'AUCTION' && (
               <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="glass-panel w-full max-w-sm rounded-2xl p-6 text-center">
                      <h3 className="text-xl font-bold mb-2">Auction Phase</h3>
                      {gameState.winningBid ? (
                         <div className="mb-6 bg-slate-900/50 rounded-lg p-3 inline-block">
                             <p className="text-xs text-slate-400 mb-1">Current Highest Bid</p>
                             <div className="flex items-center justify-center space-x-2 text-xl font-bold">
                                <span>{gameState.winningBid.amount}</span>
                                <SuitIcon suit={gameState.winningBid.suit} size={24} />
                             </div>
                         </div>
                      ) : (
                         <p className="text-slate-400 mb-6">No bids yet</p>
                      )}

                      {isMyTurn ? (
                          <div className="space-y-4">
                              <div className="grid grid-cols-4 gap-2">
                                  {['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'].map(suit => (
                                     <button key={suit} onClick={() => handleBid(gameState.winningBid ? gameState.winningBid.amount + 1 : 8, suit, false, false, false)} className="bg-game-card hover:bg-slate-700 p-3 rounded-lg flex items-center justify-center border border-slate-700 transition-colors">
                                        <SuitIcon suit={suit} size={24} />
                                     </button>
                                  ))}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                  <button onClick={() => handleBid(0,'HEARTS',true,false,false)} className="bg-slate-800 hover:bg-slate-700 py-3 rounded-lg font-medium transition-colors">Pass</button>
                                  <button onClick={() => handleBid(0,'HEARTS',false,true,false)} disabled={!gameState.winningBid} className="bg-game-danger/80 hover:bg-game-danger py-3 rounded-lg font-medium transition-colors disabled:opacity-50">Contra</button>
                              </div>
                          </div>
                      ) : (
                          <div className="py-6 flex flex-col items-center animate-pulse">
                              <AlertCircle className="text-game-accent mb-2" />
                              <p className="text-game-accent">Waiting for other players...</p>
                          </div>
                      )}
                  </div>
               </div>
           )}

           {/* Current Trick Table Center */}
           <div className="flex-1 flex items-center justify-center relative z-20">
               {gameState.currentTrick.map((t: any, idx: number) => {
                   // Basic positioning logic for 4 players
                   // Assuming mySeatIndex is Bottom (e.g. 0), Left is 1, Top is 2, Right is 3.
                   const offset = (t.playerIndex - (mySeatIndex || 0) + 4) % 4;
                   let translateClass = '';
                   if (offset === 0) translateClass = 'translate-y-12';
                   if (offset === 1) translateClass = '-translate-x-12 -rotate-90';
                   if (offset === 2) translateClass = '-translate-y-12';
                   if (offset === 3) translateClass = 'translate-x-12 rotate-90';

                   return (
                       <div key={idx} className={`absolute transition-all duration-300 ${translateClass}`}>
                           <PlayingCard rank={t.card.rank} suit={t.card.suit} />
                       </div>
                   );
               })}
           </div>

           {/* Player's Hand */}
           <div className="h-40 relative z-30 pointer-events-none">
             {myInfo && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center px-4">
                  <div className="flex -space-x-6 sm:-space-x-4 pointer-events-auto">
                     {myInfo.hand.map((card: any, idx: number) => {
                         const isActive = false;
                         return (
                             <PlayingCard 
                                key={idx} 
                                rank={card.rank} 
                                suit={card.suit} 
                                active={isActive}
                                disabled={!isMyTurn || gameState.phase !== 'PLAYING'}
                                onClick={() => handlePlayCard(card)} 
                             />
                         )
                     })}
                  </div>
                </div>
             )}
           </div>

           {/* Turn Indicator */}
           {isMyTurn && gameState.phase === 'PLAYING' && (
              <div className="absolute inset-x-0 bottom-32 flex justify-center z-10 pointer-events-none animate-bounce">
                  <div className="bg-game-accent text-slate-900 px-4 py-1.5 rounded-full font-bold shadow-lg shadow-game-accent/50">
                      Your Turn
                  </div>
              </div>
           )}
       </div>
   );
};

export default GameView;
