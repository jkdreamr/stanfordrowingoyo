import { expect, it } from 'vitest';
import { parseCssTime } from './cssTime';

it.each([
  ['.2s', 200],
  ['200ms', 200],
  ['0.28s', 280],
  ['  200ms  ', 200],
  ['\t.2s, 0.28s, 100ms\n', 280],
  ['300ms, .2s', 300],
  ['0ms', 0],
  ['0s', 0],
  ['2e-1s', 200],
  ['200MS', 200],
])('parses %j as %d milliseconds', (value, expected) => {
  expect(parseCssTime(value)).toBeCloseTo(expected);
});

it.each([
  '',
  ' ',
  'garbage',
  '200',
  '200ms garbage',
  '200 ms',
  '-.2s',
  'NaNs',
  'Infinityms',
  '1e999s',
  '200ms,',
  '200ms, garbage',
])('uses the fallback for %j', (value) => {
  expect(parseCssTime(value, 520)).toBe(520);
  expect(parseCssTime(value)).toBe(0);
});
