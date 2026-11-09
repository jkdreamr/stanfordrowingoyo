import type {
  ExamplePlan,
  GroupKey,
  Plan,
  PlanSlot,
  PlanTotal,
  TeamPlan,
} from '../../../../shared/types';
import { addDays, today, weekStart } from '../../../../shared/dates';
import { ZONES } from '../../../../shared/math';
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const SLOTS = ['AM', 'PM1', 'PM2'] as const;
export function slotDisplayText({ kind, text }: Pick<PlanSlot, 'kind' | 'text'>) {
  const prefix = kind === 'team' ? /^team\b\s*/i : kind === 'oyo' ? /^oyo\b\s*/i : null;
  const stripped = prefix ? text.replace(prefix, '') : text;
  return stripped.trim() ? stripped : text;
}
export function weekLabel(date: string) {
  return (
    'Week of ' +
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Los_Angeles',
    }).format(new Date(date + 'T12:00:00Z'))
  );
}
export function slotLabel(slot: PlanSlot['slot'], hasPM2: boolean) {
  return slot === 'PM1' && !hasPM2 ? 'PM' : slot;
}
export interface ScheduleWeek {
  week?: 1 | 2;
  week_start?: string;
  total?: string | null;
  days: { name: string; date?: string; slots: PlanSlot[]; off: boolean }[];
}
export function scheduleWeek(plan: Plan | TeamPlan): ScheduleWeek {
  return {
    week_start: plan.week_start,
    total: 'total' in plan ? plan.total : plan.totals[0]?.label,
    days: DAYS.map((name, day) => {
      const sessions = plan.slots
        .filter((row) => row.day === day)
        .sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
      return {
        name,
        date: addDays(plan.week_start, day),
        slots: sessions,
        off: sessions.every((row) => row.kind === 'off'),
      };
    }),
  };
}
export function scheduleWeeks(plan: ExamplePlan, group?: GroupKey): ScheduleWeek[] {
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
export function replaceSlot(plan: Plan, slot: PlanSlot): Plan {
  const matches = (row: PlanSlot) => row.day === slot.day && row.slot === slot.slot;
  return {
    ...plan,
    slots: plan.slots.some(matches)
      ? plan.slots.map((row) => (matches(row) ? slot : row))
      : [...plan.slots, slot],
  };
}
export function replaceTotal(plan: Plan, total: PlanTotal): Plan {
  return { ...plan, totals: [total] };
}
export function planError(plan: Plan, date = today()) {
  const parsed = new Date(plan.week_start + 'T12:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(plan.week_start) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== plan.week_start ||
    weekStart(plan.week_start) !== plan.week_start ||
    plan.week_start < '2000-01-01' ||
    plan.week_start > addDays(date, 365)
  )
    return 'Choose a Monday between 2000 and one year from today.';
  if (
    plan.slots.some(
      (row) =>
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
  if (plan.totals.length > 1 || plan.totals.some((row) => row.label.length > 200))
    return 'Use at most one week total label of no more than 200 characters.';
  if (new Set(plan.slots.map((row) => [row.day, row.slot].join('/'))).size !== plan.slots.length)
    return 'The plan contains duplicate session keys.';
  return '';
}
