import { addDays, seasonRange, today, weekStart, type DateRange } from '../../../shared/dates';
import { ZONES } from '../../../shared/math';
import type {
  Entry,
  LeaderboardRow,
  RaceWeek,
  SeasonStats,
  TeamRace,
  Totals,
  User,
  WeekStats,
  WeekSummary,
} from '../../../shared/types';
import { userEntries, details } from './entries';
import { effectiveTarget, loadTargets } from './targets';
import { getSetting, optionalSetting } from './settings';
import {
  BERKELEY_PACE_PERCENT,
  berkeleyTotal,
  ghostMeters,
  raceWeekBounds,
} from '../../../shared/race';
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
) {
  const where = userId === undefined ? '' : ' AND user_id = ?';
  return storage.sql
    .exec<EntryAggregate>(
      `SELECT user_id,date,week_start,modality,zone,SUM(equiv_m) AS equiv_m,COUNT(*) AS entry_count FROM entries WHERE week_start >= ? AND week_start <= ?${where} GROUP BY user_id,week_start,date,modality,zone`,
      weekStart(start),
      weekStart(end),
      ...(userId === undefined ? [] : [userId]),
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
  _viewer: string,
  through = today(now),
): SeasonStats {
  const lastDate = range.end < through ? range.end : through;
  const targets = loadTargets(storage, user.id);
  const entries =
    lastDate >= range.start ? aggregateEntries(storage, range.start, lastDate, user.id) : [];
  const weeks = summaries(user, range.start, lastDate, entries, targets);
  const best = weeks.reduce<WeekSummary | null>(
    (best, week) => (week.total_m > (best?.total_m ?? 0) ? week : best),
    null,
  );
  return {
    ...totals(entries.filter((entry) => entry.date >= range.start && entry.date <= lastDate)),
    days: storage.sql
      .exec<{ date: string; equiv_m: number }>(
        'SELECT date,SUM(equiv_m) AS equiv_m FROM entries WHERE user_id = ? AND date >= ? AND date <= ? GROUP BY date HAVING SUM(equiv_m) > 0 ORDER BY date',
        user.id,
        range.start,
        lastDate,
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
export function uncachedLeaderboard(
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
  return rankRows(rows, metric);
}
function rankRows(rows: LeaderboardRow[], metric: 'percent' | 'meters' | 'season') {
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

type UserMemo = {
  version: number;
  weeks: WeekSummary[];
  seasonTotal: number;
  entryCount: number;
  streak: number;
};
type LeaderboardMemo = {
  globalVersion: number;
  anyVersion: number;
  seasonStart: string;
  context: string;
  users: Map<string, UserMemo>;
  rows: Map<string, LeaderboardRow[]>;
};
const leaderboardMemos = new WeakMap<DurableObjectStorage, LeaderboardMemo>();

export function leaderboard(
  storage: DurableObjectStorage,
  date: string,
  metric: 'percent' | 'meters' | 'season',
  now: Date,
  subjects?: UserRow[],
): LeaderboardRow[] {
  if (subjects) return uncachedLeaderboard(storage, date, metric, now, subjects);
  const counters = storage.sql
    .exec<{ global_version: number; any_version: number }>(
      'SELECT * FROM stats_counters WHERE id=1',
    )
    .one();
  const versions = new Map(
    storage.sql
      .exec<{ user_id: string; version: number }>('SELECT user_id,version FROM stats_versions')
      .toArray()
      .map((row) => [row.user_id, row.version]),
  );
  const users = storage.sql
    .exec<UserRow>('SELECT * FROM users WHERE active = ? AND on_leaderboard = ?', 1, 1)
    .toArray();
  let memo = leaderboardMemos.get(storage);
  if (!memo || memo.globalVersion !== counters.global_version) {
    memo = {
      globalVersion: counters.global_version,
      anyVersion: counters.any_version,
      seasonStart: getSetting<string>(storage, 'season_start'),
      context: '',
      users: new Map(),
      rows: new Map(),
    };
    leaderboardMemos.set(storage, memo);
  }
  const week = weekStart(date);
  const day = today(now);
  const currentWeek = weekStart(day);
  const range = seasonRange(date, memo.seasonStart);
  const lastDate = range.end < addDays(week, 6) ? range.end : addDays(week, 6);
  const context = JSON.stringify([range.start, range.end, week, currentWeek]);
  if (memo.context !== context) {
    memo.context = context;
    memo.users.clear();
    memo.rows.clear();
  }
  if (memo.anyVersion !== counters.any_version) {
    memo.anyVersion = counters.any_version;
    memo.rows.clear();
  }
  const rowKey = metric + ':' + day;
  const cached = memo.rows.get(rowKey);
  if (cached) {
    const publicUsers = new Map(users.map((user) => [user.id, toPublicUser(user)]));
    return cached.map((row) => ({ ...row, user: publicUsers.get(row.user.id)! }));
  }
  const stale = users.filter(
    (user) => memo.users.get(user.id)?.version !== (versions.get(user.id) ?? 0),
  );
  if (stale.length) {
    const targets = loadTargets(storage);
    const aggregates = storage.sql
      .exec<EntryAggregate>(
        'SELECT user_id,date,week_start,modality,zone,SUM(equiv_m) AS equiv_m,COUNT(*) AS entry_count FROM entries WHERE user_id IN (SELECT value FROM json_each(?)) AND week_start >= ? AND week_start <= ? GROUP BY user_id,week_start,date,modality,zone',
        JSON.stringify(stale.map((user) => user.id)),
        weekStart(range.start),
        weekStart(lastDate),
      )
      .toArray();
    const byUser = new Map<string, EntryAggregate[]>();
    for (const entry of aggregates) {
      const entries = byUser.get(entry.user_id) ?? [];
      entries.push(entry);
      byUser.set(entry.user_id, entries);
    }
    for (const user of stale) {
      const entries = byUser.get(user.id) ?? [];
      const weeks = summaries(user, range.start, lastDate, entries, targets);
      memo.users.set(user.id, {
        version: versions.get(user.id) ?? 0,
        weeks,
        seasonTotal: entries
          .filter((entry) => entry.date >= range.start && entry.date <= lastDate)
          .reduce((sum, entry) => sum + entry.equiv_m, 0),
        entryCount: entries
          .filter((entry) => entry.week_start === week)
          .reduce((sum, entry) => sum + entry.entry_count, 0),
        streak: streak(weeks, currentWeek),
      });
    }
  }
  const rows = rankRows(
    users.map((user) => {
      const input = memo.users.get(user.id)!;
      const weekly = input.weeks.find((row) => row.week_start === week)!;
      const target =
        metric === 'season'
          ? input.weeks.reduce((sum, row) => sum + row.target_m, 0)
          : weekly.target_m;
      const total = metric === 'season' ? input.seasonTotal : weekly.total_m;
      return {
        user: toPublicUser(user),
        target_m: target,
        total_m: total,
        percent: target > 0 ? Math.round((total / target) * 1000) / 10 : 0,
        rank: 0,
        streak: input.streak,
        entry_count: input.entryCount,
      };
    }),
    metric,
  );
  if (memo.rows.size >= 6) memo.rows.clear();
  memo.rows.set(rowKey, rows);
  return rows.map((row) => ({ ...row, user: { ...row.user } }));
}

/** Stanford vs Berkeley for the selected week and the one before it, over active rowers. */
export function teamRace(storage: DurableObjectStorage, date: string, now: Date): TeamRace {
  const week = weekStart(date);
  const previous = addDays(week, -7);
  const ratio = optionalSetting(storage, 'berkeley_pace_percent', BERKELEY_PACE_PERCENT) / 100;
  const users = storage.sql
    .exec<Pick<UserRow, 'id' | 'group_key'>>(
      'SELECT id,group_key FROM users WHERE active = ? AND role = ?',
      1,
      'rower',
    )
    .toArray();
  const meters = new Map(
    storage.sql
      .exec<{ week_start: string; total_m: number }>(
        'SELECT week_start,SUM(equiv_m) AS total_m FROM entries WHERE week_start IN (?,?) AND user_id IN (SELECT id FROM users WHERE active = ? AND role = ?) GROUP BY week_start',
        previous,
        week,
        1,
        'rower',
      )
      .toArray()
      .map((row) => [row.week_start, row.total_m]),
  );
  const target = loadTargets(storage);
  const at = now.getTime();
  const build = (start: string): RaceWeek => {
    const bounds = raceWeekBounds(start);
    const target_m = users.reduce((sum, user) => sum + target(user, start).target_m, 0);
    const berkeley_total_m = berkeleyTotal(target_m, ratio);
    return {
      week_start: start,
      starts_at: new Date(bounds.start).toISOString(),
      ends_at: new Date(bounds.end).toISOString(),
      status: at < bounds.start ? 'upcoming' : at < bounds.end ? 'live' : 'final',
      rowers: users.length,
      stanford_m: meters.get(start) ?? 0,
      target_m,
      berkeley_total_m,
      berkeley_m: ghostMeters(berkeley_total_m, bounds.start, bounds.end, at),
    };
  };
  return { as_of: now.toISOString(), ratio, week: build(week), previous: build(previous) };
}
