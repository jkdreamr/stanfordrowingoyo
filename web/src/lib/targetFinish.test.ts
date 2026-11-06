import { expect, it } from 'vitest';
import type { WeekStats } from '../../../shared/types';
import { clearTargetFinish, pendingTargetFinish, recordTargetFinish } from './targetFinish';
const week = { week_start: '2026-11-02', target_m: 80000, total_m: 70000 } as WeekStats;
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
it('acknowledges a confirmed crossing once per user/week without storing totals', () => {
  const saved = storage();
  const next = { ...week, total_m: 81000 };
  expect(recordTargetFinish(week, next, 'rower', week.week_start, saved)).toBe(true);
  expect(pendingTargetFinish('rower', week.week_start)).toEqual({ previous: 70000, target: 80000 });
  expect(saved.getItem('oyo-target-hit:rower:2026-11-02')).toBe('1');
  expect(recordTargetFinish(week, next, 'rower', week.week_start, saved)).toBe(false);
  clearTargetFinish('rower', week.week_start);
  expect(pendingTargetFinish('rower', week.week_start)).toBeUndefined();
});
it('ignores absent snapshots, non-crossings, changed targets, historical entries and denied storage', () => {
  const next = { ...week, total_m: 81000 };
  const saved = storage();
  for (const [previous, current, entryWeek] of [
    [null, next, week.week_start],
    [week, week, week.week_start],
    [{ ...week, target_m: 90000 }, next, week.week_start],
    [week, next, '2026-10-26'],
    [{ ...week, week_start: '2026-10-26' }, next, week.week_start],
    [next, next, week.week_start],
    [week, { ...next, target_m: 0 }, week.week_start],
  ] as const)
    expect(recordTargetFinish(previous, current, 'other', entryWeek, saved)).toBe(false);
  expect(
    recordTargetFinish(week, next, 'other', week.week_start, {
      getItem: () => {
        throw new Error('Denied');
      },
      setItem: () => {},
    }),
  ).toBe(false);
  expect(pendingTargetFinish('other', week.week_start)).toBeUndefined();
});
