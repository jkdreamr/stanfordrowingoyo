import type { Plan, PlanSlot } from '../../../../shared/types';
export function slotDisplayText({ kind, text }: Pick<PlanSlot, 'kind' | 'text'>) {
  const prefix = kind === 'team' ? /^team\b\s*/i : kind === 'oyo' ? /^oyo\b\s*/i : null;
  const stripped = prefix ? text.replace(prefix, '') : text;
  return stripped.trim() ? stripped : text;
}
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const SLOTS = ['AM', 'PM1', 'PM2'] as const;
export function scheduleWeeks(plan: Plan) {
  return ([1, 2] as const).map((week) => ({
    week,
    total: plan.totals.find((t) => t.week === week)?.label,
    days: DAYS.map((name, day) => {
      const slots = plan.slots
        .filter((s) => s.week === week && s.day === day && s.kind !== 'off')
        .sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
      return { name, slots, off: slots.length === 0 };
    }),
  }));
}
