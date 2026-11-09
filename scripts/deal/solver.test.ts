import { expect, it } from 'vitest';
import { applyDealOp, type DealOp } from '../../shared/games/deal';
import { dealSolver } from './solver';

// Independently enumerate trees recursively, splitting labeled leaves once per
// unordered partition. No dynamic programming or final lookup is used here.
function brute(values: number[]): number[] {
  if (values.length === 1) return values;
  const out: number[] = [];
  for (let mask = 1; mask < (1 << values.length) - 1; mask++) {
    if (!(mask & 1)) continue;
    const a = brute(values.filter((_, i) => mask & (1 << i))),
      b = brute(values.filter((_, i) => !(mask & (1 << i))));
    for (const x of a)
      for (const y of b)
        for (const [l, op, r] of [
          [x, '+', y],
          [x, '*', y],
          [x, '-', y],
          [y, '-', x],
          [x, '/', y],
          [y, '/', x],
        ] as [number, DealOp, number][]) {
          const v = applyDealOp(l, op, r);
          if (v !== null) out.push(v);
        }
  }
  return out;
}
it('solves known 24 hands', () => {
  expect(dealSolver([1, 1, 1, 1]).count(24)).toBe(0);
  expect(dealSolver([4, 7, 8, 8]).count(24)).toBeGreaterThan(0);
  expect(dealSolver([8, 4]).count(2)).toBe(1);
  expect(dealSolver([8, 4], false).count(2)).toBe(0);
  expect(dealSolver([2, 3], false).count(6)).toBe(1);
});
it('matches independently enumerated tree counts including repeated leaves', () => {
  for (const hand of [[1], [1, 1], [2, 3, 4], [1, 2, 2, 3]]) {
    const all = brute(hand),
      s = dealSolver(hand);
    for (let goal = 1; goal <= 80; goal++)
      expect(s.count(goal), `${hand}: ${goal}`).toBe(all.filter((v) => v === goal).length);
  }
  expect(() => dealSolver([])).toThrow();
  for (const goal of [0, -1, 1.5, NaN, Infinity]) expect(dealSolver([1, 1]).count(goal)).toBe(0);
});
