import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card as CardType, GameState, CardFaceType, Player } from './types';
import { GAME_WIN_SCORE, FLIP_7_BONUS, FLIP_7_CARD_COUNT, DECK_COMPOSITION } from './constants';
import Card from './components/Card';

const createDeck = (): CardType[] => {
  const deck: CardType[] = [];
  DECK_COMPOSITION.NUMBER_CARDS.forEach(config => {
    for (let i = 0; i < config.count; i++) {
      deck.push({ type: CardFaceType.Number, value: config.value, id: `num-${config.value}-${i}` });
    }
  });
  DECK_COMPOSITION.ACTION_CARDS.forEach(config => {
    for (let i = 0; i < config.count; i++) {
      deck.push({ type: config.type, id: `action-${config.type}-${i}` });
    }
  });
  DECK_COMPOSITION.MODIFIER_CARDS.forEach(config => {
    for (let i = 0; i < config.count; i++) {
      deck.push({ type: config.type, id: `mod-${config.type}-${i}` });
    }
  });
  return deck;
};

const shuffleDeck = (deck: CardType[]): CardType[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const processSingleCardDraw = (
    drawnCard: CardType,
    currentPlayers: Player[],
    currentPlayerIdx: number
  ): { 
      newPlayers: Player[]; 
      result: { shouldEndTurn: boolean; shouldEndRound: boolean; isFlipThree: boolean };
      message: string;
    } => {
    
    const newPlayers = JSON.parse(JSON.stringify(currentPlayers));
    const player = newPlayers[currentPlayerIdx];
    let result = { shouldEndTurn: false, shouldEndRound: false, isFlipThree: false };
    let message = '';
    
    player.hand.push(drawnCard);

    switch (drawnCard.type) {
      case CardFaceType.Number: {
        const numberCards = player.hand.filter((c: CardType) => c.type === CardFaceType.Number);
        const isDuplicate = numberCards.filter((c: CardType) => c.value === drawnCard.value).length > 1;

        if (isDuplicate) {
          if (player.hasSecondChance) {
            player.hasSecondChance = false;
            player.hand.pop(); // Discard the drawn duplicate card
            const scIndex = player.hand.findIndex((c: CardType) => c.type === CardFaceType.SecondChance);
            if (scIndex > -1) player.hand.splice(scIndex, 1); // Discard the second chance card
            message = `${player.name} used Second Chance!`;
          } else {
            player.isBusted = true;
            result.shouldEndTurn = true;
            message = `${player.name} busted!`;
          }
        } else if (numberCards.length >= FLIP_7_CARD_COUNT) {
            result.shouldEndRound = true;
            message = `${player.name} got a Flip 7!`;
        }
        break;
      }
      case CardFaceType.SecondChance: {
        if (player.hasSecondChance) {
          player.hand.pop(); // Remove the second chance card from the current player's hand
          let given = false;
          for (let i = 1; i < newPlayers.length; i++) {
            const targetIndex = (currentPlayerIdx + i) % newPlayers.length;
            if (!newPlayers[targetIndex].hasSecondChance) {
              newPlayers[targetIndex].hand.push(drawnCard);
              newPlayers[targetIndex].hasSecondChance = true;
              message = `${player.name} gave Second Chance to ${newPlayers[targetIndex].name}.`;
              given = true;
              break;
            }
          }
          if (!given) message = `Extra Second Chance was discarded.`;
        } else {
          player.hasSecondChance = true;
          message = `${player.name} got a Second Chance card!`;
        }
        break;
      }
      case CardFaceType.Stop:
        player.isStaying = true;
        result.shouldEndTurn = true;
        message = `${player.name} drew a Stop card. Turn ends.`;
        break;
      case CardFaceType.Double:
        player.hasDoubleModifier = true;
        message = `${player.name} got a Double Score card!`;
        break;
      case CardFaceType.FlipThree:
        result.isFlipThree = true;
        message = `${player.name} drew Flip Three!`;
        break;
    }
    
    return { newPlayers, result, message };
};


const App: React.FC = () => {
  const [deck, setDeck] = useState<CardType[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [numPlayers, setNumPlayers] = useState(2);
  const [gameState, setGameState] = useState<GameState>(GameState.Setup);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [roundMessage, setRoundMessage] = useState('');
  const [winner, setWinner] = useState<Player | null>(null);

  const resetGame = useCallback(() => {
    setGameState(GameState.Setup);
    setPlayers([]);
    setWinner(null);
    setActionMessage('');
  }, []);

  const startGame = () => {
    const initialPlayers: Player[] = Array.from({ length: numPlayers }, (_, i) => ({
      id: i,
      name: `Player ${i + 1}`,
      totalScore: 0,
      hand: [],
      hasSecondChance: false,
      hasDoubleModifier: false,
      isStaying: false,
      isBusted: false,
    }));
    setPlayers(initialPlayers);
    setDeck(shuffleDeck(createDeck()));
    setCurrentPlayerIndex(0);
    setGameState(GameState.PlayerTurn);
  };

  const handleEndRound = useCallback((finalPlayersState: Player[]) => {
    let roundSummary = '';
    const updatedPlayers = finalPlayersState.map(player => {
      if (player.isBusted) {
        roundSummary += `${player.name} busted. `;
        return { ...player };
      }
      
      const numberCards = player.hand.filter(c => c.type === CardFaceType.Number);
      let bankedScore = numberCards.reduce((sum, card) => sum + (card.value || 0), 0);
      
      if (numberCards.length >= FLIP_7_CARD_COUNT) {
         bankedScore += FLIP_7_BONUS;
      }
      if (player.hasDoubleModifier) {
        bankedScore *= 2;
      }

      roundSummary += `${player.name} banked ${bankedScore} points. `;
      return { ...player, totalScore: player.totalScore + bankedScore };
    });

    const potentialWinner = updatedPlayers.find(p => p.totalScore >= GAME_WIN_SCORE);

    setPlayers(updatedPlayers);
    setRoundMessage(roundSummary);
    
    if (potentialWinner) {
      const gameWinner = updatedPlayers.reduce((best, current) => current.totalScore > best.totalScore ? current : best);
      setWinner(gameWinner);
      setGameState(GameState.GameOver);
    } else {
      setGameState(GameState.RoundOver);
    }
  }, []);

  const startNewRound = useCallback(() => {
    setPlayers(prevPlayers => prevPlayers.map(p => ({
      ...p,
      hand: [],
      hasSecondChance: false,
      hasDoubleModifier: false,
      isStaying: false,
      isBusted: false,
    })));
    setRoundMessage('');
    setWinner(null);
    setCurrentPlayerIndex(0);
    setGameState(GameState.PlayerTurn);
    setDeck(prevDeck => prevDeck.length < 20 ? shuffleDeck(createDeck()) : shuffleDeck(prevDeck));
  }, []);

  const nextTurn = useCallback((currentPlayersState: Player[]) => {
    let nextPlayerIndex = currentPlayerIndex;
    let checkedCount = 0;
    
    do {
      nextPlayerIndex = (nextPlayerIndex + 1) % currentPlayersState.length;
      checkedCount++;
    } while (
        (currentPlayersState[nextPlayerIndex]?.isBusted || currentPlayersState[nextPlayerIndex]?.isStaying) &&
        checkedCount < currentPlayersState.length
    );
    
    const allPlayersDone = currentPlayersState.every(p => p.isBusted || p.isStaying);

    if (allPlayersDone) {
      handleEndRound(currentPlayersState);
    } else {
      setCurrentPlayerIndex(nextPlayerIndex);
    }
  }, [currentPlayerIndex, handleEndRound]);

  const handleHit = async () => {
    if (gameState !== GameState.PlayerTurn || deck.length === 0 || isProcessingAction) return;

    setIsProcessingAction(true);
    setActionMessage('');

    let currentDeck = [...deck];
    let currentPlayersState = players;

    const drawCardAndUpdate = (deck: CardType[], players: Player[]) => {
        const drawnCard = deck.pop()!;
        const { newPlayers, result, message } = processSingleCardDraw(drawnCard, players, currentPlayerIndex);
        
        if(message) setActionMessage(message);

        setPlayers(newPlayers);
        setDeck(deck);
        return { updatedPlayers: newPlayers, result };
    };

    let roundEnded = false;
    let turnEnded = false;

    // --- First Draw ---
    const { updatedPlayers: playersAfterFirst, result: firstResult } = drawCardAndUpdate(currentDeck, currentPlayersState);
    currentPlayersState = playersAfterFirst;
    
    if (firstResult.shouldEndRound) {
        roundEnded = true;
    } else if (firstResult.shouldEndTurn) {
        turnEnded = true;
    }

    // --- Flip Three Sequence ---
    if (firstResult.isFlipThree && !roundEnded && !turnEnded) {
        await new Promise(r => setTimeout(r, 1200));

        for (let i = 0; i < 3; i++) {
            if (currentDeck.length === 0) {
                setActionMessage('Deck is empty!');
                await new Promise(r => setTimeout(r, 1500));
                break;
            }

            await new Promise(r => setTimeout(r, 800));

            const { updatedPlayers: playersAfterFlip, result: flipResult } = drawCardAndUpdate(currentDeck, currentPlayersState);
            currentPlayersState = playersAfterFlip;

            if (flipResult.shouldEndRound) {
                roundEnded = true;
                break;
            }
            if (flipResult.shouldEndTurn) {
                turnEnded = true;
                break;
            }
        }
    }

    // --- Finalize Turn/Round ---
    if (roundEnded) {
        handleEndRound(currentPlayersState);
    } else if (turnEnded) {
        nextTurn(currentPlayersState);
    }
    
    if (!roundEnded) {
        setTimeout(() => setActionMessage(''), 2500);
    }
    setIsProcessingAction(false);
  };
  
  const handleStay = () => {
    if (gameState !== GameState.PlayerTurn || isProcessingAction) return;
    setPlayers(prev => {
        const newPlayers = JSON.parse(JSON.stringify(prev));
        newPlayers[currentPlayerIndex].isStaying = true;
        nextTurn(newPlayers);
        return newPlayers;
    });
  };

  const currentPlayer = useMemo(() => players[currentPlayerIndex], [players, currentPlayerIndex]);
  const numberCardsInCurrentHand = useMemo(() => currentPlayer?.hand.filter(c => c.type === CardFaceType.Number) ?? [], [currentPlayer]);
  const currentRoundScore = useMemo(() => numberCardsInCurrentHand.reduce((sum, card) => sum + (card.value || 0), 0), [numberCardsInCurrentHand]);

  if (gameState === GameState.Setup) {
      return (
        <main className="min-h-screen w-full bg-cover bg-center flex flex-col justify-center items-center p-4 sm:p-6" style={{backgroundImage: 'radial-gradient(circle, #166534, #14532d, #103b22, #052e16)'}}>
          <div className="text-center p-8 bg-black bg-opacity-50 rounded-xl flex flex-col items-center animate-fade-in">
              <h1 className="text-6xl font-extrabold mb-4 text-yellow-300 tracking-wider" style={{fontFamily: 'serif'}}>Flip 7</h1>
              <div className="mb-6">
                  <label htmlFor="numPlayers" className="text-xl mr-4">Number of Players:</label>
                  <select id="numPlayers" value={numPlayers} onChange={e => setNumPlayers(parseInt(e.target.value, 10))} className="bg-slate-800 text-white p-2 rounded-lg text-lg">
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                  </select>
              </div>
              <button onClick={startGame} className="px-8 py-4 text-xl font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105 bg-green-500 hover:bg-green-600 text-white">
                Start Game
              </button>
          </div>
        </main>
      );
  }

  const renderEndScreen = () => {
      const isGameOver = gameState === GameState.GameOver;
      return (
        <div className="absolute inset-0 bg-black bg-opacity-80 flex flex-col justify-center items-center z-20 animate-fade-in text-center p-4">
          <h2 className={`text-5xl sm:text-6xl font-extrabold ${isGameOver ? 'text-green-400' : 'text-yellow-400'}`}>{isGameOver ? `${winner?.name} Wins!` : 'Round Over'}</h2>
          <p className="text-lg sm:text-xl mt-4 max-w-2xl">{roundMessage}</p>
          <div className="mt-6 space-y-2">
            {players.map(p => (
              <p key={p.id} className="text-xl"><span className="font-bold">{p.name}'s Score:</span> {p.totalScore}</p>
            ))}
          </div>
          <button onClick={isGameOver ? resetGame : startNewRound} className="px-6 py-3 text-lg font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105 bg-yellow-500 hover:bg-yellow-600 text-black mt-8">
            {isGameOver ? 'Play Again' : 'Next Round'}
          </button>
        </div>
      );
  }

  return (
    <main className="min-h-screen w-full bg-cover bg-center flex flex-col items-center p-2 sm:p-4" style={{backgroundImage: 'radial-gradient(circle, #166534, #14532d, #103b22, #052e16)'}}>
       {(gameState === GameState.RoundOver || gameState === GameState.GameOver) && renderEndScreen()}
      
      <header className="w-full max-w-6xl grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-black bg-opacity-20 rounded-lg shadow-xl mb-4">
        {players.map((player, index) => (
           <div key={player.id} className={`p-3 rounded-lg text-center transition-all duration-300 ${index === currentPlayerIndex && gameState === GameState.PlayerTurn ? 'bg-yellow-400 text-slate-900 scale-105 shadow-2xl' : 'bg-slate-800'}`}>
              <span className="text-sm font-bold block truncate">{player.name} {player.isBusted ? ' (BUSTED)' : player.isStaying ? ' (STAY)' : ''}</span>
              <span className="text-2xl font-bold">{player.totalScore}</span>
               <div className="flex justify-center space-x-1 mt-1 text-xs">
                 {player.hasSecondChance && <span title="Second Chance">🔄</span>}
                 {player.hasDoubleModifier && <span title="Double Score">x2</span>}
               </div>
           </div>
        ))}
      </header>
      
      {currentPlayer && gameState === GameState.PlayerTurn && <div className="relative flex-grow w-full max-w-5xl flex flex-col justify-center items-center">
          <div className="w-full flex flex-col items-center animate-fade-in">
             <div className="h-8 mb-2 text-yellow-300 text-center font-semibold">{actionMessage}</div>
            <div className="h-44 sm:h-48 mb-4 flex items-center justify-center p-2 min-w-full">
              {currentPlayer.hand.length === 0 && <p className="text-slate-400">{currentPlayer.name}, your hand is empty. Hit to draw a card!</p>}
              {currentPlayer.hand.map((card, index) => (
                <Card key={card.id} card={card} className={`absolute`} style={{ transform: `translateX(${(index - (currentPlayer.hand.length - 1) / 2) * 45}px) rotate(${(index - (currentPlayer.hand.length - 1) / 2) * 5}deg)` }}/>
              ))}
            </div>

            <div className="mb-6 text-center">
              <span className="text-sm text-slate-300 block">{currentPlayer.name}'s Round Score</span>
              <span className={`text-6xl font-bold text-white`}>{currentRoundScore}</span>
            </div>

            <div className="flex items-center space-x-4 mb-8">
                <Card isFaceDown={true} />
                <span className="text-xl font-bold">{deck.length} cards left</span>
            </div>

            <div className="flex space-x-4">
              <button onClick={handleHit} disabled={isProcessingAction || gameState !== GameState.PlayerTurn} className="px-6 py-3 text-lg font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 bg-blue-500 hover:bg-blue-600 text-white">Hit</button>
              <button onClick={handleStay} disabled={isProcessingAction || gameState !== GameState.PlayerTurn || numberCardsInCurrentHand.length === 0} className="px-6 py-3 text-lg font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 bg-red-500 hover:bg-red-600 text-white">Stay</button>
            </div>
          </div>
      </div>}
    </main>
  );
};

export default App;
