import type { PlanSlot, PlanTotal } from '../../../shared/types';
import { ZONES } from '../../../shared/math';
import type { Context } from '../context';
import { refreshUser, requireStaff, requireUser } from '../auth/guards';
import { getPlan, replacePlan, saveSlot } from '../db/plan';
import { audit } from '../db/audit';
import { HttpError, json, noContent, readJson } from '../http';
import * as v from '../validate';
const groups = ['frosh', 'normal', 'u23'] as const;
function slot(value: unknown): PlanSlot {
  const row = v.object(value, 'Slot');
  return {
    group_key: v.enumeration(row.group_key, groups, 'Group'),
    week: v.int(row.week, 'Week', 1, 2) as 1 | 2,
    day: v.int(row.day, 'Day', 0, 6),
    slot: v.enumeration(row.slot, ['AM', 'PM1', 'PM2'], 'Slot'),
    kind: v.enumeration(row.kind, ['team', 'oyo', 'off'], 'Kind'),
    zone: v.nullable(row.zone, (x) => v.enumeration(x, ZONES, 'Zone')),
    text: v.string(row.text, 'Text', 0, 2000),
  };
}
function total(value: unknown): PlanTotal {
  const row = v.object(value, 'Total');
  return {
    group_key: v.enumeration(row.group_key, groups, 'Group'),
    week: v.int(row.week, 'Week', 1, 2) as 1 | 2,
    label: v.string(row.label, 'Label', 0, 200),
  };
}
export function get(ctx: Context) {
  const user = requireUser(ctx);
  const group = v.enumeration(
    new URL(ctx.request.url).searchParams.get('group') ?? user.group_key,
    groups,
    'Group',
  );
  return json(getPlan(ctx.storage, group));
}
export function adminGet(ctx: Context) {
  requireStaff(ctx);
  return json(getPlan(ctx.storage));
}
export async function put(ctx: Context) {
  const body = await readJson(ctx.request);
  refreshUser(ctx);
  requireStaff(ctx);
  if (!Array.isArray(body.slots) || !Array.isArray(body.totals))
    v.invalid('Plan must contain slots and totals arrays.');
  const slots = (body.slots as unknown[]).map(slot);
  const totals = (body.totals as unknown[]).map(total);
  if (
    new Set(slots.map((row) => [row.group_key, row.week, row.day, row.slot].join('|'))).size !==
      slots.length ||
    new Set(totals.map((row) => [row.group_key, row.week].join('|'))).size !== totals.length
  )
    v.invalid('Plan contains duplicate keys.');
  const before = getPlan(ctx.storage);
  ctx.storage.transactionSync(() => {
    replacePlan(ctx.storage, { slots, totals });
    audit(ctx, 'plan.replace', 'plan', before, { slots, totals });
  });
  return json(getPlan(ctx.storage));
}
export async function post(ctx: Context) {
  const body = await readJson(ctx.request);
  refreshUser(ctx);
  requireStaff(ctx);
  const row = slot(body);
  const before = getPlan(ctx.storage).slots.find(
    (item) =>
      item.group_key === row.group_key &&
      item.week === row.week &&
      item.day === row.day &&
      item.slot === row.slot,
  );
  ctx.storage.transactionSync(() => {
    saveSlot(ctx.storage, row);
    audit(
      ctx,
      'plan.upsert',
      [row.group_key, row.week, row.day, row.slot].join('/'),
      before ?? null,
      row,
    );
  });
  return json(row, 201);
}
export function remove(ctx: Context) {
  requireStaff(ctx);
  const group = v.enumeration(ctx.params.group, groups, 'Group');
  if (!/^[12]$/.test(ctx.params.week) || !/^[0-6]$/.test(ctx.params.day))
    v.invalid('Plan key is invalid.');
  const week = Number(ctx.params.week);
  const day = Number(ctx.params.day);
  const key = v.enumeration(ctx.params.slot, ['AM', 'PM1', 'PM2'], 'Slot');
  const before = getPlan(ctx.storage).slots.find(
    (row) => row.group_key === group && row.week === week && row.day === day && row.slot === key,
  );
  if (!before) throw new HttpError(404, 'NOT_FOUND', 'Plan slot not found.');
  ctx.storage.transactionSync(() => {
    ctx.storage.sql.exec(
      'DELETE FROM plan_slots WHERE group_key = ? AND week = ? AND day = ? AND slot = ?',
      group,
      week,
      day,
      key,
    );
    audit(ctx, 'plan.delete', [group, week, day, key].join('/'), before, null);
  });
  return noContent();
}
