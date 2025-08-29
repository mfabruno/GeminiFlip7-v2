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
  DECK_COMPOSITION.BONUS_CARDS.forEach(config => {
    for (let i = 0; i < config.count; i++) {
      deck.push({ type: CardFaceType.Bonus, value: config.value, id: `bonus-${config.value}-${i}` });
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
      result: { shouldEndTurn: boolean; shouldEndRound: boolean; isFlipThree: boolean; isBust: boolean };
      message: string;
    } => {
    
    const newPlayers = JSON.parse(JSON.stringify(currentPlayers));
    const player = newPlayers[currentPlayerIdx];
    let result = { shouldEndTurn: false, shouldEndRound: false, isFlipThree: false, isBust: false };
    let message = '';
    
    player.hand.push(drawnCard);

    switch (drawnCard.type) {
      case CardFaceType.Number: {
        message = `${player.name} drew a ${drawnCard.value}.`;
        const numberCards = player.hand.filter((c: CardType) => c.type === CardFaceType.Number);
        const isDuplicate = numberCards.filter((c: CardType) => c.value === drawnCard.value).length > 1;

        if (isDuplicate) {
          if (player.hasSecondChance) {
            player.hasSecondChance = false;
            // Find and remove the drawn duplicate card
            const duplicateCardIndex = player.hand.findLastIndex((c: CardType) => c.id === drawnCard.id);
            if(duplicateCardIndex > -1) player.hand.splice(duplicateCardIndex, 1);
            
            // Find and remove the Second Chance card
            const scIndex = player.hand.findIndex((c: CardType) => c.type === CardFaceType.SecondChance);
            if (scIndex > -1) player.hand.splice(scIndex, 1);
            message = `${player.name} drew a duplicate ${drawnCard.value} but was saved by Second Chance!`;
          } else {
            player.isBusted = true;
            result.shouldEndTurn = true;
            result.isBust = true;
            message = `${player.name} drew a duplicate ${drawnCard.value} and BUSTED!`;
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
              message = `${player.name} already had a Second Chance, so they gave the new one to ${newPlayers[targetIndex].name}.`;
              given = true;
              break;
            }
          }
          if (!given) message = `${player.name} drew an extra Second Chance, but everyone already has one. It was discarded.`;
        } else {
          player.hasSecondChance = true;
          message = `${player.name} got a Second Chance card!`;
        }
        break;
      }
      case CardFaceType.Stop:
        player.isStaying = true;
        result.shouldEndTurn = true;
        message = `${player.name} drew a Stop card and must end their turn.`;
        break;
      case CardFaceType.Double:
        player.hasDoubleModifier = true;
        message = `${player.name} got a Double Score card!`;
        break;
      case CardFaceType.FlipThree:
        result.isFlipThree = true;
        message = `${player.name} drew Flip Three! Drawing 3 more cards...`;
        break;
      case CardFaceType.Bonus:
        message = `${player.name} drew a +${drawnCard.value} Bonus card!`;
        break;
    }
    
    return { newPlayers, result, message };
};


const App: React.FC = () => {
  const [deck, setDeck] = useState<CardType[]>([]);
  const [discardPile, setDiscardPile] = useState<CardType[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [numPlayers, setNumPlayers] = useState(2);
  const [gameState, setGameState] = useState<GameState>(GameState.Setup);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [roundMessage, setRoundMessage] = useState('');
  const [winner, setWinner] = useState<Player | null>(null);
  const [gameLog, setGameLog] = useState<string[]>([]);

  const logAction = useCallback((message: string) => {
    if (!message) return;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit'});
    setGameLog(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 100)); // Keep log to 100 entries
  }, []);

  const resetGame = useCallback(() => {
    setGameState(GameState.Setup);
    setPlayers([]);
    setWinner(null);
    setActionMessage('');
    setGameLog([]);
    setDeck([]);
    setDiscardPile([]);
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
    setDiscardPile([]);
    setCurrentPlayerIndex(0);
    setGameState(GameState.PlayerTurn);
    setGameLog([`Game started with ${numPlayers} players.`]);
  };

  const handleEndRound = useCallback((finalPlayersState: Player[]) => {
    let roundSummary = 'Round over! ';
    let cardsToDiscard: CardType[] = [];

    const updatedPlayers = finalPlayersState.map(player => {
      cardsToDiscard.push(...player.hand);
      if (player.isBusted) {
        roundSummary += `${player.name} busted. `;
        return { ...player };
      }
      
      const numberCards = player.hand.filter(c => c.type === CardFaceType.Number);
      const bonusCards = player.hand.filter(c => c.type === CardFaceType.Bonus);
      
      let bankedScore = numberCards.reduce((sum, card) => sum + (card.value || 0), 0);
      bankedScore += bonusCards.reduce((sum, card) => sum + (card.value || 0), 0);
      
      if (numberCards.length >= FLIP_7_CARD_COUNT) {
         bankedScore += FLIP_7_BONUS;
         roundSummary += `${player.name} got a Flip 7! (+${FLIP_7_BONUS} bonus). `;
      }
      if (player.hasDoubleModifier) {
        bankedScore *= 2;
        roundSummary += `Their score is doubled! `;
      }

      roundSummary += `${player.name} banked ${bankedScore} points. `;
      return { ...player, totalScore: player.totalScore + bankedScore };
    });

    logAction(roundSummary);
    setDiscardPile(prev => [...prev, ...cardsToDiscard]);

    const potentialWinner = updatedPlayers.find(p => p.totalScore >= GAME_WIN_SCORE);

    setPlayers(updatedPlayers);
    setRoundMessage(roundSummary);
    
    if (potentialWinner) {
      const gameWinner = updatedPlayers.reduce((best, current) => current.totalScore > best.totalScore ? current : best);
      setWinner(gameWinner);
      setGameState(GameState.GameOver);
      logAction(`${gameWinner.name} wins the game with a score of ${gameWinner.totalScore}!`);
    } else {
      setGameState(GameState.RoundOver);
    }
  }, [logAction]);

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
    const nextDealerIndex = 0; // Simplified for now, can be rotated
    setCurrentPlayerIndex(nextDealerIndex);
    setGameState(GameState.PlayerTurn);
    logAction('Starting a new round.');
  }, [logAction]);

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
      logAction(`It's ${currentPlayersState[nextPlayerIndex].name}'s turn.`);
    }
  }, [currentPlayerIndex, handleEndRound, logAction]);

  const handleHit = async () => {
    if (gameState !== GameState.PlayerTurn || isProcessingAction) return;
    
    let currentDeck = [...deck];
    let currentDiscardPile = [...discardPile];
    
    if (currentDeck.length === 0) {
      if (currentDiscardPile.length === 0) {
        setActionMessage("No cards left in deck or discard pile!");
        return;
      }
      logAction("Deck is empty. Shuffling discard pile...");
      await new Promise(r => setTimeout(r, 500));
      currentDeck = shuffleDeck(currentDiscardPile);
      currentDiscardPile = [];
      setDeck(currentDeck);
      setDiscardPile([]);
    }

    setIsProcessingAction(true);
    setActionMessage('');

    let currentPlayersState = players;

    const drawCardAndUpdate = (d: CardType[], p: Player[]) => {
        const drawnCard = d.pop()!;
        const { newPlayers, result, message } = processSingleCardDraw(drawnCard, p, currentPlayerIndex);
        
        if(message) {
          setActionMessage(message);
          logAction(message);
        }

        setPlayers(newPlayers);
        setDeck(d);
        return { updatedPlayers: newPlayers, result, updatedDeck: d };
    };

    let roundEnded = false;
    let turnEnded = false;
    let wasBust = false;

    // --- First Draw ---
    const { updatedPlayers: playersAfterFirst, result: firstResult, updatedDeck: deckAfterFirst } = drawCardAndUpdate(currentDeck, currentPlayersState);
    currentPlayersState = playersAfterFirst;
    currentDeck = deckAfterFirst;
    
    if (firstResult.shouldEndRound) {
        roundEnded = true;
    } else if (firstResult.shouldEndTurn) {
        turnEnded = true;
        wasBust = firstResult.isBust;
    }

    // --- Flip Three Sequence ---
    if (firstResult.isFlipThree && !roundEnded && !turnEnded) {
        await new Promise(r => setTimeout(r, 1200));

        for (let i = 0; i < 3; i++) {
            if (currentDeck.length === 0) {
                if(currentDiscardPile.length > 0) {
                  logAction("Deck ran out during Flip Three. Shuffling discard pile...");
                  await new Promise(r => setTimeout(r, 500));
                  currentDeck = shuffleDeck(currentDiscardPile);
                  currentDiscardPile = [];
                  setDeck(currentDeck);
                  setDiscardPile([]);
                } else {
                   const emptyDeckMsg = 'Deck is empty!';
                   setActionMessage(emptyDeckMsg);
                   logAction(emptyDeckMsg);
                   await new Promise(r => setTimeout(r, 1500));
                   turnEnded = true; // End turn if no more cards can be drawn
                   break;
                }
            }

            await new Promise(r => setTimeout(r, 1000));

            const { updatedPlayers: playersAfterFlip, result: flipResult, updatedDeck: deckAfterFlip } = drawCardAndUpdate(currentDeck, currentPlayersState);
            currentPlayersState = playersAfterFlip;
            currentDeck = deckAfterFlip;

            if (flipResult.shouldEndRound) {
                roundEnded = true;
                break;
            }
            if (flipResult.shouldEndTurn) {
                turnEnded = true;
                wasBust = flipResult.isBust;
                break;
            }
        }
    }

    // --- Finalize Turn/Round ---
    if (roundEnded) {
        handleEndRound(currentPlayersState);
    } else if (turnEnded) {
        if(wasBust) {
            await new Promise(r => setTimeout(r, 1500));
        }
        nextTurn(currentPlayersState);
    }
    
    setIsProcessingAction(false);
  };
  
  const handleStay = () => {
    if (gameState !== GameState.PlayerTurn || isProcessingAction) return;
    setActionMessage('');
    const stayMessage = `${players[currentPlayerIndex].name} chose to stay.`;
    logAction(stayMessage);

    setPlayers(prev => {
        const newPlayers = JSON.parse(JSON.stringify(prev));
        newPlayers[currentPlayerIndex].isStaying = true;
        setActionMessage(`${newPlayers[currentPlayerIndex].name} is staying.`);
        nextTurn(newPlayers);
        return newPlayers;
    });
  };

  const currentPlayer = useMemo(() => players[currentPlayerIndex], [players, currentPlayerIndex]);
  const numberCardsInCurrentHand = useMemo(() => currentPlayer?.hand.filter(c => c.type === CardFaceType.Number) ?? [], [currentPlayer]);
  const currentRoundScore = useMemo(() => {
    if (!currentPlayer) return 0;
    return currentPlayer.hand.reduce((sum, card) => {
      if (card.type === CardFaceType.Number || card.type === CardFaceType.Bonus) {
        return sum + (card.value || 0);
      }
      return sum;
    }, 0);
  }, [currentPlayer]);
  
  const canHit = deck.length > 0 || discardPile.length > 0;

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
                      <option value="5">5</option>
                      <option value="6">6</option>
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
    <main className="min-h-screen w-full bg-cover bg-center flex flex-col lg:flex-row items-start p-2 sm:p-4" style={{backgroundImage: 'radial-gradient(circle, #166534, #14532d, #103b22, #052e16)'}}>
       {(gameState === GameState.RoundOver || gameState === GameState.GameOver) && renderEndScreen()}
      
       <div className="flex-grow w-full lg:w-auto flex flex-col items-center">
        <header className="w-full max-w-7xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 p-4 bg-black bg-opacity-20 rounded-lg shadow-xl mb-4">
          {players.map((player, index) => (
            <div key={player.id} className={`p-3 rounded-lg text-center transition-all duration-300 ${index === currentPlayerIndex && gameState === GameState.PlayerTurn ? 'bg-yellow-400 text-slate-900 scale-105 shadow-2xl' : 'bg-slate-800'}`}>
                <span className="text-sm font-bold block truncate">{player.name} {player.isBusted ? ' (BUST)' : player.isStaying ? ' (STAY)' : ''}</span>
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
              <div className="h-8 mb-2 text-yellow-300 text-center font-semibold text-lg">{actionMessage}</div>
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
                <button onClick={handleHit} disabled={isProcessingAction || gameState !== GameState.PlayerTurn || !canHit} className="px-6 py-3 text-lg font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 bg-blue-500 hover:bg-blue-600 text-white">Hit</button>
                <button onClick={handleStay} disabled={isProcessingAction || gameState !== GameState.PlayerTurn || numberCardsInCurrentHand.length === 0} className="px-6 py-3 text-lg font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 bg-red-500 hover:bg-red-600 text-white">Stay</button>
              </div>
            </div>
        </div>}
      </div>

      <aside className="w-full lg:w-96 p-4 bg-black bg-opacity-30 rounded-lg lg:ml-4 mt-4 lg:mt-0 self-stretch">
        <h3 className="text-2xl font-bold mb-4 text-yellow-300 border-b-2 border-yellow-400 pb-2">Game Log</h3>
        <div className="h-96 lg:h-[calc(100vh-8rem)] overflow-y-auto pr-2 space-y-2 text-sm flex flex-col-reverse">
          {gameLog.map((entry, index) => (
            <p key={index} className="text-slate-300 leading-snug animate-fade-in-short">{entry}</p>
          ))}
        </div>
      </aside>
    </main>
  );
};

export default App;