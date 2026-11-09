import type { PlanSlot, PlanTotal } from '../../../shared/types';
import { weekStart, today } from '../../../shared/dates';
import { ZONES } from '../../../shared/math';
import type { Context } from '../context';
import { refreshUser, requireStaff, requireUser } from '../auth/guards';
import { getExamplePlan, getPlan, replacePlan } from '../db/plan';
import { audit } from '../db/audit';
import { json, readJson } from '../http';
import * as v from '../validate';

function week(value: unknown, ctx: Context) {
  const date = v.weekDate(value, ctx.now);
  if (weekStart(date) !== date) v.invalid('Week must be a Monday.');
  return date;
}
function requestedWeek(ctx: Context) {
  return week(new URL(ctx.request.url).searchParams.get('week') ?? weekStart(today(ctx.now)), ctx);
}
function slot(value: unknown): PlanSlot {
  const row = v.object(value, 'Slot');
  return {
    day: v.int(row.day, 'Day', 0, 6),
    slot: v.enumeration(row.slot, ['AM', 'PM1', 'PM2'], 'Slot'),
    kind: v.enumeration(row.kind, ['team', 'oyo', 'off'], 'Kind'),
    zone: v.nullable(row.zone, (x) => v.enumeration(x, ZONES, 'Zone')),
    text: v.string(row.text, 'Text', 0, 2000),
  };
}
function total(value: unknown): PlanTotal {
  const row = v.object(value, 'Total');
  return { label: v.string(row.label, 'Label', 0, 200) };
}
export function get(ctx: Context) {
  requireUser(ctx);
  const plan = getPlan(ctx.storage, requestedWeek(ctx));
  return json({
    week_start: plan.week_start,
    slots: plan.slots,
    total: plan.totals[0]?.label ?? null,
  });
}
export function example(ctx: Context) {
  const user = requireUser(ctx);
  const group = v.enumeration(
    new URL(ctx.request.url).searchParams.get('group') ?? user.group_key,
    ['frosh', 'normal', 'u23'],
    'Group',
  );
  return json(getExamplePlan(ctx.storage, group));
}
export function adminGet(ctx: Context) {
  requireStaff(ctx);
  return json(getPlan(ctx.storage, requestedWeek(ctx)));
}
export async function put(ctx: Context) {
  const body = await readJson(ctx.request);
  refreshUser(ctx);
  requireStaff(ctx);
  const week_start = week(body.week_start, ctx);
  const queryWeek = new URL(ctx.request.url).searchParams.get('week');
  if (queryWeek !== null && week(queryWeek, ctx) !== week_start)
    v.invalid('Query week must match week_start.');
  if (!Array.isArray(body.slots) || !Array.isArray(body.totals) || body.totals.length > 1)
    v.invalid('Plan must contain slots and at most one total.');
  const slots = (body.slots as unknown[]).map(slot);
  const totals = (body.totals as unknown[]).map(total);
  if (new Set(slots.map((row) => [row.day, row.slot].join('|'))).size !== slots.length)
    v.invalid('Plan contains duplicate keys.');
  const before = getPlan(ctx.storage, week_start);
  ctx.storage.transactionSync(() => {
    replacePlan(ctx.storage, { week_start, slots, totals });
    audit(ctx, 'plan.replace', `plan/${week_start}`, before, { week_start, slots, totals });
  });
  return json(getPlan(ctx.storage, week_start));
}
