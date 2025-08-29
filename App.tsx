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

  const nextTurn = useCallback((updatedPlayers: Player[]) => {
    setActionMessage('');
    
    const activePlayers = updatedPlayers.filter(p => !p.isBusted && !p.isStaying);
    if (activePlayers.length === 0) {
        handleEndRound();
        return;
    }
    
    let nextPlayerIndex = currentPlayerIndex;
    let checkedCount = 0;
    do {
      nextPlayerIndex = (nextPlayerIndex + 1) % updatedPlayers.length;
      checkedCount++;
    } while (
        (updatedPlayers[nextPlayerIndex]?.isBusted || updatedPlayers[nextPlayerIndex]?.isStaying) &&
        checkedCount < updatedPlayers.length * 2
    );
    
    setCurrentPlayerIndex(nextPlayerIndex);
    setGameState(GameState.PlayerTurn);
    logAction(`It's ${updatedPlayers[nextPlayerIndex].name}'s turn.`);

  }, [currentPlayerIndex, handleEndRound, logAction]);

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

  const processCardForPlayer = useCallback((player: Player, drawnCard: CardType, isAutomated: boolean = false): {
    updatedPlayer: Player;
    cardsToDiscard: CardType[];
    message: string;
    needsActionResolution?: CardType;
    shouldEndRound?: boolean;
  } => {
      let newPlayer = JSON.parse(JSON.stringify(player)); // Deep copy to prevent mutation
      let cardsToDiscard: CardType[] = [];
      let message = '';
      let needsActionResolution: CardType | undefined = undefined;
      let shouldEndRound = false;

      switch (drawnCard.type) {
          case CardFaceType.Number: {
              message = `${newPlayer.name} drew a ${drawnCard.value}.`;
              const numberCardsInHand = newPlayer.hand.filter((c: CardType) => c.type === CardFaceType.Number);
              const isDuplicate = numberCardsInHand.some((c: CardType) => c.value === drawnCard.value);

              if (isDuplicate) {
                  if (newPlayer.hasSecondChance) {
                      newPlayer.hasSecondChance = false;
                      const scIndex = newPlayer.hand.findIndex((c: CardType) => c.type === CardFaceType.SecondChance);
                      if (scIndex > -1) cardsToDiscard.push(newPlayer.hand.splice(scIndex, 1)[0]);
                      cardsToDiscard.push(drawnCard);
                      message = `${newPlayer.name} used Second Chance on a duplicate ${drawnCard.value}!`;
                  } else {
                      newPlayer.hand.push(drawnCard);
                      newPlayer.isBusted = true;
                      message = `${newPlayer.name} BUSTED with a duplicate ${drawnCard.value}!`;
                  }
              } else {
                  newPlayer.hand.push(drawnCard);
                  const currentNumberCards = newPlayer.hand.filter((c: CardType) => c.type === CardFaceType.Number);
                  if (currentNumberCards.length >= FLIP_7_CARD_COUNT) {
                      shouldEndRound = true;
                      message = `${newPlayer.name} got a Flip 7! Round ends.`;
                  }
              }
              break;
          }
          case CardFaceType.SecondChance: {
              if (newPlayer.hasSecondChance) {
                  if (isAutomated) {
                      cardsToDiscard.push(drawnCard);
                      message = `${newPlayer.name} drew a second Second Chance during an automated draw, which was discarded.`;
                  } else {
                      needsActionResolution = drawnCard;
                      message = `${newPlayer.name} drew a second Second Chance and must give it away!`;
                  }
              } else {
                  newPlayer.hand.push(drawnCard);
                  newPlayer.hasSecondChance = true;
                  message = `${newPlayer.name} got a Second Chance!`;
              }
              break;
          }
          case CardFaceType.FlipThree:
          case CardFaceType.Stop: {
              const cardName = drawnCard.type === CardFaceType.FlipThree ? "Flip Three" : "Stop";
              if (isAutomated) {
                  cardsToDiscard.push(drawnCard);
                  message = `${newPlayer.name} drew a ${cardName} during an automated draw, which was discarded.`
              } else {
                  message = `${newPlayer.name} drew a ${cardName}.`;
                  needsActionResolution = drawnCard;
              }
              break;
          }
          case CardFaceType.Double:
              newPlayer.hand.push(drawnCard);
              newPlayer.hasDoubleModifier = true;
              message = `${newPlayer.name} got a Double Score card!`;
              break;
          case CardFaceType.Bonus:
              newPlayer.hand.push(drawnCard);
              message = `${newPlayer.name} drew a +${drawnCard.value} Bonus card!`;
              break;
      }

      return { updatedPlayer: newPlayer, cardsToDiscard, message, needsActionResolution, shouldEndRound };
  }, []);

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

    let player = { ...players[currentPlayerIndex] };
    
    const { updatedPlayer, cardsToDiscard, message, needsActionResolution, shouldEndRound } = processCardForPlayer(player, drawnCard, false);

    logAction(message);
    setActionMessage(message);

    const updatedPlayers = players.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);
    setPlayers(updatedPlayers);
    setDiscardPile(prev => [...prev, ...cardsToDiscard]);
    
    if (needsActionResolution) {
      setActionToResolve({ card: needsActionResolution, fromPlayerId: updatedPlayer.id });
      setGameState(GameState.ActionResolution);
    } else if (shouldEndRound) {
      await new Promise(r => setTimeout(r, 1500));
      handleEndRound();
    } else {
      await new Promise(r => setTimeout(r, 5000));
      nextTurn(updatedPlayers);
    }

    setIsProcessingAction(false);
  };
  
  const handleStay = async () => {
    if (isProcessingAction) return;
    setIsProcessingAction(true);
    
    const currentPlayerName = players[currentPlayerIndex].name;
    setActionMessage(`${currentPlayerName} stays.`);
    logAction(`${currentPlayerName} chose to stay.`);
  
    const updatedPlayers = players.map(p => 
      p.id === currentPlayerIndex ? { ...p, isStaying: true } : p
    );
    setPlayers(updatedPlayers);
    
    await new Promise(r => setTimeout(r, 5000));
    nextTurn(updatedPlayers);
    setIsProcessingAction(false);
  };
  
  const handleAssignAction = async (targetPlayerId: number) => {
    if (!actionToResolve) return;
    const { card, fromPlayerId } = actionToResolve;
    
    const assignerName = players.find(p => p.id === fromPlayerId)?.name || 'A player';
    const targetName = players.find(p => p.id === targetPlayerId)?.name || 'another player';
    const cardName = card.type === CardFaceType.FlipThree ? "Flip Three" : card.type === CardFaceType.Stop ? "Stop" : "Second Chance";
    
    logAction(`${assignerName} assigned a ${cardName} to ${targetName}.`);
    
    setActionToResolve(null);
    
    if (card.type === CardFaceType.Stop) {
        const updatedPlayers = players.map(p => p.id === targetPlayerId ? {...p, isStaying: true} : p);
        setPlayers(updatedPlayers);
        setDiscardPile(prev => [...prev, card]);
        logAction(`${targetName} is now staying and out of the round.`);
        await new Promise(r => setTimeout(r, 5000));
        nextTurn(updatedPlayers);

    } else if (card.type === CardFaceType.FlipThree) {
        logAction(`${targetName} must now draw 3 cards automatically.`);
        setIsProcessingAction(true);
        
        let tempDeck = [...deck];
        let tempDiscard = [...discardPile, card];
        let tempPlayers = JSON.parse(JSON.stringify(players));
        
        for (let i = 0; i < 3; i++) {
            const playerToUpdate = tempPlayers.find((p: Player) => p.id === targetPlayerId);
            if (!playerToUpdate || playerToUpdate.isBusted) break;

            await new Promise(r => setTimeout(r, 800));

            const { drawnCard, newDeck, newDiscard } = await drawCard(tempDeck, tempDiscard);
            tempDeck = newDeck;
            tempDiscard = newDiscard;

            if (!drawnCard) {
                logAction("Ran out of cards during Flip Three.");
                break;
            }

            const { updatedPlayer, cardsToDiscard, message } = processCardForPlayer(playerToUpdate, drawnCard, true);

            logAction(message);
            setActionMessage(message);

            if (cardsToDiscard.length > 0) {
                tempDiscard.push(...cardsToDiscard);
            }

            tempPlayers = tempPlayers.map((p: Player) => p.id === targetPlayerId ? updatedPlayer : p);
            
            setDeck(tempDeck);
            setDiscardPile(tempDiscard);
            setPlayers(tempPlayers);

            if (updatedPlayer.isBusted) {
                await new Promise(r => setTimeout(r, 2500));
                break;
            }

            if (message.includes("used Second Chance")) {
                break;
            }
        }
        
        setIsProcessingAction(false);
        await new Promise(r => setTimeout(r, 5000));
        nextTurn(tempPlayers);

    } else if (card.type === CardFaceType.SecondChance) {
        const updatedPlayers = players.map(p => {
          if (p.id === targetPlayerId) {
            return {...p, hasSecondChance: true, hand: [...p.hand, card]};
          }
          return p;
        });
        setPlayers(updatedPlayers);
        logAction(`${targetName} receives a Second Chance.`);
        await new Promise(r => setTimeout(r, 5000));
        nextTurn(updatedPlayers);
    }
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
  
  const ActionResolver: React.FC = () => {
    if (!actionToResolve) return null;
    
    const assigner = players.find(p => p.id === actionToResolve.fromPlayerId);
    
    const targetablePlayers = players.filter(player => {
        if (actionToResolve.card.type === CardFaceType.SecondChance) {
            // Can't give a Second Chance to someone who already has one, or to yourself (since you drew it).
            return player.id !== actionToResolve.fromPlayerId && !player.hasSecondChance;
        }
        // For Stop and FlipThree, you can target anyone including yourself.
        return true;
    });

    useEffect(() => {
        if (targetablePlayers.length === 0 && actionToResolve) {
            logAction(`No valid targets for ${actionToResolve.card.type === CardFaceType.SecondChance ? "Second Chance" : "action"}. Card is discarded.`);
            setDiscardPile(prev => [...prev, actionToResolve.card]);
            setActionToResolve(null);
            nextTurn(players);
        }
    }, [targetablePlayers, actionToResolve]);


    if (targetablePlayers.length === 0) {
        return (
            <div className="absolute inset-0 bg-black bg-opacity-80 flex flex-col justify-center items-center z-20 animate-fade-in text-center p-4">
                <h2 className="text-3xl font-bold mb-4">No Valid Targets!</h2>
                <p>There are no players who can receive this card. It will be discarded.</p>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 bg-black bg-opacity-80 flex flex-col justify-center items-center z-20 animate-fade-in text-center p-4">
            <h2 className="text-3xl font-bold mb-4">{assigner?.name}, assign this card:</h2>
            <Card card={actionToResolve.card} />
            <p className="text-lg my-4">Choose a player:</p>
            <div className="flex flex-wrap gap-4 justify-center">
              {targetablePlayers.map(player => (
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
       {gameState === GameState.ActionResolution && <ActionResolver />}
      
      <div className="w-full lg:w-1/4 p-2 bg-black bg-opacity-40 rounded-lg lg:self-stretch">
        <h2 className="text-2xl font-bold mb-2 border-b-2 border-green-400 pb-2">Players</h2>
        <div className="space-y-3">
          {players.map(player => (
            <div key={player.id} className={`p-3 rounded-lg transition-all duration-300 ${player.id === currentPlayer?.id && gameState === GameState.PlayerTurn ? 'bg-yellow-500 text-slate-900 scale-105 shadow-lg' : 'bg-slate-800'}`}>
              <h3 className="text-lg font-bold">{player.name} {player.id === currentPlayer?.id ? '(Current)' : ''}</h3>
              <p>Score: {player.totalScore}</p>
              <div className="flex gap-1 mt-1">
                {player.hasSecondChance && <span title="Second Chance" className="text-xs px-2 py-1 bg-amber-400 text-slate-900 rounded-full font-semibold">🔄</span>}
                {player.hasDoubleModifier && <span title="Double Score" className="text-xs px-2 py-1 bg-purple-500 text-white rounded-full font-semibold">x2</span>}
                {player.isStaying && <span title="Staying" className="text-xs px-2 py-1 bg-gray-500 text-white rounded-full font-semibold">Staying</span>}
                {player.isBusted && <span title="Busted" className="text-xs px-2 py-1 bg-red-600 text-white rounded-full font-semibold">Busted!</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t-2 border-green-400">
            <h3 className="text-xl font-bold mb-2">Game Log</h3>
            <div className="text-sm space-y-1 h-48 overflow-y-auto pr-2">
                {gameLog.map((log, i) => <p key={i} className="opacity-80">{log}</p>)}
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="flex items-end justify-center mb-6 space-x-4">
           <div className="flex flex-col items-center">
             <p className="mb-2 font-semibold">Deck ({deck.length})</p>
             <Card isFaceDown />
           </div>
           <div className="flex flex-col items-center">
             <p className="mb-2 font-semibold">Discard ({discardPile.length})</p>
             <Card card={discardPile[discardPile.length - 1]} />
           </div>
        </div>
        
        {currentPlayer && (
          <div className="bg-black bg-opacity-40 p-6 rounded-xl w-full max-w-4xl text-center">
            <h2 className="text-3xl font-bold mb-2">
                {currentPlayer.name}'s Turn
            </h2>
            <p className="text-xl mb-4">Current Round Score: <span className="font-bold text-yellow-300">{currentRoundScore}</span></p>

            <div className="flex justify-center items-center flex-wrap gap-2 min-h-[10.5rem]">
              {currentPlayer.hand.length === 0 ? <p className="text-slate-400">Hand is empty</p> :
                currentPlayer.hand.map((card, index) => (
                  <Card key={card.id} card={card} className="animate-fade-in"/>
                ))
              }
            </div>

            <div className="mt-6 flex flex-col items-center">
              <div className="flex gap-4">
                  <button onClick={handleHit} disabled={isProcessingAction} className="px-8 py-3 text-lg font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105 bg-blue-500 hover:bg-blue-600 text-white disabled:bg-slate-500 disabled:cursor-not-allowed">
                    Hit
                  </button>
                  <button onClick={handleStay} disabled={isProcessingAction} className="px-8 py-3 text-lg font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105 bg-gray-500 hover:bg-gray-600 text-white disabled:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                    Stay
                  </button>
              </div>
               <p className={`mt-4 text-lg min-h-[1.75rem] font-semibold ${actionMessage.includes('BUSTED') ? 'text-red-500 animate-pulse' : 'text-green-300'}`}>{actionMessage}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default App;