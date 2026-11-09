import { describe, expect, it } from 'vitest';
import {
  formatMeters,
  formatPercent,
  formatSplit,
  formatKm,
  formatEMeters,
  formatDuration,
  parseDuration,
  parseSplit,
  splitFromTime,
  formatEntryDate,
  formatShortDate,
} from './format';
describe('training formats', () => {
  it('uses the same floored percentage on every progress label', () => {
    expect(formatPercent((6000 / 80000) * 100)).toBe('7%');
    expect(formatPercent(99.99875)).toBe('99%');
    expect(formatPercent(100)).toBe('100%');
    expect(formatPercent(137.5)).toBe('137%');
    expect(formatPercent(NaN)).toBe('—%');
  });
  it('rounds meters and splits without raw floats', () => {
    expect(formatMeters(20000.4)).toBe('20,000 m');
    expect(formatMeters(20000, true)).toBe('20.0k');
    expect(formatSplit(112.39999)).toBe('1:52.4');
    expect(formatSplit(119.99)).toBe('2:00.0');
    expect(formatKm(12000)).toBe('12.0 km');
    expect(formatKm(12345, 2)).toBe('12.35 km');
    expect(formatEMeters(20000)).toBe('20,000 E-meters');
    expect(formatEMeters(20000, true)).toBe('20.0k');
  });
  it('formats zero and rejects nonfinite and negative measurements', () => {
    for (const fn of [formatMeters, formatSplit, formatKm, formatEMeters, formatDuration]) {
      expect(fn(NaN)).toBe('—');
      expect(fn(-1)).toBe('—');
      expect(fn(Infinity)).toBe('—');
      expect(fn(0)).not.toBe('—');
    }
  });
  it('formats and parses durations', () => {
    expect(formatDuration(3723)).toBe('1:02:03');
    expect(formatDuration(1500)).toBe('25:00');
    expect(formatDuration(0)).toBe('0:00');
    expect(parseDuration('25:00')).toBe(1500);
    expect(parseDuration('1:02:03')).toBe(3723);
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('0')).toBe(0);
    for (const text of ['', '1:60', '-1', 'a', '1:2', '1:00:99', '1.5'])
      expect(parseDuration(text)).toBeNull();
  });
  it('parses pace and calculates pace', () => {
    expect(parseSplit('1:52.4')).toBe(112.4);
    expect(parseSplit('0:00')).toBe(0);
    for (const text of ['', '90', '1:60', '-1:20', '1:52.44']) expect(parseSplit(text)).toBeNull();
    expect(splitFromTime(1500, 6000)).toBe(125);
    expect(splitFromTime(0, 500)).toBe(0);
    for (const [time, distance] of [
      [1, 0],
      [-1, 500],
      [NaN, 500],
      [1, Infinity],
    ])
      expect(splitFromTime(time, distance)).toBeNull();
  });
  it('uses LA calendar dates including UTC midnight and invalid dates', () => {
    const now = new Date('2025-11-04T02:00:00Z');
    expect(formatEntryDate('2025-11-03', now)).toBe('Today');
    expect(formatEntryDate('2025-11-02', now)).toBe('Yesterday');
    expect(formatShortDate('2025-11-03')).toBe('Mon, Nov 3');
    expect(formatEntryDate('2025-11-01', now)).toBe('Sat, Nov 1');
    for (const date of ['', 'bad', '2025-02-30']) expect(formatShortDate(date)).toBe('—');
  });
});
