import { describe, expect, it } from 'vitest';
import type { LeaderboardRow } from '../../../shared/types';
import {
  displayPercent,
  formatWeekRange,
  hitTarget,
  parseMetric,
  parseWeek,
  profilePath,
  progressValue,
  rowFigures,
  rowLabel,
  seasonLabel,
} from './leaderboard';

const row = (over: Partial<LeaderboardRow> = {}): LeaderboardRow => ({
  user: {
    id: 'user-2',
    name: 'Jack Griffin',
    role: 'rower',
    group_key: 'u23',
    avatar_image_id: null,
  } as LeaderboardRow['user'],
  target_m: 80000,
  total_m: 48000,
  percent: 60,
  rank: 4,
  streak: 0,
  entry_count: 3,
  ...over,
});

describe('leaderboard helpers', () => {
  it('parses URL state and never moves past the current week', () => {
    expect(parseMetric('meters')).toBe('meters');
    expect(parseMetric('season')).toBe('season');
    expect(parseMetric('points')).toBe('percent');
    expect(parseMetric(null)).toBe('percent');
    expect(parseWeek(null, '2026-11-02')).toBe('2026-11-02');
    expect(parseWeek('2026-10-26', '2026-11-02')).toBe('2026-10-26');
    expect(parseWeek('2026-10-29', '2026-11-02')).toBe('2026-10-26');
    expect(parseWeek('2026-11-09', '2026-11-02')).toBe('2026-11-02');
    expect(parseWeek('2026-02-30', '2026-11-02')).toBe('2026-11-02');
    expect(parseWeek('nope', '2026-11-02')).toBe('2026-11-02');
  });
  it('formats Los Angeles week ranges and season scope', () => {
    expect(formatWeekRange('2026-11-02', '2026-11-02')).toBe('Nov 2 – 8');
    expect(formatWeekRange('2026-10-26', '2026-11-02')).toBe('Oct 26 – Nov 1');
    expect(formatWeekRange('2026-12-28', '2027-01-04')).toBe('Dec 28, 2026 – Jan 3, 2027');
    expect(formatWeekRange('2025-11-03', '2026-11-02')).toBe('Nov 3 – 9, 2025');
    expect(seasonLabel('2026-11-06', '09-01')).toBe('2026–27 Season');
    expect(seasonLabel('2027-08-31', '09-01')).toBe('2026–27 Season');
    expect(seasonLabel('2027-09-01', '09-01')).toBe('2027–28 Season');
  });
  it('never rounds an unfinished target up to 100%', () => {
    expect(displayPercent(99.96)).toBe('99%');
    expect(displayPercent(100)).toBe('100%');
    expect(displayPercent(137.5)).toBe('137%');
    expect(hitTarget(row({ total_m: 79999, percent: 100 }))).toBe(false);
    expect(hitTarget(row({ total_m: 80000, percent: 100 }))).toBe(true);
    expect(hitTarget(row({ target_m: 0, total_m: 0, percent: 0 }))).toBe(false);
    expect(progressValue(row({ total_m: 120000 }))).toBe(100);
    expect(progressValue(row({ target_m: 0 }))).toBe(0);
  });
  it('picks the main figure per metric and builds a spoken label', () => {
    expect(rowFigures(row(), 'percent')).toMatchObject({
      main: '60%',
      secondary: '48.0k of 80.0k',
    });
    expect(rowFigures(row(), 'meters')).toMatchObject({
      main: '48,000',
      secondary: '60% of target',
    });
    expect(
      rowFigures(row({ total_m: 605560, target_m: 800000, percent: 75.7 }), 'season'),
    ).toMatchObject({ main: '605,560', secondary: '75% of season target' });
    expect(rowLabel(row({ streak: 3, total_m: 90000, percent: 112.5 }), 'percent', true)).toBe(
      'Rank 4, Jack Griffin (You), 112% of target, 90,000 E-meters, 3 week streak, Target Hit',
    );
    expect(rowLabel(row({ streak: 1 }), 'meters', false)).not.toContain('streak');
  });
  it('links my row to /me and teammates to their profile', () => {
    expect(profilePath(row(), 'user-2')).toBe('/me');
    expect(profilePath(row(), 'user-1')).toBe('/users/user-2');
  });
});
