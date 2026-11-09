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
  'things words with before after types kinds famous that have of made only the a an in at and to as be can for named first last starting ending from whose is their names used using by out spelled least'
    .split(' ')
    .map(normalizePinpoint),
);
it('validates the staged bank and all clues and accepted phrasings', () => {
  expect(puzzles).toHaveLength(372);
  for (const puzzle of puzzles) {
    expect(puzzle.clues, puzzle.category).toHaveLength(5);
    expect(new Set(puzzle.clues.map(normalizePinpoint)).size, puzzle.category).toBe(5);
    expect(new Set(puzzle.accepted).size, puzzle.category).toBeGreaterThanOrEqual(3);
    expect(puzzle.category.split(/\s+/).length, puzzle.category).toBeLessThanOrEqual(5);
    expect(puzzle.accepted.length, puzzle.category).toBeLessThanOrEqual(32);
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
      expect(matchesPinpoint(miss, puzzle), `${puzzle.category}: ${miss}`).toBe(
        puzzle.accepted.some((answer) => normalizePinpoint(answer) === normalizePinpoint(miss)),
      );
  }
});
it('has a full year of unique daily puzzles plus spares', () => {
  expect(puzzles.length).toBeGreaterThanOrEqual(365);
  expect(
    new Set(
      Array.from({ length: 365 }, (_, i) => pinpointPuzzleFor(addDays('2026-11-16', i)).category),
    ).size,
  ).toBe(365);
});

it('accepts natural attribute names and verb forms without filler aliases', () => {
  for (const puzzle of puzzles.filter((p) => p.kind === 'T')) {
    const noun = /^Things with (.+)$/.exec(puzzle.category)?.[1];
    if (noun) {
      for (const input of [
        noun,
        `things that have ${noun}`,
        `objects with ${noun}`,
        `stuff with ${noun}`,
        `with ${noun}`,
      ])
        expect(matchesPinpoint(input, puzzle), `${puzzle.category}: ${input}`).toBe(true);
    } else {
      const participle = puzzle.category.split(' ').at(-1)!;
      const verb = puzzle.accepted
        .find((answer) => answer.startsWith('things you can '))!
        .replace('things you can ', '');
      for (const input of [participle, verb, `things you can ${verb}`])
        expect(matchesPinpoint(input, puzzle), `${puzzle.category}: ${input}`).toBe(true);
    }
    expect(puzzle.accepted.join(' ')).not.toMatch(/bearers|drawable|servable/);
  }
  for (const [input, category] of [
    ['chambers', 'Things with chambers'],
    ['keys', 'Things with keys'],
    ['cracked', 'Things that can be cracked'],
    ['crack', 'Things that can be cracked'],
  ])
    expect(
      matchesPinpoint(
        input,
        puzzles.find((p) => p.category === category)!,
      ),
    ).toBe(true);
  expect(
    matchesPinpoint(
      'kings',
      puzzles.find((p) => p.category === 'Things with keys')!,
    ),
  ).toBe(false);
});

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
      expect(
        union.size ? [...at].filter((t) => bt.has(t)).length / union.size : 0,
        label,
      ).toBeLessThan(0.8);
      for (const aa of a.accepted) {
        expect(matchesPinpoint(aa, b), `${label}: ${aa}`).toBe(false);
      }
      for (const bb of b.accepted) expect(matchesPinpoint(bb, a), `${label}: ${bb}`).toBe(false);
    }
}, 60000);

it('interleaves kinds, limits compound density, and caps clue reuse', () => {
  const counts = { C: 0, T: 0, S: 0, W: 0 };
  const clues = new Map<string, string[]>();
  for (let i = 0; i < puzzles.length; i++) {
    const puzzle = puzzles[i];
    counts[puzzle.kind]++;
    expect(puzzle.kind, puzzle.category).not.toBe(puzzles[(i + 1) % puzzles.length].kind);
    expect(puzzle.kind === 'C', puzzle.category).toBe(
      /^Words (?:before|after) /.test(puzzle.category),
    );
    expect(
      Array.from({ length: 5 }, (_, j) => puzzles[(i + j) % puzzles.length]).filter(
        (p) => p.kind === 'C',
      ).length,
    ).toBeLessThanOrEqual(2);
    for (const clue of puzzle.clues) {
      const key = normalizePinpoint(clue);
      clues.set(key, [...(clues.get(key) ?? []), puzzle.category]);
    }
  }
  expect(counts).toEqual({ C: 144, T: 74, S: 94, W: 60 });
  expect(counts.C / puzzles.length).toBeLessThanOrEqual(0.4);
  expect(counts.T / puzzles.length).toBeGreaterThanOrEqual(0.15);
  expect(counts.T / puzzles.length).toBeLessThanOrEqual(0.2);
  expect(counts.S / puzzles.length).toBeGreaterThanOrEqual(0.24);
  expect(counts.S / puzzles.length).toBeLessThanOrEqual(0.26);
  expect(counts.W / puzzles.length).toBeGreaterThanOrEqual(0.15);
  expect(counts.W / puzzles.length).toBeLessThanOrEqual(0.2);
  for (const [clue, categories] of clues)
    expect(categories.length, `${clue}: ${categories.join(', ')}`).toBeLessThanOrEqual(2);
  expect(
    puzzles.filter((p) =>
      /rowing|stanford|crew terminology/i.test(p.category + ' ' + p.accepted.join(' ')),
    ).length,
  ).toBeLessThanOrEqual(8);
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
}, 60000);

it('pins the first-year date-to-category schedule and wraps negative days', () => {
  const schedule = Array.from({ length: 365 }, (_, i) => {
    const date = addDays('2026-11-16', i);
    return `${date}|${pinpointPuzzleFor(date).category}`;
  }).join('\n');
  expect(createHash('sha256').update(schedule).digest('hex')).toBe(
    'ada00bd2b91fd03857889126ca6dc8b84eed6113dec53a212b818b20befc4a34',
  );
  expect(pinpointPuzzleFor('2026-11-15')).toBe(puzzles.at(-1));
  expect(pinpointPuzzleFor(addDays('2026-11-16', puzzles.length))).toBe(puzzles[0]);
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
  ['objects with keys', 'key'],
  ['stuff with chambers', 'chamber'],
  ['things that have chambers', 'chamber'],
  ['things that can be cracked', 'cracked'],
  ['!!!', ''],
])('normalizes %s', (input, expected) => expect(normalizePinpoint(input)).toBe(expected));
it('accepts bounded typos but rejects short errors, substitutions and per-puzzle rejects', () => {
  expect(
    matchesPinpoint(
      'palindormes',
      puzzles.find((p) => p.category === 'Palindromes')!,
    ),
  ).toBe(true);
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
