import { expect, it } from 'vitest';
import { gameFacts } from './recap';

it('gives arcade-only recaps a generic played fact without a hardcoded game list', () => {
  const games = { played: 1, days: 1, best_dive: null, word_guess_solves: 0, streak: 1 };
  expect(gameFacts(games)).toEqual(['1 Game Played']);
  expect(gameFacts({ ...games, played: 2 })).toEqual(['2 Games Played']);
  expect(gameFacts({ ...games, played: 0 })).toEqual([]);
  expect(gameFacts({ ...games, word_guess_solves: 1 })).toEqual(['1 Word Guess Solve']);
});
