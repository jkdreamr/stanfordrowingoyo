import { expect, it } from 'vitest';
import { validateChickenRun } from './chickenCrossing';

const stats = { rows: 10, coins: 2, hops: 12, death: 'car', duration_ms: 2000 };
it('accepts consistent runs, including an empty quit', () => {
  expect(validateChickenRun(16, stats, 2000)).toEqual(stats);
  expect(
    validateChickenRun(0, { rows: 0, coins: 0, hops: 0, death: 'quit', duration_ms: 0 }, 0),
  ).not.toBeNull();
});
it.each([
  null,
  {},
  { ...stats, extra: 1 },
  { ...stats, death: 'nope' },
  { ...stats, rows: -1 },
  { ...stats, hops: 12.5 },
  { ...stats, coins: 11 },
  { ...stats, hops: 9 },
  { ...stats, duration_ms: 4000 },
  { ...stats, hops: 100 },
  { ...stats, rows: Number.MAX_SAFE_INTEGER + 1 },
])('rejects invalid stats %j', (value) => expect(validateChickenRun(16, value, 2000)).toBeNull());
it('rejects score mismatch, maximum, negative time and excessive hop rate', () => {
  expect(validateChickenRun(17, stats, 2000)).toBeNull();
  expect(
    validateChickenRun(100001, { ...stats, rows: 100001, coins: 0, hops: 100001 }, 1e9),
  ).toBeNull();
  expect(validateChickenRun(16, stats, -1)).toBeNull();
  expect(validateChickenRun(16, { ...stats, duration_ms: 0 }, 0)).toBeNull();
});
