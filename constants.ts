import { CardFaceType } from './types';

export const GAME_WIN_SCORE = 200;
export const FLIP_7_BONUS = 15;
export const FLIP_7_CARD_COUNT = 7;

export const DECK_COMPOSITION = {
  NUMBER_CARDS: [
    { value: 1, count: 1 },
    { value: 2, count: 2 },
    { value: 3, count: 3 },
    { value: 4, count: 4 },
    { value: 5, count: 5 },
    { value: 6, count: 6 },
    { value: 7, count: 7 },
    { value: 8, count: 8 },
    { value: 9, count: 9 },
    { value: 10, count: 10 },
    { value: 11, count: 11 },
    { value: 12, count: 12 },
  ],
  ACTION_CARDS: [
    { type: CardFaceType.SecondChance, count: 3 },
    { type: CardFaceType.FlipThree, count: 3 },
    { type: CardFaceType.Stop, count: 3 },
  ],
  MODIFIER_CARDS: [
    { type: CardFaceType.Double, count: 1 },
  ]
};

export const NUMBER_CARD_COLORS = [
  'text-slate-500', // for value 0, unused but keeps indexing clean
  'text-red-600',    // 1
  'text-orange-500', // 2
  'text-amber-500',  // 3
  'text-yellow-500', // 4
  'text-lime-500',   // 5
  'text-green-500',  // 6
  'text-emerald-500',// 7
  'text-teal-500',   // 8
  'text-cyan-500',   // 9
  'text-sky-500',    // 10
  'text-blue-600',   // 11
  'text-indigo-600', // 12
];