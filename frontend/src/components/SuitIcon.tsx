import React from 'react';

const SuitIcon: React.FC<{ suit: string; size?: number }> = ({ suit, size = 16 }) => {
  switch (suit) {
    case 'HEARTS': return <span style={{ fontSize: size }} className="text-red-500">&#9829;</span>;
    case 'DIAMONDS': return <span style={{ fontSize: size }} className="text-red-500">&#9830;</span>;
    case 'CLUBS': return <span style={{ fontSize: size }} className="text-slate-100">&#9827;</span>;
    case 'SPADES': return <span style={{ fontSize: size }} className="text-slate-100">&#9824;</span>;
    default: return null;
  }
};

export default SuitIcon;
