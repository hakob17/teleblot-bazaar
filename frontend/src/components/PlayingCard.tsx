import React from 'react';
import SuitIcon from './SuitIcon';

interface PlayingCardProps {
  rank: string;
  suit: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  small?: boolean;
}

const PlayingCard: React.FC<PlayingCardProps> = ({ rank, suit, onClick, disabled, active, small }) => {
  const isRed = suit === 'HEARTS' || suit === 'DIAMONDS';
  const sizeClass = small ? 'w-10 sm:w-12' : 'w-14 sm:w-20';

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={`playing-card ${sizeClass} ${isRed ? 'red' : 'black'} ${disabled ? 'opacity-50 cursor-not-allowed transform-none' : ''} ${active ? '-translate-y-4 shadow-xl ring-2 ring-game-accent' : ''}`}
    >
      <div className="absolute top-1 left-1.5 flex flex-col items-center">
        <span className={`${small ? 'text-xs' : 'text-sm sm:text-lg'} font-bold leading-none`}>{rank}</span>
        <SuitIcon suit={suit} size={small ? 10 : 14} />
      </div>

      <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
        <SuitIcon suit={suit} size={small ? 24 : 40} />
      </div>

      <div className="absolute bottom-1 right-1.5 flex flex-col items-center rotate-180">
        <span className={`${small ? 'text-xs' : 'text-sm sm:text-lg'} font-bold leading-none`}>{rank}</span>
        <SuitIcon suit={suit} size={small ? 10 : 14} />
      </div>
    </div>
  );
};

export default PlayingCard;
