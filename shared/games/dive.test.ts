import { expect, it } from 'vitest';
import { divePoints, normalizeAnswer } from './dive';

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

it.each([
  [1, 60, 100, 'Lone Oar'],
  [2, 60, 75, 'Deep Water'],
  [6, 60, 75, 'Deep Water'],
  [7, 60, 50, 'Mid Lake'],
  [15, 60, 50, 'Mid Lake'],
  [16, 60, 25, 'Shallows'],
  [30, 60, 25, 'Shallows'],
  [31, 60, 10, 'Surface'],
  [60, 60, 10, 'Surface'],
  [0, 60, 0, 'Missed'],
  [0, 0, 0, 'Missed'],
])('scores %i of %i as %i %s', (count, total, points, tier) =>
  expect(divePoints(count, total)).toEqual({ points, tier }),
);

it('prioritizes hidden over rarity and missed', () => {
  expect(divePoints(1, 60, true)).toEqual({ points: 0, tier: 'Hidden' });
  expect(divePoints(0, 0, true)).toEqual({ points: 0, tier: 'Hidden' });
});
