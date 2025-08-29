
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
  const [showNextTurnButton, setShowNextTurnButton] = useState(false);
  
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

  const handleEndRound = useCallback((finalPlayersState: Player[]) => {
    setGameState(GameState.RoundOver); // Transition to show scores
    let roundSummary = 'Round over! ';
    let cardsToDiscard: CardType[] = [];

    const scoredPlayers = finalPlayersState.map(player => {
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

    const maxScore = Math.max(...scoredPlayers.map(p => p.totalScore));
    
    if (maxScore >= GAME_WIN_SCORE) {
        const potentialWinners = scoredPlayers.filter(p => p.totalScore === maxScore);
        if (potentialWinners.length === 1) {
            setWinner(potentialWinners[0]);
            setGameState(GameState.GameOver);
            logAction(`${potentialWinners[0].name} wins with ${maxScore} points!`);
        } else {
            logAction(`Tie at ${maxScore}! Playing another round to break the tie.`);
            setRoundMessage(roundSummary + ` Tie at ${maxScore}! One more round!`);
            setPlayers(scoredPlayers);
        }
    } else {
       setRoundMessage(roundSummary);
       setPlayers(scoredPlayers);
    }
  }, [logAction]);

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
        handleEndRound(updatedPlayers);
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
  
  useEffect(() => {
    if (gameState === GameState.PlayerTurn) {
        setIsProcessingAction(false);
        setShowNextTurnButton(false);
    }
  }, [currentPlayerIndex, gameState]);
    
  const handleAssignAction = async (targetPlayerId: number, action?: { card: CardType; fromPlayerId: number; }) => {
    const actionToUse = action || actionToResolve;
    if (!actionToUse) return;

    setIsProcessingAction(true); // Lock actions while this resolves
    const { card, fromPlayerId } = actionToUse;
    
    const assignerName = players.find(p => p.id === fromPlayerId)?.name || 'A player';
    const targetName = players.find(p => p.id === targetPlayerId)?.name || 'another player';
    const cardName = card.type === CardFaceType.FlipThree ? "Flip Three" : card.type === CardFaceType.Stop ? "Stop" : "Second Chance";
    
    logAction(`${assignerName} assigned a ${cardName} to ${targetName}.`);
    
    setActionToResolve(null);
    let finalPlayers = [...players];
    
    if (card.type === CardFaceType.Stop) {
        finalPlayers = players.map(p => p.id === targetPlayerId ? {...p, isStaying: true} : p);
        setPlayers(finalPlayers);
        setDiscardPile(prev => [...prev, card]);
        logAction(`${targetName} is now staying and out of the round.`);
    } else if (card.type === CardFaceType.FlipThree) {
        logAction(`${targetName} must now draw 3 cards automatically.`);
        
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
                const bustMsg = `${updatedPlayer.name} BUSTED!`;
                setActionMessage(bustMsg);
                logAction(bustMsg);
                await new Promise(r => setTimeout(r, 2500));
                break;
            }

            if (message.includes("used Second Chance")) {
                break;
            }
        }
        finalPlayers = tempPlayers;
    } else if (card.type === CardFaceType.SecondChance) {
        finalPlayers = players.map(p => {
          if (p.id === targetPlayerId) {
            return {...p, hasSecondChance: true, hand: [...p.hand, card]};
          }
          if (p.id === fromPlayerId) {
            // Remove the second SC from the assigner's hand if it was there
            const hand = [...p.hand];
            const scIndex = hand.findIndex(c => c.id === card.id);
            if (scIndex > -1) hand.splice(scIndex, 1);
            return {...p, hand};
          }
          return p;
        });
        setPlayers(finalPlayers);
        logAction(`${targetName} receives a Second Chance.`);
    }

    await new Promise(r => setTimeout(r, 1500));
    nextTurn(finalPlayers);
  }

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

    let updatedPlayers = players.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);
    setPlayers(updatedPlayers);
    setDiscardPile(prev => [...prev, ...cardsToDiscard]);
    
    if (needsActionResolution) {
      const fromPlayerId = updatedPlayer.id;
      const card = needsActionResolution;

      if (card.type === CardFaceType.SecondChance) {
          const validTargets = updatedPlayers.filter(p => p.id !== fromPlayerId && !p.isBusted && !p.isStaying && !p.hasSecondChance);
          if (validTargets.length === 0) {
              const discardMsg = `${updatedPlayer.name} had no one to give the second Second Chance to. It was discarded.`;
              logAction(discardMsg);
              setActionMessage(discardMsg);
              setDiscardPile(prev => [...prev, card]);
              // Player's turn is not over, they can act again.
              setIsProcessingAction(false);
              return; // Early return from handleHit
          }
      } else if (card.type === CardFaceType.FlipThree || card.type === CardFaceType.Stop) {
          const validTargets = updatedPlayers.filter(p => !p.isBusted && !p.isStaying);
          const validOtherTargets = validTargets.filter(p => p.id !== fromPlayerId);

          if (validOtherTargets.length === 0 && validTargets.some(p => p.id === fromPlayerId)) {
              const cardName = card.type === CardFaceType.FlipThree ? "Flip Three" : "Stop";
              const selfAssignMsg = `${updatedPlayer.name} has no other players to target and must use the ${cardName} on themselves.`;
              logAction(selfAssignMsg);
              setActionMessage(selfAssignMsg);
              await new Promise(r => setTimeout(r, 1500));
              // Automatically assign to self and skip ActionResolution state.
              await handleAssignAction(fromPlayerId, { card, fromPlayerId });
              return;
          }
      }
      
      setActionToResolve({ card: needsActionResolution, fromPlayerId: updatedPlayer.id });
      setGameState(GameState.ActionResolution);
    } else if (shouldEndRound) {
      await new Promise(r => setTimeout(r, 1500));
      handleEndRound(updatedPlayers);
    } else if (updatedPlayer.isBusted) {
        const bustMsg = `${updatedPlayer.name} BUSTED!`;
        setActionMessage(bustMsg);
        logAction(bustMsg);
        await new Promise(r => setTimeout(r, 2500));
        nextTurn(updatedPlayers);
    } else {
      const activePlayersBesidesCurrent = updatedPlayers.filter(p => p.id !== updatedPlayer.id && !p.isBusted && !p.isStaying);
      if (activePlayersBesidesCurrent.length > 0) {
        setShowNextTurnButton(true);
      } else {
        // Last player standing, can keep hitting
        setIsProcessingAction(false);
      }
    }
  };
  
  const handleStay = async () => {
    if (isProcessingAction) return;
    setIsProcessingAction(true);
    
    const currentPlayerName = players[currentPlayerIndex].name;
    const stayMessage = `${currentPlayerName} stays.`;
    setActionMessage(stayMessage);
    logAction(stayMessage);
  
    const updatedPlayers = players.map(p => 
      p.id === currentPlayerIndex ? { ...p, isStaying: true } : p
    );
    setPlayers(updatedPlayers);
    setShowNextTurnButton(true);
  };

  const handleNextTurnButtonClick = () => {
    nextTurn(players);
  };

  const ActionResolver: React.FC = () => {
    if (!actionToResolve) return null;

    const { card, fromPlayerId } = actionToResolve;
    const fromPlayer = players.find(p => p.id === fromPlayerId);
    if (!fromPlayer) return null;

    let validTargets: Player[] = [];
    
    if (card.type === CardFaceType.SecondChance) {
        validTargets = players.filter(p => p.id !== fromPlayerId && !p.isBusted && !p.isStaying && !p.hasSecondChance);
    } else {
        validTargets = players.filter(p => !p.isBusted && !p.isStaying);
    }

    return (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-slate-800 p-6 rounded-xl shadow-2xl text-center max-w-md w-full">
                <h2 className="text-2xl font-bold mb-4">Assign Card</h2>
                <p className="mb-4">{fromPlayer.name}, you drew this card. Who do you give it to?</p>
                <div className="flex justify-center mb-6">
                    <Card card={card} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {validTargets.map(target => (
                        <button
                            key={target.id}
                            onClick={() => handleAssignAction(target.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105"
                        >
                            {target.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
  };
  
  const currentPlayer = useMemo(() => players[currentPlayerIndex], [players, currentPlayerIndex]);
  const currentRoundScore = useMemo(() => currentPlayer ? calculateRoundScore(currentPlayer) : 0, [currentPlayer]);
  
  const renderPlayerStatus = (player: Player) => {
    if (player.isBusted) return <span className="text-red-500 font-bold text-lg">BUSTED</span>;
    if (player.isStaying) return <span className="text-sky-400 font-bold text-lg">STAYING</span>;
    return <span className="text-green-400 font-bold text-lg">ACTIVE</span>;
  }

  if (gameState === GameState.Setup) {
      return (
        <main className="min-h-screen w-full bg-cover bg-center flex flex-col justify-center items-center p-4 sm:p-6" style={{ backgroundImage: 'radial-gradient(circle, #1e293b, #0f172a)' }}>
            <div className="bg-slate-800 bg-opacity-70 p-8 rounded-xl shadow-2xl text-center backdrop-blur-sm">
            <h1 className="text-6xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-600">Flip 7</h1>
            <p className="text-slate-300 mb-8">How many players?</p>
            <div className="flex items-center justify-center gap-4 mb-8">
                <span className="text-2xl font-bold">2</span>
                <input
                type="range"
                min="2"
                max="8"
                value={numPlayers}
                onChange={(e) => setNumPlayers(parseInt(e.target.value))}
                className="w-48 cursor-pointer"
                aria-label="Number of players"
                />
                <span className="text-2xl font-bold">8</span>
            </div>
            <p className="text-4xl font-bold mb-8">{numPlayers}</p>
            <button
                onClick={startGame}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl transition-transform transform hover:scale-105"
            >
                Start Game
            </button>
            </div>
        </main>
      );
  }

  return (
    <main className="h-screen w-full flex flex-col p-2 sm:p-4 bg-slate-900">
      <header className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
        {players.map((player) => (
          <div key={player.id} className={`p-3 rounded-lg border-2 ${currentPlayerIndex === player.id ? 'border-yellow-400 bg-slate-700' : 'border-slate-600 bg-slate-800'}`}>
            <h2 className="text-lg font-bold truncate">{player.name}</h2>
            <p className="text-sm text-slate-300">Score: <span className="font-semibold text-white">{player.totalScore}</span></p>
            {renderPlayerStatus(player)}
          </div>
        ))}
      </header>
      
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        <aside className="lg:col-span-1 bg-slate-800 rounded-lg p-4 flex flex-col overflow-hidden">
          {/* Player Info - Non-growing */}
          <div className="flex-shrink-0">
            {currentPlayer && (
              <div>
                <h3 className="text-xl font-bold mb-2">Current: {currentPlayer.name}</h3>
                <p>Round Score: <span className="font-bold text-2xl text-yellow-400">{currentRoundScore}</span></p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {currentPlayer.hasSecondChance && <span className="bg-amber-500 text-slate-900 text-xs font-bold px-2 py-1 rounded-full">🔄 2nd Chance</span>}
                  {currentPlayer.hasDoubleModifier && <span className="bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded-full">x2 Double</span>}
                </div>
              </div>
            )}
          </div>
          
          {/* Game Log - Growing and scrolling */}
          <div className="flex flex-col flex-1 min-h-0 mt-4">
            <h3 className="text-lg font-bold mb-2 flex-shrink-0">Game Log</h3>
            <div className="flex-1 overflow-y-auto pr-2">
                <ul className="text-xs text-slate-400 space-y-1">
                  {gameLog.map((log, i) => <li key={i}>{log}</li>)}
                </ul>
            </div>
          </div>
        </aside>

        <section className="lg:col-span-3 bg-slate-800/50 rounded-lg p-4 flex flex-col justify-between">
          <div className="flex justify-center items-center gap-4 sm:gap-8 mb-4">
            <div className="flex flex-col items-center">
              <Card isFaceDown />
              <span className="mt-2 text-sm text-slate-300">Deck: {deck.length}</span>
            </div>
            <div className="flex flex-col items-center">
              <Card card={discardPile[discardPile.length - 1]} />
              <span className="mt-2 text-sm text-slate-300">Discard: {discardPile.length}</span>
            </div>
          </div>
          
          <div className="h-12 text-center my-4">
            <p className={`text-xl font-bold transition-opacity duration-300 ${actionMessage ? 'opacity-100' : 'opacity-0'} ${actionMessage.includes('BUSTED') ? 'text-red-500 animate-pulse' : 'text-yellow-300'}`}>
              {actionMessage}
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-center items-center mb-4 min-h-[200px] sm:min-h-[220px]">
             <h3 className="text-lg font-semibold mb-2">{currentPlayer?.name}'s Hand</h3>
              <div className="w-full flex justify-center items-center p-2">
                <div className="w-full">
                  {currentPlayer?.hand.length > 0 ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      {currentPlayer?.hand.map((card) => (
                        <div key={card.id} className="transition-transform transform hover:scale-105">
                           <Card card={card} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-center">Hand is empty.</p>
                  )}
                </div>
              </div>
          </div>

          <footer className="flex justify-center items-center gap-4 h-16">
            {gameState === GameState.PlayerTurn && !showNextTurnButton && (
              <>
                <button
                  onClick={handleHit}
                  disabled={isProcessingAction || currentPlayer?.isBusted || currentPlayer?.isStaying}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg text-lg transition-transform transform hover:scale-105"
                >
                  Hit
                </button>
                <button
                  onClick={handleStay}
                  disabled={isProcessingAction || currentPlayer?.isBusted || currentPlayer?.isStaying}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg text-lg transition-transform transform hover:scale-105"
                >
                  Stay
                </button>
              </>
            )}
            {showNextTurnButton && (
                <button 
                  onClick={handleNextTurnButtonClick}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-8 rounded-lg text-lg animate-pulse"
                >
                  Next Turn
                </button>
            )}
          </footer>
        </section>
      </div>
      
      {gameState === GameState.ActionResolution && <ActionResolver />}
      
      {(gameState === GameState.RoundOver || gameState === GameState.GameOver) && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
          <div className="bg-slate-800 p-8 rounded-xl shadow-2xl text-center max-w-lg w-full">
            {gameState === GameState.GameOver && winner && (
              <>
                <h2 className="text-4xl font-bold mb-4 text-yellow-400">Game Over!</h2>
                <p className="text-2xl mb-6">{winner.name} is the winner with {winner.totalScore} points!</p>
                <div className="flex justify-center gap-4">
                  <button onClick={resetGame} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg">New Game</button>
                </div>
              </>
            )}
            {gameState === GameState.RoundOver && !winner && (
              <>
                <h2 className="text-4xl font-bold mb-4 text-sky-400">Round Over</h2>
                <p className="text-lg mb-6 whitespace-pre-wrap">{roundMessage}</p>
                 <button onClick={startNewRound} className="bg-green-600 hover:g-green-700 text-white font-bold py-2 px-6 rounded-lg">Start Next Round</button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
};

export default App;
