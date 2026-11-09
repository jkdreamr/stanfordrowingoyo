import { describe, expect, it } from 'vitest';
import type { Plan, PlanSlot } from '../../../../shared/types';
import { TEAM_PLAN_SEED_SLOTS } from '../../../../shared/teamPlan';
import {
  planError,
  scheduleWeek,
  replaceSlot,
  replaceTotal,
  slotLabel,
  weekLabel,
} from './schedule';
const slot: PlanSlot = {
  day: 0,
  slot: 'AM',
  kind: 'oyo',
  zone: null,
  text: 'First line\nSecond line',
};
const empty: Plan = { week_start: '2026-11-09', slots: [], totals: [] };
const error = (plan: Plan) => planError(plan, '2026-11-09');
describe('dated team-plan editing and preview', () => {
  it('replaces only a keyed slot or the single total without mutation', () => {
    const plan: Plan = { ...empty, slots: [slot, { ...slot, day: 1 }], totals: [{ label: 'Old' }] };
    const original = structuredClone(plan);
    const changed = replaceSlot(plan, { ...slot, text: 'New' });
    expect(changed.slots.map((row) => row.text)).toEqual(['New', slot.text]);
    expect(replaceTotal(changed, { label: '80 km' }).totals).toEqual([{ label: '80 km' }]);
    expect(replaceSlot(empty, slot).slots).toEqual([slot]);
    expect(plan).toEqual(original);
    expect(replaceSlot(plan, { ...slot })).toEqual(plan);
  });
  it('orders all kinds of slots with dates, null zones and preserved newlines', () => {
    const week = scheduleWeek({ ...empty, slots: [...TEAM_PLAN_SEED_SLOTS].reverse() });
    expect(week.days[0].date).toBe('2026-11-09');
    expect(week.days[6].date).toBe('2026-11-15');
    expect(week.days[0].slots.map((row) => row.slot)).toEqual(['AM', 'PM1']);
    expect(week.days[6].slots.map((row) => row.text)).toEqual(['OFF', 'OFF']);
    expect(week.days[2].slots.every((row) => row.kind === 'oyo' && row.zone === null)).toBe(true);
    expect(scheduleWeek(empty).days.every((day) => day.off)).toBe(true);
    expect(slotLabel('PM1', false)).toBe('PM');
    expect(slotLabel('PM1', true)).toBe('PM1');
    expect(weekLabel(empty.week_start)).toBe('Week of Nov 9');
  });
  it('matches server bounds and accepts empty weeks, null-zone OYO, multiline text and maximum lengths', () => {
    expect(error(empty)).toBe('');
    expect(error({ ...empty, slots: [slot] })).toBe('');
    expect(
      error({
        ...empty,
        slots: [{ ...slot, text: 'x'.repeat(2000) }],
        totals: [{ label: 'x'.repeat(200) }],
      }),
    ).toBe('');
    for (const changed of [
      { ...slot, day: 7 },
      { ...slot, day: 1.5 },
      { ...slot, text: 'x'.repeat(2001) },
      { ...slot, zone: 'invalid' as PlanSlot['zone'] },
      { ...slot, slot: 'bad' as PlanSlot['slot'] },
      { ...slot, kind: 'bad' as PlanSlot['kind'] },
    ])
      expect(error({ ...empty, slots: [changed] })).not.toBe('');
    expect(error({ ...empty, slots: [slot, slot] })).toContain('duplicate');
    expect(error({ ...empty, totals: [{ label: 'x'.repeat(201) }] })).not.toBe('');
    expect(error({ ...empty, totals: [{ label: '' }, { label: '' }] })).not.toBe('');
    for (const week_start of ['2026-11-10', '2026-02-30', '1999-12-27', '2027-11-15', 'invalid'])
      expect(error({ ...empty, week_start })).not.toBe('');
  });
});
