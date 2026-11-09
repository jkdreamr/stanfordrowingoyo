import { expect, it } from 'vitest';
import { GUESSES } from '../../../shared/games/wordGuessGuesses';
import { ANSWER_LIST, unpack } from './wordGuess';
import { NEW_ANSWERS } from './wordGuessExpansion';

const words = unpack(NEW_ANSWERS);

it('packs at least 350 unique lowercase five-letter answers', () => {
  expect(NEW_ANSWERS.length % 5).toBe(0);
  expect(NEW_ANSWERS).toMatch(/^[a-z]+$/);
  expect(words.length).toBeGreaterThanOrEqual(350);
  expect(new Set(words).size).toBe(words.length);
});

it('adds only words that are not legacy answers but are valid guesses', () => {
  const legacy = new Set(ANSWER_LIST);
  const guesses = new Set(unpack(GUESSES));
  expect(words.filter((word) => legacy.has(word))).toEqual([]);
  expect(words.filter((word) => !guesses.has(word))).toEqual([]);
});
