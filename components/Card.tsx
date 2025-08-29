import React from 'react';
import { Card as CardType, CardFaceType } from '../types';
import { NUMBER_CARD_COLORS } from '../constants';

interface CardProps {
  card?: CardType;
  isFaceDown?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const Card: React.FC<CardProps> = ({ card, isFaceDown = false, className = '', style }) => {
  const cardBaseClasses = "relative w-24 h-36 sm:w-28 sm:h-40 rounded-lg shadow-lg flex items-center justify-center p-2 text-center transition-transform transform";
  
  if (isFaceDown) {
    const cardBackClasses = "bg-blue-600 bg-gradient-to-br from-blue-500 to-blue-700 border-4 border-blue-400";
    return (
      <div className={`${cardBaseClasses} ${cardBackClasses} ${className}`} style={style}>
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-24 border-2 border-blue-300 rounded-md opacity-50"></div>
        </div>
      </div>
    );
  }

  if (!card) return null;

  const renderCardContent = () => {
    switch (card.type) {
      case CardFaceType.Number:
        const colorClass = NUMBER_CARD_COLORS[card.value || 0] || 'text-slate-800';
        return (
          <div className="w-full h-full bg-white text-slate-800 rounded-lg flex flex-col justify-between p-2">
            <span className={`text-xl font-bold self-start ${colorClass}`}>{card.value}</span>
            <span className={`text-5xl font-extrabold ${colorClass}`}>{card.value}</span>
            <span className={`text-xl font-bold self-end transform rotate-180 ${colorClass}`}>{card.value}</span>
          </div>
        );
      case CardFaceType.SecondChance:
        return (
          <div className="w-full h-full bg-amber-400 text-slate-900 rounded-lg flex flex-col items-center justify-center p-2 font-bold">
            <div className="text-5xl mb-2">🔄</div>
            <span className="text-lg leading-tight">Second Chance</span>
          </div>
        );
      case CardFaceType.Double:
        return (
          <div className="w-full h-full bg-purple-500 text-white rounded-lg flex flex-col items-center justify-center p-2 font-bold">
            <div className="text-5xl mb-2">x2</div>
            <span className="text-lg leading-tight">Double Score</span>
          </div>
        );
      case CardFaceType.FlipThree:
        return (
          <div className="w-full h-full bg-sky-500 text-white rounded-lg flex flex-col items-center justify-center p-2 font-bold">
            <div className="text-5xl mb-2">🃏+3</div>
            <span className="text-lg leading-tight">Flip Three</span>
          </div>
        );
      case CardFaceType.Stop:
        return (
          <div className="w-full h-full bg-red-600 text-white rounded-lg flex flex-col items-center justify-center p-2 font-bold">
            <div className="text-5xl mb-2">🛑</div>
            <span className="text-lg leading-tight">Stop</span>
          </div>
        );
      case CardFaceType.Bonus:
        return (
          <div className="w-full h-full bg-orange-500 text-white rounded-lg flex flex-col items-center justify-center p-2 font-bold">
            <div className="text-5xl mb-2">+{card.value}</div>
            <span className="text-lg leading-tight">Bonus</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`${cardBaseClasses} ${className}`} style={style}>
       {renderCardContent()}
    </div>
  );
};

export default Card;