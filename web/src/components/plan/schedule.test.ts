import { describe, expect, it } from 'vitest';
import type { Plan, PlanSlot } from '../../../../shared/types';
import { planError, planWeek, replaceSlot, replaceTotal, slotDisplayText } from './schedule';
const slot: PlanSlot = {
  group_key: 'normal',
  week: 1,
  day: 0,
  slot: 'AM',
  kind: 'team',
  zone: null,
  text: 'Team Morning Row',
};
describe('whole-plan editing and preview', () => {
  it('replaces only a keyed slot or total and does not mutate or lose other groups or weeks', () => {
    const plan: Plan = {
      slots: [slot, { ...slot, group_key: 'frosh' }, { ...slot, week: 2 }],
      totals: [
        { group_key: 'normal', week: 1, label: 'Old' },
        { group_key: 'u23', week: 2, label: 'Keep' },
      ],
    };
    const original = structuredClone(plan);
    const changed = replaceSlot(plan, { ...slot, text: 'New Workout' });
    expect(changed.slots).toHaveLength(3);
    expect(changed.slots.filter((row) => row.text === 'Team Morning Row')).toHaveLength(2);
    expect(changed.slots[0].text).toBe('New Workout');
    expect(replaceTotal(changed, { group_key: 'normal', week: 1, label: '80 km' }).totals).toEqual([
      { group_key: 'normal', week: 1, label: '80 km' },
      { group_key: 'u23', week: 2, label: 'Keep' },
    ]);
    expect(replaceSlot({ slots: [], totals: [] }, slot).slots).toEqual([slot]);
    expect(plan).toEqual(original);
    expect(replaceSlot(plan, { ...slot })).toEqual(plan);
    expect(replaceTotal(plan, { ...plan.totals[0] })).toEqual(plan);
  });
  it('filters preview by group and week, orders slots and treats absent/off slots as off', () => {
    const data = planWeek(
      {
        slots: [
          { ...slot, slot: 'PM2', kind: 'oyo', zone: 'E' },
          slot,
          { ...slot, day: 1, kind: 'off' },
          { ...slot, group_key: 'frosh' },
          { ...slot, week: 2 },
        ],
        totals: [
          { group_key: 'normal', week: 1, label: '80 km' },
          { group_key: 'frosh', week: 1, label: '60 km' },
        ],
      },
      'normal',
      1,
    );
    expect(data.total).toBe('80 km');
    expect(data.days[0].slots.map((row) => row.slot)).toEqual(['AM', 'PM2']);
    expect(data.days.slice(1).every((day) => day.off)).toBe(true);
    expect(planWeek({ slots: [], totals: [] }, 'u23', 2).days).toHaveLength(7);
  });
  it('matches rower branch prefix stripping while preserving useful text', () => {
    expect(slotDisplayText(slot)).toBe('Morning Row');
    expect(slotDisplayText({ kind: 'oyo', text: 'OYO 12k Steady State' })).toBe('12k Steady State');
    expect(slotDisplayText({ kind: 'team', text: 'Team' })).toBe('Team');
    expect(slotDisplayText({ kind: 'off', text: '' })).toBe('');
  });
  it('validates empty plans, backend bounds and duplicate keys', () => {
    expect(planError({ slots: [], totals: [] })).toBe('');
    expect(
      planError({
        slots: [{ ...slot, text: 'x'.repeat(2000) }],
        totals: [{ group_key: 'u23', week: 2, label: 'x'.repeat(200) }],
      }),
    ).toBe('');
    for (const changed of [
      { ...slot, day: 7 },
      { ...slot, day: 1.5 },
      { ...slot, text: 'x'.repeat(2001) },
      { ...slot, zone: 'invalid' as PlanSlot['zone'] },
    ])
      expect(planError({ slots: [changed], totals: [] })).not.toBe('');
    expect(planError({ slots: [slot, slot], totals: [] })).toContain('duplicate');
    expect(
      planError({ slots: [], totals: [{ group_key: 'normal', week: 1, label: 'x'.repeat(201) }] }),
    ).not.toBe('');
    expect(
      planError({
        slots: [],
        totals: [
          { group_key: 'normal', week: 1, label: '' },
          { group_key: 'normal', week: 1, label: 'duplicate' },
        ],
      }),
    ).toContain('duplicate');
  });
});
