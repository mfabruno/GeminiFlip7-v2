export enum CardFaceType {
  Number,
  SecondChance,
  Double,
  FlipThree,
  Stop,
  Bonus,
}

export interface Card {
  type: CardFaceType;
  value?: number; // For Number and Bonus cards
  id: string;
}

export interface Player {
  id: number;
  name: string;
  totalScore: number;
  hand: Card[];
  hasSecondChance: boolean;
  hasDoubleModifier: boolean;
  isStaying: boolean;
  isBusted: boolean;
}

export enum GameState {
  Setup,
  PlayerTurn,
  RoundOver,
  GameOver,
}