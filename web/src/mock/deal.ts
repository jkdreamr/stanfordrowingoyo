import type { DealCard, DealStep } from '../../../shared/games/deal';

const hands = [
  {
    values: [8, 3, 12, 4],
    goal: 32,
    steps: [
      [0, '*', 1],
      [2, '-', 3],
      [4, '+', 5],
    ],
  },
  {
    values: [11, 4, 7, 2, 9],
    goal: 34,
    steps: [
      [0, '-', 2],
      [5, '*', 1],
      [4, '*', 3],
      [6, '+', 7],
    ],
  },
  {
    values: [6, 13, 4, 9, 2, 7],
    goal: 174,
    steps: [
      [1, '-', 3],
      [0, '*', 5],
      [2, '+', 4],
      [7, '*', 6],
      [9, '+', 8],
    ],
  },
  {
    values: [5, 12, 3, 8, 11, 2, 6],
    goal: 1154,
    steps: [
      [1, '/', 2],
      [4, '-', 0],
      [3, '*', 6],
      [7, '*', 9],
      [10, '*', 8],
      [11, '+', 5],
    ],
  },
  {
    values: [13, 4, 9, 6, 2, 11, 8, 3],
    goal: 2015,
    steps: [
      [0, '*', 2],
      [5, '+', 3],
      [6, '*', 1],
      [8, '*', 9],
      [7, '*', 4],
      [11, '+', 10],
      [13, '-', 12],
    ],
  },
] satisfies { values: number[]; goal: number; steps: [number, DealStep['op'], number][] }[];

export function mockDeal(round: number) {
  const hand = hands[round];
  const cards: DealCard[] = hand.values.map((value, i) => ({
    value,
    suit: (['H', 'S', 'D', 'C'] as const)[i % 4],
  }));
  const solution: DealStep[] = hand.steps.map(([a, op, b]) => ({ a, op, b }));
  return { cards, goal: hand.goal, solution, parMs: [30000, 45000, 65000, 90000, 120000][round] };
}
