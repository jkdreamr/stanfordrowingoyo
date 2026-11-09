import { expect, it } from 'vitest';
import { parsePuzzle, type ConnectionsPuzzle } from '../../../shared/games/connections';
import { CONNECTIONS_PUZZLES } from './connectionsPuzzles';
import { CONNECTIONS_EXPANSION_C } from './connectionsExpansionC';

const puzzles = CONNECTIONS_EXPANSION_C.map(parsePuzzle);

function solutions(p: ConnectionsPuzzle) {
  const fits = p.groups.map((g, i) => {
    const set = new Set(g.words);
    for (const h of p.herrings) if (h.group === i) set.add(h.word);
    return set;
  });
  const words = p.groups.flatMap((g) => g.words);
  let count = 0;
  const assign = (k: number, used: number[]) => {
    if (k === words.length) return void count++;
    for (let c = 0; c < 4; c++)
      if (used[c] < 4 && fits[c].has(words[k])) {
        used[c]++;
        assign(k + 1, used);
        used[c]--;
      }
  };
  assign(0, [0, 0, 0, 0]);
  return count;
}

it('has 20 well-formed puzzles with one solution and fair herrings', () => {
  expect(puzzles).toHaveLength(20);
  for (const p of puzzles) {
    expect(p.groups.map((g) => g.words.length)).toEqual([4, 4, 4, 4]);
    const words = p.groups.flatMap((g) => g.words);
    expect(new Set(words.map((w) => w.toLowerCase())).size).toBe(16);
    for (const w of words) {
      expect(w).toMatch(/^[A-Za-z][A-Za-z' .-]*$/);
      for (const part of w.split(' ')) expect(part.length).toBeLessThanOrEqual(9);
    }
    expect(p.herrings.length).toBeGreaterThanOrEqual(3);
    expect(new Set(p.herrings.map((h) => h.group)).size).toBeGreaterThanOrEqual(2);
    for (const h of p.herrings) {
      const own = p.groups.findIndex((g) => g.words.includes(h.word));
      expect(own).toBeGreaterThanOrEqual(0);
      expect(h.group).not.toBe(own);
    }
    expect(solutions(p)).toBe(1);
  }
});

it('uses fresh category names and no group shares three words with the legacy bank', () => {
  const legacy = CONNECTIONS_PUZZLES.map(parsePuzzle).flatMap((p) => p.groups);
  const legacyNames = new Set(legacy.map((g) => g.name.toLowerCase()));
  const names = puzzles.flatMap((p) => p.groups.map((g) => g.name.toLowerCase()));
  expect(new Set(names).size).toBe(names.length);
  expect(names.filter((n) => legacyNames.has(n))).toEqual([]);
  for (const g of puzzles.flatMap((p) => p.groups)) {
    const words = new Set(g.words.map((w) => w.toLowerCase()));
    for (const l of legacy)
      expect(l.words.filter((w) => words.has(w.toLowerCase())).length).toBeLessThan(3);
  }
});
