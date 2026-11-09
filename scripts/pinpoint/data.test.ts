import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { addDays } from '../../shared/dates';
import { pinpointPuzzles, pinpointPuzzleFor } from '../../worker/src/games/pinpoint/puzzles';
import {
  distance,
  matchesPinpoint,
  normalizePinpoint,
  typoLimit,
  NEAR_MISSES,
} from '../../worker/src/games/pinpoint/match';
import { pinpointScore, formatPinpointScore, pinpointShare } from '../../shared/games/pinpoint';

const puzzles = pinpointPuzzles();
const stop = new Set(
  'things words with before after types famous that have of made only'.split(' '),
);
it('validates the staged bank and all clues and accepted phrasings', () => {
  expect(puzzles).toHaveLength(40);
  for (const puzzle of puzzles) {
    expect(puzzle.clues, puzzle.category).toHaveLength(5);
    expect(new Set(puzzle.clues.map(normalizePinpoint)).size, puzzle.category).toBe(5);
    expect(
      new Set(puzzle.accepted.map(normalizePinpoint)).size,
      puzzle.category,
    ).toBeGreaterThanOrEqual(3);
    const tokens = normalizePinpoint(puzzle.category)
      .split(' ')
      .filter((t) => !stop.has(t) && t.length >= 3);
    for (const clue of puzzle.clues) {
      expect(clue.length).toBeGreaterThan(0);
      expect(clue.length).toBeLessThanOrEqual(20);
      for (const token of tokens)
        expect(clue.toLowerCase(), `${puzzle.category}: ${clue}`).not.toContain(token);
    }
    for (const accepted of puzzle.accepted)
      expect(matchesPinpoint(accepted, puzzle), `${puzzle.category}: ${accepted}`).toBe(true);
    for (const miss of NEAR_MISSES)
      expect(matchesPinpoint(miss, puzzle), `${puzzle.category}: ${miss}`).toBe(false);
  }
});
it.todo('expands the staged bank to at least 365 puzzles before full-year launch');

it('has no duplicate, near-duplicate or cross-bank matching answers', () => {
  for (let i = 0; i < puzzles.length; i++)
    for (let j = i + 1; j < puzzles.length; j++) {
      const a = puzzles[i],
        b = puzzles[j];
      const label = `${a.category} / ${b.category}`;
      expect(normalizePinpoint(a.category), label).not.toBe(normalizePinpoint(b.category));
      const at = new Set(
        normalizePinpoint(a.category)
          .split(' ')
          .filter((t) => !stop.has(t)),
      );
      const bt = new Set(
        normalizePinpoint(b.category)
          .split(' ')
          .filter((t) => !stop.has(t)),
      );
      const union = new Set([...at, ...bt]);
      expect([...at].filter((t) => bt.has(t)).length / union.size, label).toBeLessThan(0.8);
      for (const aa of a.accepted) {
        expect(matchesPinpoint(aa, b), `${label}: ${aa}`).toBe(false);
        for (const bb of b.accepted) {
          expect(matchesPinpoint(bb, a), `${label}: ${bb}`).toBe(false);
          const na = normalizePinpoint(aa),
            nb = normalizePinpoint(bb);
          expect(distance(na, nb), `${label}: ${aa} / ${bb}`).toBeGreaterThan(
            Math.max(typoLimit(na), typoLimit(nb)),
          );
        }
      }
    }
});

it('precomputes disjoint typo neighborhoods so request matching needs only today', () => {
  for (const puzzle of puzzles)
    for (let i = 0; i < puzzle.accepted.length; i++) {
      if (!(puzzle.typoMask & (1 << i))) continue;
      const answer = normalizePinpoint(puzzle.accepted[i]);
      for (const other of puzzles)
        if (other !== puzzle)
          for (const accepted of other.accepted) {
            const normalized = normalizePinpoint(accepted);
            expect(distance(answer, normalized), `${answer} / ${normalized}`).toBeGreaterThan(
              typoLimit(answer) + typoLimit(normalized),
            );
          }
    }
});

it('pins the first-year date-to-category schedule and wraps negative days', () => {
  const schedule = Array.from({ length: 365 }, (_, i) => {
    const date = addDays('2026-11-16', i);
    return `${date}|${pinpointPuzzleFor(date).category}`;
  }).join('\n');
  expect(createHash('sha256').update(schedule).digest('hex')).toBe(
    '785b36e2821171ebb10bed2ff181b8c854e332e45a0900e3d7e04946d7153d8d',
  );
  expect(pinpointPuzzleFor('2026-11-15')).toBe(puzzles[39]);
  expect(pinpointPuzzleFor(addDays('2026-11-16', 40))).toBe(puzzles[0]);
});

it.each([
  ['The types of GLÁSSES!', 'glass'],
  ['buses', 'bus'],
  ['glass', 'glass'],
  ['bus', 'bus'],
  ['kinds of berries', 'berry'],
  ['A shoe & the boots', 'shoe and boot'],
  ['things that are red', 'red'],
  ['"___ ball"', 'ball'],
  ['!!!', ''],
])('normalizes %s', (input, expected) => expect(normalizePinpoint(input)).toBe(expected));
it('accepts bounded typos but rejects short errors, substitutions and per-puzzle rejects', () => {
  expect(matchesPinpoint('palindormes', puzzles[35])).toBe(true);
  expect(matchesPinpoint('bal', puzzles[0])).toBe(false);
  expect(matchesPinpoint('words before bell', puzzles[0])).toBe(false);
  expect(
    matchesPinpoint('palindromic', { accepted: ['palindromes'], reject: ['palindromic'] }),
  ).toBe(false);
  expect(matchesPinpoint('', puzzles[0])).toBe(false);
  expect(matchesPinpoint('ordinary vegetables', puzzles[0])).toBe(false);
});
it('scores and shares without clue or category spoilers', () => {
  expect(pinpointScore(true, 1)).toBe(5);
  expect(pinpointScore(true, 3)).toBe(3);
  expect(pinpointScore(false, 5)).toBe(0);
  expect(formatPinpointScore(3)).toBe('3 / 5');
  expect(formatPinpointScore(0)).toBe('X / 5');
  expect(pinpointShare('2026-11-16', true, 3)).toBe('Pinpoint · 2026-11-16 · 3/5\n🟥🟥🟩⬜⬜');
  expect(pinpointShare('2026-11-16', false, 5)).toBe('Pinpoint · 2026-11-16 · X/5\n🟥🟥🟥🟥🟥');
});
it('keeps every web source disconnected from Worker content', () => {
  function files(path: string): string[] {
    return readdirSync(path, { withFileTypes: true }).flatMap((item) =>
      item.isDirectory() ? files(resolve(path, item.name)) : [resolve(path, item.name)],
    );
  }
  for (const path of files(resolve('web/src')).filter(
    (p) => /\.[jt]sx?$/.test(p) && !/\.test\./.test(p),
  ))
    expect(readFileSync(path, 'utf8')).not.toMatch(/(?:from|import\()[^\n]*worker\//);
});
