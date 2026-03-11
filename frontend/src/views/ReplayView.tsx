import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, SkipForward, SkipBack, FastForward } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import PlayingCard from '../components/PlayingCard';
import SuitIcon from '../components/SuitIcon';

interface Card {
  suit: string;
  rank: string;
}

interface Bid {
  playerIndex: number;
  amount: number;
  suit: string;
  isPass: boolean;
  isContra: boolean;
  isRecontra: boolean;
}

interface MoveLogEntry {
  type: 'bid' | 'play';
  playerIndex: number;
  bid?: Bid;
  card?: Card;
}

interface ReplayData {
  matchId: string;
  betAmount: number;
  betCurrency: string;
  fancyNames: string[];
  initialHands: Card[][];
  movesLog: MoveLogEntry[];
  trump: string | null;
  finalScores: [number, number];
  winningBid: Bid | null;
}

const SPEED_OPTIONS = [0.5, 1, 2, 4];

const ReplayView: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [replayData, setReplayData] = useState<ReplayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  // Derived replay state
  const [hands, setHands] = useState<Card[][]>([[], [], [], []]);
  const [currentTrick, setCurrentTrick] = useState<{ playerIndex: number; card: Card }[]>([]);
  const [teamScores, setTeamScores] = useState<[number, number]>([0, 0]);
  const [currentPhase, setCurrentPhase] = useState<'auction' | 'playing' | 'finished'>('auction');
  const [, setLastBid] = useState<Bid | null>(null);
  const [trump, setTrump] = useState<string | null>(null);
  const [, setTrickHistory] = useState<{ playerIndex: number; card: Card }[][]>([]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadReplay();
  }, [matchId, token]);

  const loadReplay = async () => {
    try {
      const data = await apiFetch(`/api/matches/${matchId}/replay`, token);
      setReplayData(data);
      if (data.initialHands) {
        setHands(data.initialHands.map((h: Card[]) => [...h]));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Rebuild state up to moveIndex from scratch
  const rebuildStateUpTo = useCallback((moveIndex: number) => {
    if (!replayData) return;

    const newHands = replayData.initialHands.map(h => [...h]);
    let newTrick: { playerIndex: number; card: Card }[] = [];
    let newScores: [number, number] = [0, 0];
    let newPhase: 'auction' | 'playing' | 'finished' = 'auction';
    let newLastBid: Bid | null = null;
    let newTrump: string | null = null;
    const tricks: { playerIndex: number; card: Card }[][] = [];

    for (let i = 0; i <= moveIndex && i < replayData.movesLog.length; i++) {
      const move = replayData.movesLog[i];
      if (move.type === 'bid' && move.bid) {
        if (!move.bid.isPass) {
          newLastBid = move.bid;
        }
      } else if (move.type === 'play' && move.card) {
        // Remove card from hand
        const hand = newHands[move.playerIndex];
        const cardIdx = hand.findIndex(c => c.rank === move.card!.rank && c.suit === move.card!.suit);
        if (cardIdx !== -1) hand.splice(cardIdx, 1);

        newTrick.push({ playerIndex: move.playerIndex, card: move.card });

        if (newPhase === 'auction') {
          newPhase = 'playing';
          newTrump = replayData.trump;
        }

        if (newTrick.length === 4) {
          tricks.push([...newTrick]);
          newTrick = [];
        }
      }
    }

    // Check if we transitioned from auction to playing
    const hasPlayMoves = replayData.movesLog.slice(0, moveIndex + 1).some(m => m.type === 'play');
    if (hasPlayMoves) {
      newPhase = 'playing';
      newTrump = replayData.trump;
    }

    // Check if finished
    if (moveIndex >= replayData.movesLog.length - 1) {
      newPhase = 'finished';
      newScores = replayData.finalScores;
    }

    setHands(newHands);
    setCurrentTrick(newTrick);
    setTeamScores(newScores);
    setCurrentPhase(newPhase);
    setLastBid(newLastBid);
    setTrump(newTrump);
    setTrickHistory(tricks);
  }, [replayData]);

  useEffect(() => {
    rebuildStateUpTo(currentMoveIndex);
  }, [currentMoveIndex, rebuildStateUpTo]);

  // Auto-play
  useEffect(() => {
    if (isPlaying && replayData) {
      if (currentMoveIndex >= replayData.movesLog.length - 1) {
        setIsPlaying(false);
        return;
      }
      timerRef.current = setTimeout(() => {
        setCurrentMoveIndex(prev => prev + 1);
      }, 1500 / speed);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentMoveIndex, speed, replayData]);

  const handlePlayPause = () => {
    if (currentMoveIndex >= (replayData?.movesLog.length ?? 0) - 1) {
      // Reset and play from start
      setCurrentMoveIndex(-1);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    if (replayData && currentMoveIndex < replayData.movesLog.length - 1) {
      setCurrentMoveIndex(prev => prev + 1);
    }
  };

  const handleStepBack = () => {
    setIsPlaying(false);
    if (currentMoveIndex > -1) {
      setCurrentMoveIndex(prev => prev - 1);
    }
  };

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(speed);
    setSpeed(SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-game-accent"></div>
      </div>
    );
  }

  if (!replayData) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center p-4">
        <p className="text-slate-400 mb-4">Replay not available</p>
        <button onClick={() => navigate('/replays')} className="text-game-accent">Back to Replays</button>
      </div>
    );
  }

  const currentMove = currentMoveIndex >= 0 ? replayData.movesLog[currentMoveIndex] : null;
  const totalMoves = replayData.movesLog.length;
  const progress = totalMoves > 0 ? ((currentMoveIndex + 1) / totalMoves) * 100 : 0;

  return (
    <div className="flex flex-col min-h-screen bg-green-900 overflow-hidden relative selection:bg-transparent">
      {/* Table Background */}
      <div className="absolute inset-x-0 top-[-20%] bottom-[-20%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-800 to-green-950 rounded-[40%] shadow-inner pointer-events-none opacity-50"></div>

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-30 p-3 flex items-center justify-between">
        <button onClick={() => navigate('/replays')} className="bg-black/50 backdrop-blur-md p-2 rounded-full border border-white/10">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="flex items-center space-x-2">
          <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium text-slate-300 border border-white/10">
            Team 1: {currentPhase === 'finished' ? replayData.finalScores[0] : teamScores[0]}
          </div>
          {trump && (
            <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-white border border-white/10 flex items-center">
              Trump: <span className="ml-1"><SuitIcon suit={trump} /></span>
            </div>
          )}
          <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium text-slate-300 border border-white/10">
            Team 2: {currentPhase === 'finished' ? replayData.finalScores[1] : teamScores[1]}
          </div>
        </div>
      </header>

      {/* Player Labels (4 positions) */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 text-center">
        <span className="bg-black/40 backdrop-blur-md px-2 py-1 rounded text-xs text-slate-300 border border-white/10">
          {replayData.fancyNames[2]}
        </span>
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 left-2 z-20">
        <span className="bg-black/40 backdrop-blur-md px-2 py-1 rounded text-xs text-slate-300 border border-white/10">
          {replayData.fancyNames[1]}
        </span>
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 right-2 z-20">
        <span className="bg-black/40 backdrop-blur-md px-2 py-1 rounded text-xs text-slate-300 border border-white/10">
          {replayData.fancyNames[3]}
        </span>
      </div>

      {/* Auction Phase Info */}
      {currentPhase === 'auction' && currentMove?.type === 'bid' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="glass-panel rounded-2xl p-6 text-center max-w-xs">
            <h3 className="text-lg font-bold mb-2">Auction</h3>
            {currentMove.bid?.isPass ? (
              <p className="text-slate-400">{replayData.fancyNames[currentMove.playerIndex]} passed</p>
            ) : (
              <div className="flex items-center justify-center space-x-2 text-xl font-bold">
                <span>{replayData.fancyNames[currentMove.playerIndex]}:</span>
                <span>{currentMove.bid?.amount}</span>
                {currentMove.bid?.suit && <SuitIcon suit={currentMove.bid.suit} size={24} />}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Current Trick / Center */}
      <div className="flex-1 flex items-center justify-center relative z-20">
        {currentTrick.map((t, idx) => {
          const offset = t.playerIndex;
          let translateClass = '';
          if (offset === 0) translateClass = 'translate-y-12';
          if (offset === 1) translateClass = '-translate-x-12 -rotate-90';
          if (offset === 2) translateClass = '-translate-y-12';
          if (offset === 3) translateClass = 'translate-x-12 rotate-90';

          return (
            <div key={idx} className={`absolute transition-all duration-300 ${translateClass}`}>
              <PlayingCard rank={t.card.rank} suit={t.card.suit} small />
            </div>
          );
        })}
      </div>

      {/* Bottom player hand */}
      <div className="h-28 relative z-20 pointer-events-none">
        <div className="absolute bottom-16 left-0 right-0 flex justify-center px-4">
          <div className="flex -space-x-4">
            {hands[0]?.map((card, idx) => (
              <PlayingCard key={`${card.rank}-${card.suit}-${idx}`} rank={card.rank} suit={card.suit} small disabled />
            ))}
          </div>
        </div>
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
          <span className="bg-black/40 backdrop-blur-md px-2 py-1 rounded text-xs text-slate-300 border border-white/10">
            {replayData.fancyNames[0]}
          </span>
        </div>
      </div>

      {/* Finished Overlay */}
      {currentPhase === 'finished' && (
        <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="glass-panel rounded-2xl p-8 text-center max-w-sm">
            <h3 className="text-2xl font-bold mb-4">Game Over</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className={`p-3 rounded-lg ${replayData.finalScores[0] > replayData.finalScores[1] ? 'bg-game-success/20 border border-game-success/30' : 'bg-slate-800'}`}>
                <p className="text-xs text-slate-400 mb-1">Team 1</p>
                <p className="text-2xl font-bold">{replayData.finalScores[0]}</p>
              </div>
              <div className={`p-3 rounded-lg ${replayData.finalScores[1] > replayData.finalScores[0] ? 'bg-game-success/20 border border-game-success/30' : 'bg-slate-800'}`}>
                <p className="text-xs text-slate-400 mb-1">Team 2</p>
                <p className="text-2xl font-bold">{replayData.finalScores[1]}</p>
              </div>
            </div>
            <button
              onClick={() => { setCurrentMoveIndex(-1); setIsPlaying(false); }}
              className="bg-game-accent text-white px-6 py-2 rounded-lg font-medium mr-2"
            >
              Watch Again
            </button>
            <button
              onClick={() => navigate('/replays')}
              className="bg-slate-700 text-white px-6 py-2 rounded-lg font-medium"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Playback Controls */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-game-card/95 backdrop-blur-md border-t border-slate-700/50 p-3">
        {/* Progress Bar */}
        <div className="w-full bg-slate-800 rounded-full h-1 mb-3">
          <div
            className="bg-game-accent h-1 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-center space-x-4">
          <button onClick={handleStepBack} className="text-slate-400 hover:text-white transition-colors p-2">
            <SkipBack size={20} />
          </button>
          <button
            onClick={handlePlayPause}
            className="w-12 h-12 rounded-full bg-game-accent flex items-center justify-center shadow-lg shadow-game-accent/30"
          >
            {isPlaying ? <Pause size={20} className="text-white" /> : <Play size={20} className="text-white ml-0.5" />}
          </button>
          <button onClick={handleStepForward} className="text-slate-400 hover:text-white transition-colors p-2">
            <SkipForward size={20} />
          </button>
          <button
            onClick={cycleSpeed}
            className="flex items-center space-x-1 text-slate-400 hover:text-white transition-colors p-2"
          >
            <FastForward size={16} />
            <span className="text-xs font-bold">{speed}x</span>
          </button>
        </div>

        <p className="text-center text-xs text-slate-500 mt-1">
          Move {Math.max(0, currentMoveIndex + 1)} / {totalMoves}
        </p>
      </div>
    </div>
  );
};

export default ReplayView;
