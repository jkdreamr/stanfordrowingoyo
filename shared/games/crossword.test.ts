import { expect, it } from 'vitest';
import { crosswordShare, crosswordSlots, formatCrosswordTime } from './crossword';

it('numbers starts row-major, sharing numbers across directions', () => {
  const slots = crosswordSlots([]);
  expect(slots).toHaveLength(10);
  expect(slots.filter((s) => s.dir === 'across').map((s) => s.number)).toEqual([1, 6, 7, 8, 9]);
  expect(slots.filter((s) => s.dir === 'down').map((s) => s.number)).toEqual([1, 2, 3, 4, 5]);
  expect(crosswordSlots(Array.from({ length: 25 }, (_, i) => i))).toEqual([]);
  expect(crosswordSlots([0, 4, 20, 24]).every((s) => s.length >= 3)).toBe(true);
});
it('formats time and shares without answers', () => {
  expect(formatCrosswordTime(47)).toBe('0:47');
  expect(formatCrosswordTime(754)).toBe('12:34');
  const result = { seconds: 47, penalty: 0, checks: 0, reveals: 0, solution: ['SECRET'] };
  expect(crosswordShare('2026-11-16', result)).toBe(
    'Mini Crossword · 2026-11-16\n0:47\nClean solve',
  );
  expect(crosswordShare('2026-11-16', { ...result, checks: 2, reveals: 1 })).toContain(
    '2 checks · 1 reveal',
  );
});
