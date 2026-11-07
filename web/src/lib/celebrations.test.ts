import { afterEach, expect, it } from 'vitest';
import type { EntryDetail, SeasonStats, User, WeekSummary } from '../../../shared/types';
import {
  clearCelebration,
  detectBests,
  longestRun,
  pendingCelebration,
  recordCelebration,
  type Achievement,
} from './celebrations';

const me = { id: 'rower', best2k_split_s: 100, best6k_split_s: 110 } as User;
const saved = {
  id: 'entry',
  user_id: me.id,
  date: '2026-11-05',
  week_start: '2026-11-02',
  modality: 'erg',
  distance_m: 10000,
  avg_split_s: null,
  duration_s: null,
} as EntryDetail;
const week = (date = saved.week_start, total = 10000, hit = false): WeekSummary => ({
  week_start: date,
  total_m: total,
  target_m: 10000,
  hit_target: hit,
  percent: total / 100,
  by_modality: { erg: total, bike: 0, run: 0 },
  by_zone: {} as WeekSummary['by_zone'],
});
const stats = (overrides: Partial<SeasonStats> = {}): SeasonStats => ({
  ...week(),
  start: '2026-09-01',
  end: '2027-08-31',
  days: [],
  weeks: [],
  streak: 0,
  best_week: null,
  ...overrides,
});
const kinds = (before: SeasonStats | null, after: SeasonStats | null, entry = saved, user = me) =>
  detectBests(before, after, entry, user).map((item) => item.kind);
afterEach(() => clearCelebration(me.id));

