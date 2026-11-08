import { expect, it } from 'vitest';
import { DIVE_TIERS, diveVerdict, normalizeAnswer } from './dive';

it.each([
  ['  THE   Red OARS  ', 'red oar'],
  ['A café', 'cafe'],
  ['An Éclair', 'eclair'],
  ['Coxswain’s!', 'coxswain'],
  ["rock'n'roll", 'rocknroll'],
  ['Bow-Side/Seat_2', 'bow side seat 2'],
  ['B & B', 'b and b'],
  ['Ｃａｆé', 'cafe'],
  ['', ''],
  ['   ', ''],
  ['!!!', ''],
  ['Berries', 'berry'],
  ['Buses', 'bus'],
  ['Boxes', 'box'],
  ['Waltzes', 'waltz'],
  ['Benches', 'bench'],
  ['Dishes', 'dish'],
  ['Oars', 'oar'],
  ['Glass', 'glass'],
  ['Walrus', 'walrus'],
  ['Analysis', 'analysis'],
  ['Bus', 'bus'],
  ['Skis', 'skis'],
  ['Oars Races', 'oars race'],
])('normalizes %j to %j', (raw, expected) => expect(normalizeAnswer(raw)).toBe(expected));

it('defines curated, crowd-independent points and spoiler-free share glyphs', () => {
  expect(Object.values(DIVE_TIERS).map(({ points }) => points)).toEqual([
    10, 15, 30, 60, 85, 100, 0,
  ]);
  expect(Object.values(DIVE_TIERS).map(({ emoji }) => emoji)).toEqual([
    '🫧',
    '🤡',
    '🐟',
    '🦑',
    '🐙',
    '🦪',
    '⬛',
  ]);
});
it.each([
  [0, 'High And Dry'],
  [1, 'Toe Dipper'],
  [99, 'Toe Dipper'],
  [100, 'Getting Wet'],
  [199, 'Getting Wet'],
  [200, 'Open Water'],
  [299, 'Open Water'],
  [300, 'Deep Diver'],
  [399, 'Deep Diver'],
  [400, 'Abyss Explorer'],
  [499, 'Abyss Explorer'],
  [500, 'Pearl Collector'],
])('gives %i a verdict of %s', (score, verdict) => expect(diveVerdict(score)).toBe(verdict));
