import { expect, it } from 'vitest';
import { testTime, testValues } from './ergTests';
it('parses time and split, derives both distances and rounds to tenths', () => {
  expect(testValues('6:42.3', 'time', '2k')).toEqual({ time_s: 402.3, split_s: 100.6 });
  expect(testValues('1:45.2', 'split', '6k')).toEqual({ time_s: 1262.4, split_s: 105.2 });
  expect(testTime(1262.4)).toBe('21:02.4');
  expect(testTime(119.99)).toBe('2:00.0');
  expect(testValues('20:00', 'time', '6k')).toEqual({ time_s: 1200, split_s: 100 });
  expect(testValues('20.00', 'time', '6k')).toEqual({ time_s: 1200, split_s: 100 });
  expect(testValues('1.00.00', 'time', '6k')).toEqual({ time_s: 3600, split_s: 300 });
  expect(testValues('1450', 'split', '2k')).toEqual({ time_s: 420, split_s: 105 });
  for (const value of ['', '1:60', '1:01.22', '-1:30', '90', '0:59.9', '5:00.1'])
    expect(testValues(value, 'split', '2k')).toBeNull();
  expect(testValues('6:00', 'time', '6k')).toBeNull();
});
