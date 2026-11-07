import { addDays, weekStart, today, yearRange } from '../../../shared/dates';
import type { Entry, WeeklyRecap } from '../../../shared/types';
import type { Row } from '../db/row';
import { weekSummary, streak, totals } from '../db/stats';
import { loadTargets } from '../db/targets';
import type { Context } from '../context';
import { requireUser } from '../auth/guards';
import { byId } from '../db/users';
import { currentSeason, leaderboard as getLeaderboard, seasonStats, weekStats } from '../db/stats';
import { getSetting } from '../db/settings';
import { seasonRange } from '../../../shared/dates';
import { HttpError, json } from '../http';
import * as v from '../validate';
function subject(ctx: Context) {
  const viewer = requireUser(ctx);
  const id = new URL(ctx.request.url).searchParams.get('user') ?? viewer.id;
  const user = byId(ctx.storage, id);
  if (!user || !user.active) throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  return user;
}
export function recap(ctx: Context) {
  const user = requireUser(ctx);
  const current = weekStart(today(ctx.now));
  const value = new URL(ctx.request.url).searchParams.get('week');
  const week = weekStart(value === null ? addDays(current, -7) : v.weekDate(value, ctx.now));
  if (week >= current) v.invalid('Recaps are only available for completed weeks.');
  const entries = ctx.storage.sql
    .exec<Row<Entry>>(
      'SELECT * FROM entries WHERE user_id=? AND week_start=? ORDER BY equiv_m DESC,created_at,id',
      user.id,
      week,
    )
    .toArray();
  const summary = weekSummary(ctx.storage, user, week, entries);
  const aggregates = ctx.storage.sql
    .exec<{ week_start: string; total_m: number }>(
      'SELECT week_start,SUM(equiv_m) AS total_m FROM entries WHERE user_id=? AND week_start<=? GROUP BY week_start ORDER BY week_start',
      user.id,
      week,
    )
    .toArray();
  const targets = loadTargets(ctx.storage, user.id);
  const byWeek = new Map(aggregates.map((row) => [row.week_start, row.total_m]));
  const weeks = [];
  for (let date = week; date >= '2000-01-01'; date = addDays(date, -7)) {
    const total = byWeek.get(date) ?? 0;
    const target = targets(user, date).target_m;
    if (target <= 0 || total < target) break;
    weeks.unshift({
      ...summary,
      ...totals([]),
      week_start: date,
      total_m: total,
      hit_target: true,
    });
  }
  const board = getLeaderboard(ctx.storage, week, 'percent', ctx.now);
  const result: WeeklyRecap = {
    ...summary,
    entry_count: entries.length,
    streak: streak(weeks, week),
    best_effort: entries[0] ?? null,
    team: {
      total_m: board.reduce((n, row) => n + row.total_m, 0),
      entry_count: board.reduce((n, row) => n + row.entry_count, 0),
      rowers: board.length,
      rowers_hit_target: board.filter((row) => row.target_m > 0 && row.total_m >= row.target_m)
        .length,
    },
    rank: board.find((row) => row.user.id === user.id)?.rank ?? null,
  };
  return json(result);
}
function selectedDate(ctx: Context) {
  const value = new URL(ctx.request.url).searchParams.get('week');
  return v.weekDate(value ?? today(ctx.now), ctx.now);
}
export function week(ctx: Context) {
  return json(
    weekStats(ctx.storage, subject(ctx), weekStart(selectedDate(ctx)), requireUser(ctx).id),
  );
}
export function season(ctx: Context) {
  const user = subject(ctx);
  const params = new URL(ctx.request.url).searchParams;
  if (params.has('season') && params.has('year'))
    v.invalid('Choose either season or year, not both.');
  const year = params.get('year') ?? params.get('season');
  let range = currentSeason(ctx.storage, ctx.now);
  if (year !== null) {
    if (!/^\d{4}$/.test(year)) v.invalid('Year must be a four-digit year.');
    const value = v.int(Number(year), 'Year', 2020, 2100);
    range = params.has('year')
      ? yearRange(value)
      : seasonRange(
          `${value}-${getSetting<string>(ctx.storage, 'season_start')}`,
          getSetting<string>(ctx.storage, 'season_start'),
        );
  }
  return json(seasonStats(ctx.storage, user, range, ctx.now, requireUser(ctx).id));
}
export function leaderboard(ctx: Context) {
  requireUser(ctx);
  const metric = v.enumeration(
    new URL(ctx.request.url).searchParams.get('metric') ?? 'percent',
    ['percent', 'meters', 'season'],
    'Metric',
  );
  return json(getLeaderboard(ctx.storage, selectedDate(ctx), metric, ctx.now));
}
