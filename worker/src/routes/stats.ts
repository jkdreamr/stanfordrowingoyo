import { weekStart, today, yearRange } from '../../../shared/dates';
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