it('detects only a strictly better saved-entry week, never the first positive week', () => {
  const before = stats({ best_week: week('2026-10-26') });
  expect(kinds(before, stats({ best_week: week(undefined, 12000) }))).toEqual(['best-week']);
  for (const best of [null, week(), week(undefined, 9000), week('2026-10-26', 20000)])
    expect(kinds(before, stats({ best_week: best }))).toEqual([]);
  expect(kinds(stats(), stats({ best_week: week() }))).toEqual([]);
});
it('rejects missing or mismatched season snapshots, other users and outside-season dates', () => {
  const entry = { ...saved, distance_m: 2000, avg_split_s: 98 };
  const after = stats({ best_week: week(undefined, 15000) });
  for (const [before, next] of [
    [null, after],
    [stats(), null],
    [stats({ start: '2025-09-01' }), after],
    [stats({ end: '2026-08-31' }), after],
  ] as const)
    expect(kinds(before, next, entry)).toEqual([]);
  for (const date of ['2026-08-31', '2027-09-01'])
    expect(kinds(stats(), after, { ...entry, date })).toEqual([]);
  expect(kinds(stats(), after, { ...entry, user_id: 'someone' })).toEqual([]);
});
it('detects longer streak records, ignoring the unfinished current week', () => {
  const before = stats({
    weeks: [week('2026-10-19', 10000, true), week('2026-10-26', 10000, true), week()],
    streak: 2,
  });
  const after = stats({ streak: 3 });
  expect(kinds(before, after)).toEqual(['longest-streak']);
  for (const streak of [0, 1, 2]) expect(kinds(before, stats({ streak }))).toEqual([]);
  expect(kinds(stats(), stats({ streak: 1 }))).toEqual([]);
});
it('uses the lower-priority streak when tying or remaining below a previous longest run', () => {
  const before = stats({
    weeks: [
      week('2026-10-05', 10000, true),
      week('2026-10-12', 10000, true),
      week('2026-10-19', 10000, true),
      week('2026-10-26'),
      week(undefined, 10000, true),
    ],
    streak: 1,
  });
  expect(kinds(before, stats({ streak: 2 }))).toEqual(['streak']);
  expect(kinds(before, stats({ streak: 3 }))).toEqual(['streak']);
});
it('finds consecutive target-hit runs without mutating or bridging gaps', () => {
  const weeks = [
    week('2026-10-19', 10000, true),
    week('2026-10-05', 10000, true),
    week('2026-10-26', 10000, true),
    week('2026-11-02'),
  ];
  expect(longestRun(weeks)).toBe(2);
  expect(weeks[0].week_start).toBe('2026-10-19');
  expect(longestRun([])).toBe(0);
  expect(longestRun([week()])).toBe(0);
});
it.each([
  [2000, 98.2, 'split-2k'],
  [6000, 108, 'split-6k'],
] as const)(
  'detects faster %im erg splits, explicitly entered or derived',
  (distance_m, split, kind) => {
    expect(kinds(stats(), stats(), { ...saved, distance_m, avg_split_s: split })).toEqual([kind]);
    expect(
      kinds(stats(), stats(), { ...saved, distance_m, duration_s: (split * distance_m) / 500 }),
    ).toEqual([kind]);
  },
);
it('rejects tied/slower splits, null benchmarks, missing times, non-erg and other distances', () => {
  const entry = { ...saved, distance_m: 2000, avg_split_s: 98 };
  for (const patch of [
    { avg_split_s: 100 },
    { avg_split_s: 110 },
    { avg_split_s: null },
    { avg_split_s: NaN },
    { avg_split_s: 0 },
    { modality: 'bike' as const },
    { distance_m: 1999 },
  ])
    expect(kinds(stats(), stats(), { ...entry, ...patch })).toEqual([]);
  expect(kinds(stats(), stats(), entry, { ...me, best2k_split_s: null })).toEqual([]);
  expect(
    kinds(stats(), stats(), { ...entry, distance_m: 6000 }, { ...me, best6k_split_s: null }),
  ).toEqual([]);
});
it('orders split bests above longest streaks and best weeks', () => {
  const before = stats({
    streak: 1,
    weeks: [week('2026-10-26', 10000, true)],
    best_week: week('2026-10-26'),
  });
  const after = stats({ streak: 2, best_week: week(undefined, 12000) });
  expect(kinds(before, after, { ...saved, distance_m: 2000, avg_split_s: 98 })).toEqual([
    'split-2k',
    'longest-streak',
    'best-week',
  ]);
});

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (id: string) => values.get(id) ?? null,
    setItem: (id: string, value: string) => {
      values.set(id, value);
    },
  };
}
const best: Achievement = {
  kind: 'best-week',
  title: 'New Best Week',
  value: 42000,
  week: saved.week_start,
};
const target: Achievement = { ...best, kind: 'target-hit', title: 'Target Hit' };
const streak: Achievement = { ...best, kind: 'streak', title: '2-Week Streak', value: 2 };
it('queues only one achievement, with target hit above ordinary streaks and below bests', () => {
  const store = storage();
  expect(recordCelebration(me.id, [streak], target, store)?.kind).toBe('target-hit');
  expect(pendingCelebration(me.id)).toBeUndefined();
  expect(recordCelebration('other', [streak, best], target, store)?.kind).toBe('best-week');
  expect(pendingCelebration('other')).toEqual(best);
  clearCelebration('other');
});
it('deduplicates all detected milestones per user/week, including hidden lower priorities', () => {
  const store = storage();
  expect(recordCelebration(me.id, [best, streak], target, store)).toEqual(best);
  expect(
    recordCelebration(
      me.id,
      [
        { ...best, value: 50000 },
        { ...streak, kind: 'longest-streak' },
      ],
      target,
      store,
    ),
  ).toBeUndefined();
  expect(recordCelebration('other', [best], undefined, store)).toEqual(best);
  clearCelebration('other');
  expect(recordCelebration(me.id, [{ ...best, week: '2026-11-09' }], undefined, store)?.kind).toBe(
    'best-week',
  );
});
it('deduplicates split re-saves per entry and fails closed for denied storage', () => {
  const split: Achievement = { ...best, kind: 'split-2k', entry: 'entry', value: 98 };
  const store = storage();
  expect(recordCelebration(me.id, [split], undefined, store)).toEqual(split);
  expect(recordCelebration(me.id, [split], undefined, store)).toBeUndefined();
  expect(recordCelebration(me.id, [], undefined, store)).toBeUndefined();
  for (const denied of [
    {
      getItem: () => {
        throw Error();
      },
      setItem: () => {},
    },
    {
      getItem: () => null,
      setItem: () => {
        throw Error();
      },
    },
  ])
    expect(recordCelebration(me.id, [best], undefined, denied)).toBeUndefined();
  expect(pendingCelebration(me.id)).toBeUndefined();
});
