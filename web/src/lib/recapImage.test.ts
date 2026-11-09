// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import type { WeeklyRecap } from '../../../shared/types';
import { drawRecap, recapTiles, shareRecapFile } from './recapImage';

const recap: WeeklyRecap = {
  week_start: '2026-03-30',
  total_m: 64200,
  target_m: 60000,
  percent: 107,
  hit_target: true,
  entry_count: 7,
  by_modality: { erg: 40000, bike: 12000, run: 12200 },
  streak: 4,
  best_effort: null,
  team: { total_m: 2400000, entry_count: 300, rowers: 42, rowers_hit_target: 30 },
  rank: 3,
  race: {
    week_start: '2026-03-30',
    starts_at: '2026-03-30T07:00:00.000Z',
    ends_at: '2026-04-06T07:00:00.000Z',
    status: 'final',
    rowers: 42,
    stanford_m: 2400000,
    target_m: 2520000,
    berkeley_total_m: 2268000,
    berkeley_m: 2268000,
  },
  plan: { start_date: '2026-03-23', week: 2, planned_m: 80000, logged_m: 64200, complete: false },
  games: { played: 9, days: 5, best_dive: 640, word_guess_solves: 3, streak: 5 },
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('picks four figures in reading order and omits missing ones', () => {
  expect(recapTiles(recap)).toEqual([
    { label: 'Team Rank', value: '#3', detail: 'of 42' },
    { label: 'vs Berkeley', value: 'Won', detail: 'by 132.0k' },
    { label: 'My Fortnight', value: '80%', detail: 'Week 2' },
    { label: 'Games', value: '9', detail: 'Best Dive 640' },
  ]);
  expect(
    recapTiles({
      ...recap,
      rank: null,
      race: null,
      plan: null,
      games: { ...recap.games, played: 0 },
    }),
  ).toEqual([{ label: 'Workouts', value: '7', detail: '4 Week Streak' }]);
});
it('draws every figure onto the story canvas', () => {
  const text: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (target: Record<string, unknown>, key: string) => {
        if (key === 'fillText') return (value: string) => text.push(value);
        if (key === 'measureText') return (value: string) => ({ width: value.length * 20 });
        if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
        if (key in target) return target[key];
        return () => {};
      },
      set: (target, key: string, value) => {
        target[key] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  drawRecap(ctx, recap, 'Joshua Koo');
  expect(text).toEqual(
    expect.arrayContaining([
      'Stanford Rowing',
      'Mar 30 – Apr 5',
      'Joshua Koo',
      '64,200',
      'of 60,000 E-meters',
      '107%',
      'Target Hit',
      '#3',
      'Won',
      '80%',
      'Best Dive 640',
      '2,400,000 Team E-meters',
    ]),
  );
  text.length = 0;
  drawRecap(
    ctx,
    {
      ...recap,
      total_m: 6000,
      target_m: 80000,
      percent: 7.5,
      hit_target: false,
      plan: { ...recap.plan!, planned_m: 80000, logged_m: 6000, complete: false },
    },
    'Rower',
  );
  expect(text.filter((value) => value === '7%')).toHaveLength(2);
  expect(text).not.toContain('8%');
  expect(text).not.toContain('Target Hit');
});
it('shares the PNG where files are supported, otherwise downloads it', async () => {
  const file = new File(['png'], 'oyo-week-2026-03-30.png', { type: 'image/png' });
  const share = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { ...navigator, share, canShare: () => true });
  expect(await shareRecapFile(file, { title: 'Week', text: 'Text' })).toBe('shared');
  expect(share).toHaveBeenCalledWith({ title: 'Week', text: 'Text', files: [file] });
  share.mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'));
  expect(await shareRecapFile(file, { title: 'Week', text: 'Text' })).toBe('cancelled');
  vi.stubGlobal('navigator', { ...navigator, share: undefined, canShare: undefined });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  URL.createObjectURL = vi.fn(() => 'blob:recap');
  URL.revokeObjectURL = vi.fn();
  expect(await shareRecapFile(file, { title: 'Week', text: 'Text' })).toBe('downloaded');
  expect(click).toHaveBeenCalledOnce();
});
