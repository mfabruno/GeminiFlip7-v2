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
  
  // State for resolving action cards
  const [actionToResolve, setActionToResolve] = useState<{ card: CardType; fromPlayerId: number; } | null>(null);

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
    setActionToResolve(null);
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
      actionQueue: [],
    }));
    setPlayers(initialPlayers);
    setDeck(shuffleDeck(createDeck()));
    setDiscardPile([]);
    setCurrentPlayerIndex(0);
    setGameState(GameState.PlayerTurn); // Go directly to the first player's turn
    setGameLog([`Game started with ${numPlayers} players.`]);
    logAction(`It's ${initialPlayers[0].name}'s turn to start the round.`);
  };

  const calculateRoundScore = (player: Player) => {
      if (player.isBusted) return 0;

      const numberCards = player.hand.filter(c => c.type === CardFaceType.Number);
      const bonusCards = player.hand.filter(c => c.type === CardFaceType.Bonus);

      const numberScore = numberCards.reduce((sum, card) => sum + (card.value || 0), 0);
      const bonusScore = bonusCards.reduce((sum, card) => sum + (card.value || 0), 0);

      const doubledNumberScore = player.hasDoubleModifier ? numberScore * 2 : numberScore;
      
      let finalScore = doubledNumberScore + bonusScore;

      if (numberCards.length >= FLIP_7_CARD_COUNT) {
         finalScore += FLIP_7_BONUS;
      }
      return finalScore;
  }

  const handleEndRound = useCallback(() => {
    setGameState(GameState.RoundOver); // Transition to show scores
    let roundSummary = 'Round over! ';
    let cardsToDiscard: CardType[] = [];

    const updatedPlayers = players.map(player => {
      cardsToDiscard.push(...player.hand);
      
      const bankedScore = calculateRoundScore(player);
      
      if (player.isBusted) {
        roundSummary += `${player.name} busted (0 points). `;
      } else {
        roundSummary += `${player.name} banked ${bankedScore} points. `;
      }
      
      return { ...player, totalScore: player.totalScore + bankedScore };
    });
    
    logAction(roundSummary);
    setDiscardPile(prev => [...prev, ...cardsToDiscard]);

    const maxScore = Math.max(...updatedPlayers.map(p => p.totalScore));
    
    if (maxScore >= GAME_WIN_SCORE) {
        const potentialWinners = updatedPlayers.filter(p => p.totalScore === maxScore);
        if (potentialWinners.length === 1) {
            setWinner(potentialWinners[0]);
            setGameState(GameState.GameOver);
            logAction(`${potentialWinners[0].name} wins with ${maxScore} points!`);
        } else {
            logAction(`Tie at ${maxScore}! Playing another round to break the tie.`);
            setRoundMessage(roundSummary + ` Tie at ${maxScore}! One more round!`);
            setPlayers(updatedPlayers);
        }
    } else {
       setRoundMessage(roundSummary);
       setPlayers(updatedPlayers);
    }
  }, [players, logAction]);

  const startNewRound = useCallback(() => {
    const updatedPlayers = players.map(p => ({
      ...p,
      hand: [],
      hasSecondChance: false,
      hasDoubleModifier: false,
      isStaying: false,
      isBusted: false,
      actionQueue: [],
    }));
    setPlayers(updatedPlayers);
    setRoundMessage('');
    setActionMessage('');
    setWinner(null);
    const nextDealerIndex = 0; 
    setCurrentPlayerIndex(nextDealerIndex);
    setGameState(GameState.PlayerTurn); // Start next round directly with a player's turn
    logAction(`Starting a new round. It's ${updatedPlayers[0].name}'s turn.`);
  }, [players, logAction]);

  const nextTurn = useCallback(() => {
    setActionMessage('');
    let nextPlayerIndex = currentPlayerIndex;
    let checkedCount = 0;
    
    const activePlayers = players.filter(p => !p.isBusted && !p.isStaying);
    if (activePlayers.length === 0) {
        handleEndRound();
        return;
    }
    
    do {
      nextPlayerIndex = (nextPlayerIndex + 1) % players.length;
      checkedCount++;
    } while (
        (players[nextPlayerIndex]?.isBusted || players[nextPlayerIndex]?.isStaying) &&
        checkedCount < players.length * 2
    );
    
    setCurrentPlayerIndex(nextPlayerIndex);
    setGameState(GameState.PlayerTurn);
    logAction(`It's ${players[nextPlayerIndex].name}'s turn.`);

  }, [currentPlayerIndex, players, handleEndRound, logAction]);

  const drawCard = useCallback(async (currentDeck: CardType[], currentDiscard: CardType[]) => {
      let deck = [...currentDeck];
      let discard = [...currentDiscard];
      if (deck.length === 0) {
        if (discard.length === 0) {
          logAction("No cards left to draw!");
          return { drawnCard: null, newDeck: deck, newDiscard: discard };
        }
        logAction("Deck is empty. Shuffling discard pile...");
        await new Promise(r => setTimeout(r, 500));
        deck = shuffleDeck(discard);
        discard = [];
      }
      const drawnCard = deck.pop()!;
      return { drawnCard, newDeck: deck, newDiscard: discard };
  }, [logAction]);

  const processHit = (card: CardType, p: Player, isFlipThreeContext = false) => {
    let message = '';
    let shouldEndTurn = false;
    let shouldEndRound = false;
    let isBust = false;
    let cardsToDiscard: CardType[] = [];
    let pendingAction: CardType | null = null;
    let needsActionResolution = false;
    
    const player = JSON.parse(JSON.stringify(p));

    switch (card.type) {
        case CardFaceType.Number: {
            message = `${player.name} drew a ${card.value}.`;
            const numberCardsInHand = player.hand.filter((c: CardType) => c.type === CardFaceType.Number);
            const isDuplicate = numberCardsInHand.some((c: CardType) => c.value === card.value);
            
            if (isDuplicate) {
                if (player.hasSecondChance) {
                    player.hasSecondChance = false;
                    const scIndex = player.hand.findIndex((c: CardType) => c.type === CardFaceType.SecondChance);
                    if (scIndex > -1) {
                        cardsToDiscard.push(player.hand.splice(scIndex, 1)[0]);
                    }
                    cardsToDiscard.push(card);
                    shouldEndTurn = true; // Case 5
                    message = `${player.name} used a Second Chance on a duplicate ${card.value}! Their turn is over.`;
                } else {
                    player.hand.push(card); // Add card to show what they busted on
                    player.isBusted = true;
                    shouldEndTurn = true;
                    isBust = true;
                    message = `${player.name} BUSTED with a duplicate ${card.value}!`;
                }
            } else {
                 player.hand.push(card);
                 const currentNumberCards = player.hand.filter((c: CardType) => c.type === CardFaceType.Number);
                 if (currentNumberCards.length >= FLIP_7_CARD_COUNT) {
                    shouldEndRound = true;
                    message = `${player.name} got a Flip 7!`;
                }
            }
            break;
        }
        case CardFaceType.SecondChance:
            player.hand.push(card);
            if (player.hasSecondChance) {
                 // TODO: Immediately assign to another active player or discard
                 message = `${player.name} drew a second Second Chance card!`
            } else {
                player.hasSecondChance = true;
                message = `${player.name} got a Second Chance!`;
            }
            break;
        case CardFaceType.FlipThree:
        case CardFaceType.Stop:
            if (isFlipThreeContext) {
                pendingAction = card;
                message = `${player.name} drew a ${card.type === CardFaceType.FlipThree ? "Flip Three" : "Stop"} card; it's set aside.`;
            } else {
               needsActionResolution = true;
            }
            break;
        case CardFaceType.Double:
            player.hand.push(card);
            player.hasDoubleModifier = true;
            message = `${player.name} got a Double Score card!`;
            break;
        case CardFaceType.Bonus:
            player.hand.push(card);
            message = `${player.name} drew a +${card.value} Bonus card!`;
            break;
    }
    return { player, message, shouldEndTurn, shouldEndRound, isBust, cardsToDiscard, pendingAction, needsActionResolution };
  };

  const handleHit = async () => {
    if (isProcessingAction) return;
    setIsProcessingAction(true);
    setActionMessage('');

    const { drawnCard, newDeck, newDiscard } = await drawCard(deck, discardPile);
    setDeck(newDeck);
    setDiscardPile(newDiscard);

    if (!drawnCard) {
        setIsProcessingAction(false);
        return;
    }
    
    const currentPlayer = players[currentPlayerIndex];
    const initialProcess = processHit(drawnCard, currentPlayer);

    if(initialProcess.needsActionResolution) {
        const cardName = drawnCard.type === CardFaceType.FlipThree ? "Flip Three" : "Stop";
        const message = `${currentPlayer.name} drew a ${cardName}.`;
        logAction(message);
        setActionMessage(message);
        setActionToResolve({ card: drawnCard, fromPlayerId: currentPlayer.id });
        setGameState(GameState.ActionResolution);
        setIsProcessingAction(false);
        return;
    }
    
    logAction(initialProcess.message);
    setActionMessage(initialProcess.message);
    
    setPlayers(prev => prev.map(p => p.id === initialProcess.player.id ? initialProcess.player : p));
    setDiscardPile(prev => [...prev, ...initialProcess.cardsToDiscard]);

    if (initialProcess.shouldEndRound) {
        handleEndRound();
    } else if (initialProcess.shouldEndTurn) {
        if(initialProcess.isBust) { await new Promise(r => setTimeout(r, 1500)); }
        nextTurn();
    }

    setIsProcessingAction(false);
  };
  
  const handleStay = () => {
    if (isProcessingAction) return;
    setActionMessage('');
    logAction(`${players[currentPlayerIndex].name} chose to stay.`);

    const newPlayers = [...players];
    newPlayers[currentPlayerIndex].isStaying = true;
    setPlayers(newPlayers);
    
    nextTurn();
  };

  const executeFlipThree = async (targetPlayerId: number) => {
    setIsProcessingAction(true);
    const targetPlayerName = players.find(p => p.id === targetPlayerId)?.name || 'A player';
    logAction(`--- ${targetPlayerName} starts a Flip Three! ---`);

    let currentDeck = [...deck];
    let currentDiscard = [...discardPile];
    let pendingActions: CardType[] = [];
    let stopSequence = false;

    for (let i = 0; i < 3; i++) {
        if (stopSequence) break;

        await new Promise(r => setTimeout(r, 1000));

        const drawResult = await drawCard(currentDeck, currentDiscard);
        currentDeck = drawResult.newDeck;
        currentDiscard = drawResult.newDiscard;

        if (!drawResult.drawnCard) {
            logAction("Ran out of cards during Flip Three.");
            break;
        }

        let targetPlayer!: Player;
        setPlayers(prev => {
            targetPlayer = JSON.parse(JSON.stringify(prev.find(p => p.id === targetPlayerId)!));
            return prev;
        });

        const processResult = processHit(drawResult.drawnCard, targetPlayer, true);

        setPlayers(prev => prev.map(p => p.id === processResult.player.id ? processResult.player : p));
        setActionMessage(processResult.message);
        logAction(processResult.message);
        currentDiscard = [...currentDiscard, ...processResult.cardsToDiscard];

        if (processResult.pendingAction) {
            pendingActions.push(processResult.pendingAction);
        }

        if (processResult.shouldEndRound || processResult.isBust) {
            stopSequence = true;
            if (processResult.shouldEndRound) {
                setTimeout(handleEndRound, 500);
            }
             if (processResult.isBust) {
                await new Promise(r => setTimeout(r, 1500));
            }
        }
    }
    
    setDeck(currentDeck);
    setDiscardPile(currentDiscard);

    if (pendingActions.length > 0 && !stopSequence) {
        logAction(`${targetPlayerName} has pending actions to resolve.`);
        // Note: this part of the logic (chained actions) is complex and would need a queue system.
        // For now, we'll log them and they will be discarded at round end.
    }

    logAction(`--- ${targetPlayerName}'s Flip Three is complete. ---`);
    setIsProcessingAction(false);
  };
  
  const handleAssignAction = async (targetPlayerId: number) => {
    if (!actionToResolve) return;
    const { card, fromPlayerId } = actionToResolve;
    
    const assignerName = players.find(p => p.id === fromPlayerId)?.name || 'A player';
    const targetName = players.find(p => p.id === targetPlayerId)?.name || 'another player';

    logAction(`${assignerName} assigned a ${card.type === CardFaceType.FlipThree ? "Flip Three" : "Stop"} to ${targetName}.`);
    
    setDiscardPile(prev => [...prev, card]);
    setActionToResolve(null);
    
    if (card.type === CardFaceType.Stop) {
        setPlayers(prev => {
            return prev.map(p => p.id === targetPlayerId ? {...p, isStaying: true} : p);
        });
        logAction(`${targetName} is now frozen for the round.`);
    } else if (card.type === CardFaceType.FlipThree) {
        await executeFlipThree(targetPlayerId);
    }
    
    nextTurn();
  }

  const currentPlayer = useMemo(() => players[currentPlayerIndex], [players, currentPlayerIndex]);
  const activePlayers = useMemo(() => players.filter(p => !p.isBusted && !p.isStaying), [players]);
  const currentRoundScore = useMemo(() => currentPlayer ? calculateRoundScore(currentPlayer) : 0, [currentPlayer]);
  
  if (gameState === GameState.Setup) {
      return (
        <main className="min-h-screen w-full bg-cover bg-center flex flex-col justify-center items-center p-4 sm:p-6" style={{backgroundImage: 'radial-gradient(circle, #166534, #14532d, #103b22, #052e16)'}}>
          <div className="text-center p-8 bg-black bg-opacity-50 rounded-xl flex flex-col items-center animate-fade-in">
              <h1 className="text-6xl font-extrabold mb-4 text-yellow-300 tracking-wider" style={{fontFamily: 'serif'}}>Flip 7</h1>
              <div className="mb-6">
                  <label htmlFor="numPlayers" className="text-xl mr-4">Number of Players:</label>
                  <select id="numPlayers" value={numPlayers} onChange={e => setNumPlayers(parseInt(e.target.value, 10))} className="bg-slate-800 text-white p-2 rounded-lg text-lg">
                      <option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option>
                  </select>
              </div>
              <button onClick={startGame} className="px-8 py-4 text-xl font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105 bg-green-500 hover:bg-green-600 text-white">Start Game</button>
          </div>
        </main>
      );
  }

  const renderEndScreen = () => {
      const isGameOver = gameState === GameState.GameOver;
      const nextAction = isGameOver ? resetGame : startNewRound;
      return (
        <div className="absolute inset-0 bg-black bg-opacity-80 flex flex-col justify-center items-center z-20 animate-fade-in text-center p-4">
          <h2 className={`text-5xl sm:text-6xl font-extrabold ${isGameOver ? 'text-green-400' : 'text-yellow-400'}`}>{isGameOver ? `${winner?.name} Wins!` : 'Round Over'}</h2>
          <p className="text-lg sm:text-xl mt-4 max-w-2xl">{roundMessage}</p>
          <div className="mt-6 space-y-2">
            {players.map(p => (<p key={p.id} className="text-xl"><span className="font-bold">{p.name}'s Score:</span> {p.totalScore}</p>))}
          </div>
          <button onClick={nextAction} className="px-6 py-3 text-lg font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105 bg-yellow-500 hover:bg-yellow-600 text-black mt-8">
            {isGameOver ? 'Play Again' : 'Next Round'}
          </button>
        </div>
      );
  }
  
  const renderActionResolver = () => {
    if (!actionToResolve) return null;
    const assigner = players.find(p => p.id === actionToResolve.fromPlayerId);
    return (
        <div className="absolute inset-0 bg-black bg-opacity-80 flex flex-col justify-center items-center z-20 animate-fade-in text-center p-4">
            <h2 className="text-3xl font-bold mb-4">{assigner?.name}, assign this card:</h2>
            <Card card={actionToResolve.card} />
            <p className="text-lg my-4">Choose a player:</p>
            <div className="flex flex-wrap gap-4 justify-center">
              {players.map(player => (
                <button key={player.id} onClick={() => handleAssignAction(player.id)} className="px-6 py-3 text-lg font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105 bg-blue-500 hover:bg-blue-600 text-white">
                    {player.name}
                </button>
              ))}
            </div>
        </div>
    );
  }

  return (
    <main className="min-h-screen w-full bg-cover bg-center flex flex-col lg:flex-row items-start p-2 sm:p-4" style={{backgroundImage: 'radial-gradient(circle, #166534, #14532d, #103b22, #052e16)'}}>
       {(gameState === GameState.RoundOver || gameState === GameState.GameOver) && renderEndScreen()}
       {gameState === GameState.ActionResolution && renderActionResolver()}
      
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
        
        {currentPlayer && <div className="relative flex-grow w-full max-w-5xl flex flex-col justify-center items-center">
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
                <button onClick={handleHit} disabled={isProcessingAction || gameState !== GameState.PlayerTurn} className="px-6 py-3 text-lg font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 bg-blue-500 hover:bg-blue-600 text-white">Hit</button>
                <button onClick={handleStay} disabled={isProcessingAction || gameState !== GameState.PlayerTurn} className="px-6 py-3 text-lg font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 bg-red-500 hover:bg-red-600 text-white">Stay</button>
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