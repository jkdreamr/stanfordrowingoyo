import type { GroupKey, Plan, PlanSlot, PlanTotal } from '../../../../shared/types';
import { ZONES } from '../../../../shared/math';
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const SLOTS = ['AM', 'PM1', 'PM2'] as const;
export function slotDisplayText({ kind, text }: Pick<PlanSlot, 'kind' | 'text'>) {
  const prefix = kind === 'team' ? /^team\b\s*/i : kind === 'oyo' ? /^oyo\b\s*/i : null;
  const stripped = prefix ? text.replace(prefix, '') : text;
  return stripped.trim() ? stripped : text;
}
export function scheduleWeeks(plan: Plan, group?: GroupKey) {
  const slots = group ? plan.slots.filter((row) => row.group_key === group) : plan.slots;
  const totals = group ? plan.totals.filter((row) => row.group_key === group) : plan.totals;
  return ([1, 2] as const).map((week) => ({
    week,
    total: totals.find((row) => row.week === week)?.label,
    days: DAYS.map((name, day) => {
      const sessions = slots
        .filter((row) => row.week === week && row.day === day && row.kind !== 'off')
        .sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
      return { name, slots: sessions, off: sessions.length === 0 };
    }),
  }));
}
export type ScheduleWeek = ReturnType<typeof scheduleWeeks>[number];
export function replaceSlot(plan: Plan, slot: PlanSlot): Plan {
  const matches = (row: PlanSlot) =>
    row.group_key === slot.group_key &&
    row.week === slot.week &&
    row.day === slot.day &&
    row.slot === slot.slot;
  return {
    ...plan,
    slots: plan.slots.some(matches)
      ? plan.slots.map((row) => (matches(row) ? slot : row))
      : [...plan.slots, slot],
  };
}
export function replaceTotal(plan: Plan, total: PlanTotal): Plan {
  const matches = (row: PlanTotal) => row.group_key === total.group_key && row.week === total.week;
  return {
    ...plan,
    totals: plan.totals.some(matches)
      ? plan.totals.map((row) => (matches(row) ? total : row))
      : [...plan.totals, total],
  };
}
export function planError(plan: Plan) {
  if (
    plan.slots.some(
      (row) =>
        !['frosh', 'normal', 'u23'].includes(row.group_key) ||
        ![1, 2].includes(row.week) ||
        !Number.isInteger(row.day) ||
        row.day < 0 ||
        row.day > 6 ||
        !SLOTS.includes(row.slot) ||
        !['team', 'oyo', 'off'].includes(row.kind) ||
        (row.zone !== null && !ZONES.includes(row.zone)) ||
        row.text.length > 2000,
    )
  )
    return 'Each session must have a valid key and no more than 2,000 characters.';
  if (
    plan.totals.some(
      (row) =>
        !['frosh', 'normal', 'u23'].includes(row.group_key) ||
        ![1, 2].includes(row.week) ||
        row.label.length > 200,
    )
  )
    return 'Week total labels must be no more than 200 characters.';
  if (
    new Set(plan.slots.map((row) => [row.group_key, row.week, row.day, row.slot].join('/')))
      .size !== plan.slots.length ||
    new Set(plan.totals.map((row) => [row.group_key, row.week].join('/'))).size !==
      plan.totals.length
  )
    return 'The plan contains duplicate session or total keys.';
  return '';
}
