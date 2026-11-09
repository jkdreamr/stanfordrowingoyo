import { describe, expect, it } from 'vitest';
import { parsePuzzle, type ConnectionsPuzzle } from './connections';
import { CONNECTIONS_PUZZLES } from '../../worker/src/games/connectionsPuzzles';
import { CONNECTIONS_EXPANSION_A } from '../../worker/src/games/connectionsExpansionA';

const norm = (w: string) => w.toLowerCase();
const puzzles = CONNECTIONS_EXPANSION_A.map(parsePuzzle);
const existing = CONNECTIONS_PUZZLES.map(parsePuzzle);

/** Partitions into four groups of four, counting every red herring as a decoy-group member. */
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

describe('connections expansion A', () => {
  it('has 55 well-formed puzzles', () => {
    expect(puzzles).toHaveLength(55);
    for (const p of puzzles) {
      expect(p.groups.map((g) => g.level)).toEqual([0, 1, 2, 3]);
      const words = p.groups.flatMap((g) => g.words);
      for (const g of p.groups) {
        expect(g.name.length).toBeGreaterThan(1);
        expect(g.words).toHaveLength(4);
      }
      expect(new Set(words.map(norm)).size).toBe(16);
      for (const w of words) {
        expect(w).toMatch(/^[A-Za-z][A-Za-z' .-]*$/);
        for (const part of w.split(' ')) expect(part.length).toBeLessThanOrEqual(9);
      }
    }
  });

  it('meets the red herring and single-solution bar', () => {
    for (const p of puzzles) {
      expect(p.herrings.length).toBeGreaterThanOrEqual(3);
      expect(new Set(p.herrings.map((h) => h.group)).size).toBeGreaterThanOrEqual(2);
      expect(new Set(p.herrings.map((h) => `${h.word}>${h.group}`)).size).toBe(p.herrings.length);
      for (const h of p.herrings) {
        const own = p.groups.findIndex((g) => g.words.includes(h.word));
        expect(own, h.word).toBeGreaterThanOrEqual(0);
        expect(h.group).not.toBe(own);
        expect(h.group).toBeGreaterThanOrEqual(0);
        expect(h.group).toBeLessThan(4);
      }
      expect(solutions(p), p.groups[0].name).toBe(1);
    }
  });

  it('shares no category name, board or near-duplicate group with the main bank', () => {
    const all = [...existing, ...puzzles];
    const names = all.flatMap((p) => p.groups.map((g) => norm(g.name)));
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
    const boards = all.map((p) =>
      p.groups
        .flatMap((g) => g.words.map(norm))
        .sort()
        .join(),
    );
    expect(new Set(boards).size).toBe(all.length);
    const groups = all.flatMap((p) => p.groups.map((g) => new Set(g.words.map(norm))));
    const close: string[] = [];
    for (let i = 0; i < groups.length; i++)
      for (let j = i + 1; j < groups.length; j++) {
        const shared = [...groups[i]].filter((w) => groups[j].has(w));
        if (shared.length >= 3) close.push(`${names[i]} ~ ${names[j]}`);
      }
    expect(close).toEqual([]);
  });
});
