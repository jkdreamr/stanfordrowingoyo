import { addDays, seasonRange, today, weekStart, type DateRange } from '../../../shared/dates';
import { ZONES } from '../../../shared/math';
import type {
  Entry,
  LeaderboardRow,
  SeasonStats,
  Totals,
  User,
  WeekStats,
  WeekSummary,
} from '../../../shared/types';
import { userEntries, details } from './entries';
import { effectiveTarget } from './targets';
import { getSetting } from './settings';
import { toPublicUser, type UserRow } from './users';
export function totals(entries: Entry[]): Totals {
  const result: Totals = {
    total_m: 0,
    by_modality: { erg: 0, bike: 0, run: 0 },
    by_zone: Object.fromEntries(ZONES.map((zone) => [zone, 0])) as Totals['by_zone'],
  };
  for (const entry of entries) {
    result.total_m += entry.equiv_m;
    result.by_modality[entry.modality] += entry.equiv_m;
    result.by_zone[entry.zone] += entry.equiv_m;
  }
  return result;
}
type TargetUser = Pick<User, 'id' | 'group_key'>;
export function weekSummary(
  storage: DurableObjectStorage,
  user: TargetUser,
  week: string,
  entries: Entry[],
): WeekSummary {
  const total = totals(entries.filter((entry) => entry.week_start === week));
  const target = effectiveTarget(storage, user, week).target_m;
  return {
    ...total,
    week_start: week,
    target_m: target,
    percent: target > 0 ? Math.round((total.total_m / target) * 1000) / 10 : 0,
    hit_target: target > 0 && total.total_m >= target,
  };
}
export function weekStats(
  storage: DurableObjectStorage,
  user: TargetUser,
  week: string,
  viewer: string,
): WeekStats {
  const entries = userEntries(storage, user.id, week, addDays(week, 6));
  return {
    ...weekSummary(storage, user, week, entries),
    by_day: Array.from({ length: 7 }, (_, i) => {
      const date = addDays(week, i);
      return {
        date,
        equiv_m: entries
          .filter((entry) => entry.date === date)
          .reduce((sum, entry) => sum + entry.equiv_m, 0),
      };
    }),
    entries: details(
      storage,
      entries.filter((entry) => entry.visibility === 'team' || entry.user_id === viewer),
      viewer,
    ),
  };
}
export function streak(weeks: WeekSummary[], currentWeek: string): number {
  let i = weeks.length - 1;
  let count = 0;
  if (weeks[i]?.week_start === currentWeek && !weeks[i].hit_target) i--;
  while (i >= 0 && weeks[i].hit_target) {
    count++;
    i--;
  }
  return count;
}
export function seasonStats(
  storage: DurableObjectStorage,
  user: TargetUser,
  range: DateRange,
  now: Date,
  through = today(now),
): SeasonStats {
  const lastDate = range.end < through ? range.end : through;
  const entries =
    lastDate >= range.start
      ? userEntries(storage, user.id, weekStart(range.start), addDays(weekStart(lastDate), 6))
      : [];
  const weeks: WeekSummary[] = [];
  if (lastDate >= range.start)
    for (let week = weekStart(range.start); week <= weekStart(lastDate); week = addDays(week, 7))
      weeks.push(weekSummary(storage, user, week, entries));
  const best = weeks.reduce<WeekSummary | null>(
    (best, week) => (week.total_m > (best?.total_m ?? 0) ? week : best),
    null,
  );
  return {
    ...totals(entries.filter((entry) => entry.date >= range.start && entry.date <= lastDate)),
    start: range.start,
    end: range.end,
    weeks,
    streak: streak(weeks, weekStart(today(now))),
    best_week: best,
  };
}
export function currentSeason(storage: DurableObjectStorage, now: Date) {
  return seasonRange(today(now), getSetting<string>(storage, 'season_start'));
}
export function leaderboard(
  storage: DurableObjectStorage,
  week: string,
  metric: 'percent' | 'meters' | 'season',
  now: Date,
  subjects?: UserRow[],
): LeaderboardRow[] {
  const users =
    subjects ??
    storage.sql
      .exec<UserRow>('SELECT * FROM users WHERE active = ? AND on_leaderboard = ?', 1, 1)
      .toArray();
  const range = seasonRange(week, getSetting<string>(storage, 'season_start'));
  const rows = users.map((user) => {
    const season = seasonStats(storage, user, range, now, addDays(week, 6));
    const weekly =
      season.weeks.find((row) => row.week_start === week) ??
      weekSummary(storage, user, week, userEntries(storage, user.id, week, addDays(week, 6)));
    const target =
      metric === 'season'
        ? season.weeks.reduce((sum, row) => sum + row.target_m, 0)
        : weekly.target_m;
    const total = metric === 'season' ? season.total_m : weekly.total_m;
    return {
      user: toPublicUser(user),
      target_m: target,
      total_m: total,
      percent: target > 0 ? Math.round((total / target) * 1000) / 10 : 0,
      rank: 0,
      streak: season.streak,
      entry_count: userEntries(storage, user.id, week, addDays(week, 6)).length,
    };
  });
  const compareScore = (a: LeaderboardRow, b: LeaderboardRow) =>
    (metric === 'percent' ? b.percent - a.percent : 0) || b.total_m - a.total_m;
  rows.sort(
    (a, b) =>
      compareScore(a, b) ||
      a.user.name.localeCompare(b.user.name) ||
      a.user.id.localeCompare(b.user.id),
  );
  rows.forEach((row, i) => {
    row.rank = i > 0 && compareScore(rows[i - 1], row) === 0 ? rows[i - 1].rank : i + 1;
  });
  return rows;
}
