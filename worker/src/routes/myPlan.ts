import type { MyPlanInput } from '../../../shared/types';
import { today, weekStart } from '../../../shared/dates';
import { ZONES } from '../../../shared/math';
import type { Context } from '../context';
import { requireUser, refreshUser } from '../auth/guards';
import { getMyPlan, replaceMyPlan, deleteMyPlan } from '../db/myPlan';
import { json, noContent, readJson } from '../http';
import * as v from '../validate';

function monday(value: unknown) {
  const date = v.date(value);
  if (weekStart(date) !== date) v.invalid('Start date must be a Monday.');
  return date;
}
function ownQuery(ctx: Context) {
  const query = new URL(ctx.request.url).searchParams;
  if (query.has('user')) v.invalid('Personal plans do not accept a user parameter.');
  return query;
}
function input(body: Record<string, unknown>): MyPlanInput {
  const start_date = monday(body.start_date);
  if (!Array.isArray(body.sessions) || body.sessions.length > 42)
    v.invalid('Sessions must be an array of at most 42 items.');
  if (!Array.isArray(body.rest_days) || body.rest_days.length > 14)
    v.invalid('Rest days must be an array of at most 14 items.');
  const sessions = body.sessions.map((value) => {
    const row = v.object(value, 'Session');
    return {
      week: v.int(row.week, 'Week', 1, 2) as 1 | 2,
      day: v.int(row.day, 'Day', 0, 6),
      slot: v.enumeration(row.slot, ['AM', 'PM1', 'PM2'], 'Slot'),
      modality: v.enumeration(row.modality, ['erg', 'bike', 'run'], 'Modality'),
      zone: v.enumeration(row.zone, ZONES, 'Zone'),
      distance_m: v.nullable(row.distance_m, (value) => v.int(value, 'Distance', 1, 200000)),
      note: v.string(row.note, 'Note', 0, 200, true),
    };
  });
  const rest_days = body.rest_days.map((value) => {
    const row = v.object(value, 'Rest day');
    return { week: v.int(row.week, 'Week', 1, 2) as 1 | 2, day: v.int(row.day, 'Day', 0, 6) };
  });
  const rest = new Set(rest_days.map((row) => `${row.week}|${row.day}`));
  if (
    rest.size !== rest_days.length ||
    new Set(sessions.map((row) => `${row.week}|${row.day}|${row.slot}`)).size !== sessions.length
  )
    v.invalid('Personal plan contains duplicate keys.');
  if (sessions.some((row) => rest.has(`${row.week}|${row.day}`)))
    v.invalid('Sessions cannot be scheduled on rest days.');
  return { start_date, sessions, rest_days };
}
export function get(ctx: Context) {
  const user = requireUser(ctx);
  const query = ownQuery(ctx);
  const date = query.has('date') ? v.date(query.get('date')) : today(ctx.now);
  return json(getMyPlan(ctx.storage, user.id, date));
}
export async function put(ctx: Context) {
  ownQuery(ctx);
  const body = await readJson(ctx.request);
  const user = refreshUser(ctx);
  const plan = input(body);
  replaceMyPlan(ctx.storage, user.id, plan, ctx.now.toISOString());
  return json(getMyPlan(ctx.storage, user.id, plan.start_date));
}
export function remove(ctx: Context) {
  const user = requireUser(ctx);
  ownQuery(ctx);
  deleteMyPlan(ctx.storage, user.id, monday(ctx.params.start));
  return noContent();
}
