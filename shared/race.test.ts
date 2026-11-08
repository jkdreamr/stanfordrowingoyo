import { describe, expect, it } from 'vitest';
import {
  BERKELEY_PACE_RATIO,
  berkeleyTotal,
  ghostMeters,
  raceLeader,
  raceWeekBounds,
  teamMidnight,
} from './race';

describe('race week bounds', () => {
  it('starts Monday 00:00 team time and lasts a week', () => {
    const { start, end } = raceWeekBounds('2026-11-09');
    expect(new Date(start).toISOString()).toBe('2026-11-09T08:00:00.000Z');
    expect(new Date(end).toISOString()).toBe('2026-11-16T08:00:00.000Z');
  });
  it('follows daylight saving changes', () => {
    expect(new Date(teamMidnight('2026-06-01')).toISOString()).toBe('2026-06-01T07:00:00.000Z');
    const spring = raceWeekBounds('2026-03-02');
    expect((spring.end - spring.start) / 3_600_000).toBe(167);
    const fall = raceWeekBounds('2026-10-26');
    expect((fall.end - fall.start) / 3_600_000).toBe(169);
  });
});

describe('ghost pace', () => {
  const { start, end } = raceWeekBounds('2026-11-09');
  const total = berkeleyTotal(3_000_000);
  it('uses the 90% ratio', () => {
    expect(BERKELEY_PACE_RATIO).toBe(0.9);
    expect(total).toBe(2_700_000);
    expect(berkeleyTotal(0)).toBe(0);
    expect(berkeleyTotal(80_001)).toBe(72_001);
  });
  it('is at zero at week start', () => {
    expect(ghostMeters(total, start, end, start)).toBe(0);
    expect(ghostMeters(total, start, end, start - 1)).toBe(0);
  });
  it('is at the proportional share mid-week', () => {
    expect(ghostMeters(total, start, end, start + (end - start) / 2)).toBe(1_350_000);
    expect(ghostMeters(total, start, end, start + (end - start) / 7)).toBe(385_714);
  });
  it('reaches its total at week end and stays there', () => {
    expect(ghostMeters(total, start, end, end)).toBe(total);
    expect(ghostMeters(total, start, end, end + 86_400_000)).toBe(total);
    expect(ghostMeters(total, start, end, end - 1)).toBe(total);
  });
  it('stays at zero when the team target is zero', () => {
    expect(ghostMeters(0, start, end, start + (end - start) / 2)).toBe(0);
    expect(ghostMeters(0, start, end, end)).toBe(0);
  });
  it('names the leader', () => {
    expect(raceLeader(10, 5)).toBe('stanford');
    expect(raceLeader(5, 10)).toBe('berkeley');
    expect(raceLeader(0, 0)).toBe('tied');
  });
});
