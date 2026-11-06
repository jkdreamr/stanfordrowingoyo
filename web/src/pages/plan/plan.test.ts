import { expect, it } from 'vitest';
import { MODE_FACTORS, ZONE_FACTORS } from '../../../../shared/math';
import { PLAN_SLOTS, PLAN_TOTALS } from '../../../../shared/seed';
import type { Config } from '../../../../shared/types';
import { scheduleWeeks } from './schedule';
import { formulaFactor, targetDistance, zonePace } from './calculator';
const config = { mode_factors: MODE_FACTORS, zone_factors: ZONE_FACTORS } as Config;
it('groups seeded plans for every group, preserving week totals and slot order', () => {
  for (const group of ['frosh', 'normal', 'u23']) {
    const slots = PLAN_SLOTS.filter((s) => s.group_key === group);
    const totals = PLAN_TOTALS.filter((t) => t.group_key === group);
    const weeks = scheduleWeeks({ slots: [...slots].reverse(), totals });
    expect(weeks.map((w) => w.week)).toEqual([1, 2]);
    expect(weeks.map((w) => w.total)).toEqual(totals.map((t) => t.label));
    expect(weeks[0].days[0].slots.map((s) => s.slot)).toEqual(['AM', 'PM1']);
    expect(weeks[0].days[6].off).toBe(true);
    expect(weeks[0].days.map((d) => d.name)).toHaveLength(7);
  }
});
it('treats missing and explicit off days as off', () => {
  expect(scheduleWeeks({ slots: [], totals: [] }).every((w) => w.days.every((d) => d.off))).toBe(
    true,
  );
  const slot = { ...PLAN_SLOTS[0], kind: 'off' as const };
  expect(scheduleWeeks({ slots: [slot], totals: [] })[0].days[slot.day].off).toBe(true);
});
it('formats target distances with shared configurable math', () => {
  expect(targetDistance(10, 'bike', 'E', config)).toBe('30.0 km');
  expect(targetDistance(10, 'run', 'D', config)).toBe('5.93 km');
  expect(targetDistance(0, 'erg', 'E', config)).toBe('—');
  expect(targetDistance(NaN, 'erg', 'E', config)).toBe('—');
});
it('uses the 2k base for A and permits missing bases', () => {
  expect(zonePace('A', 120, 100)).toBe('1:40.0/500m');
  expect(zonePace('D', 120, null)).toBe('2:10.0/500m');
  expect(zonePace('A', 120, null)).toBe('—');
  expect(zonePace('E', null, 100)).toBe('—');
});
it('formats formula factors to at most three decimals with a decimal for integers', () => {
  expect(formulaFactor('erg', 'E', config)).toBe('× 1.0');
  expect(formulaFactor('erg', 'D/C', config)).toBe('× 1.6');
  expect(formulaFactor('bike', 'R', config)).toBe('× 0.267');
  expect(formulaFactor('bike', 'E', config)).toBe('× 0.333');
});
