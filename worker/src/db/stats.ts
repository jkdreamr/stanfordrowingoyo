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
import { effectiveTarget, loadTargets } from './targets';
import { getSetting } from './settings';
import { toPublicUser, type UserRow } from './users';
export function totals(entries: Pick<Entry, 'equiv_m' | 'modality' | 'zone'>[]): Totals {
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
type TargetLookup = ReturnType<typeof loadTargets>;
type EntryAggregate = Pick<
  Entry,
  'user_id' | 'date' | 'week_start' | 'modality' | 'zone' | 'equiv_m'
> & {
  entry_count: number;
};
function aggregateEntries(
  storage: DurableObjectStorage,
  start: string,
  end: string,
  userId?: string,
  viewer?: string,
) {
  const where = userId === undefined ? '' : ' AND user_id = ? AND (visibility != ? OR user_id = ?)';
  return storage.sql
    .exec<EntryAggregate>(
      `SELECT user_id,date,week_start,modality,zone,SUM(equiv_m) AS equiv_m,COUNT(*) AS entry_count FROM entries WHERE week_start >= ? AND week_start <= ?${where} GROUP BY user_id,week_start,date,modality,zone`,
      weekStart(start),
      weekStart(end),
      ...(userId === undefined ? [] : [userId, 'private', viewer!]),
    )
    .toArray();
}
function summarize(week: string, total: Totals, target: number): WeekSummary {
  return {
    ...total,
    week_start: week,
    target_m: target,
    percent: target > 0 ? Math.round((total.total_m / target) * 1000) / 10 : 0,
    hit_target: target > 0 && total.total_m >= target,
  };
}
function summaries(
  user: TargetUser,
  start: string,
  end: string,
  entries: EntryAggregate[],
  targets: TargetLookup,
) {
  const weekly = new Map<string, Totals>();
  for (const entry of entries) {
    const total = weekly.get(entry.week_start) ?? totals([]);
    total.total_m += entry.equiv_m;
    total.by_modality[entry.modality] += entry.equiv_m;
    total.by_zone[entry.zone] += entry.equiv_m;
    weekly.set(entry.week_start, total);
  }
  const weeks: WeekSummary[] = [];
  if (end >= start)
    for (let week = weekStart(start); week <= weekStart(end); week = addDays(week, 7))
      weeks.push(summarize(week, weekly.get(week) ?? totals([]), targets(user, week).target_m));
  return weeks;
}
export function weekSummary(
  storage: DurableObjectStorage,
  user: TargetUser,
  week: string,
  entries: Entry[],
): WeekSummary {
  const total = totals(entries.filter((entry) => entry.week_start === week));
  const target = effectiveTarget(storage, user, week).target_m;
  return summarize(week, total, target);
}
export function weekStats(
  storage: DurableObjectStorage,
  user: TargetUser,
  week: string,
  viewer: string,
): WeekStats {
  const entries = userEntries(storage, user.id, week, addDays(week, 6), viewer);
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
    entries: details(storage, entries, viewer),
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
  viewer: string,
  through = today(now),
): SeasonStats {
  const lastDate = range.end < through ? range.end : through;
  const targets = loadTargets(storage, user.id);
  const entries =
    lastDate >= range.start
      ? aggregateEntries(storage, range.start, lastDate, user.id, viewer)
      : [];
  const weeks = summaries(user, range.start, lastDate, entries, targets);
  const best = weeks.reduce<WeekSummary | null>(
    (best, week) => (week.total_m > (best?.total_m ?? 0) ? week : best),
    null,
  );
  return {
    ...totals(entries.filter((entry) => entry.date >= range.start && entry.date <= lastDate)),
    days: storage.sql
      .exec<{ date: string; equiv_m: number }>(
        'SELECT date,SUM(equiv_m) AS equiv_m FROM entries WHERE user_id = ? AND date >= ? AND date <= ? AND (visibility != ? OR user_id = ?) GROUP BY date HAVING SUM(equiv_m) > 0 ORDER BY date',
        user.id,
        range.start,
        lastDate,
        'private',
        viewer,
      )
      .toArray(),
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
  date: string,
  metric: 'percent' | 'meters' | 'season',
  now: Date,
  subjects?: UserRow[],
): LeaderboardRow[] {
  const users =
    subjects ??
    storage.sql
      .exec<UserRow>('SELECT * FROM users WHERE active = ? AND on_leaderboard = ?', 1, 1)
      .toArray();
  const week = weekStart(date);
  const range = seasonRange(date, getSetting<string>(storage, 'season_start'));
  const lastDate = range.end < addDays(week, 6) ? range.end : addDays(week, 6);
  const targets = loadTargets(storage);
  const aggregates = aggregateEntries(storage, range.start, lastDate);
  const byUser = new Map<string, EntryAggregate[]>();
  for (const entry of aggregates) {
    const rows = byUser.get(entry.user_id) ?? [];
    rows.push(entry);
    byUser.set(entry.user_id, rows);
  }
  const rows = users.map((user) => {
    const entries = byUser.get(user.id) ?? [];
    const weeks = summaries(user, range.start, lastDate, entries, targets);
    const weekly = weeks.find((row) => row.week_start === week)!;
    const target =
      metric === 'season' ? weeks.reduce((sum, row) => sum + row.target_m, 0) : weekly.target_m;
    const total =
      metric === 'season'
        ? entries
            .filter((entry) => entry.date >= range.start && entry.date <= lastDate)
            .reduce((sum, entry) => sum + entry.equiv_m, 0)
        : weekly.total_m;
    return {
      user: toPublicUser(user),
      target_m: target,
      total_m: total,
      percent: target > 0 ? Math.round((total / target) * 1000) / 10 : 0,
      rank: 0,
      streak: streak(weeks, weekStart(today(now))),
      entry_count: entries
        .filter((entry) => entry.week_start === week)
        .reduce((sum, entry) => sum + entry.entry_count, 0),
    };
  });
  const compareScore = (a: LeaderboardRow, b: LeaderboardRow) => {
    if (metric === 'percent') {
      const ratio =
        BigInt(b.target_m > 0 ? b.total_m : 0) * BigInt(a.target_m > 0 ? a.target_m : 1) -
        BigInt(a.target_m > 0 ? a.total_m : 0) * BigInt(b.target_m > 0 ? b.target_m : 1);
      if (ratio !== 0n) return ratio > 0n ? 1 : -1;
    }
    return b.total_m - a.total_m;
  };
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
