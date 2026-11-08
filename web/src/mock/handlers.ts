import type {
  AccountDataExport,
  ErgTest,
  TeamChallenge,
  Passkey,
  AnnouncementInput,
  AuditLog,
  ContentReport,
  Entry,
  EntryDetail,
  EntryInput,
  GroupKey,
  LeaderboardRow,
  Modality,
  MyPlanInput,
  Notification,
  Plan,
  PlanSlot,
  PresetInput,
  RosterInput,
  RosterRow,
  SeasonStats,
  Settings,
  Totals,
  User,
  WeekStats,
  WeekSummary,
  Zone,
  RaceWeek,
  GameResult,
} from '../../../shared/types';
import { addDays, seasonRange, today, weekStart, yearRange } from '../../../shared/dates';
import { equivalentMeters, MODE_FACTORS, ZONE_FACTORS, ZONES } from '../../../shared/math';
import { GROUP_TARGETS, PLAN_SLOTS, PLAN_TOTALS, PRESETS } from '../../../shared/seed';
import { createFixtures, publicUser } from './fixtures';
import { mentionIds } from '../lib/social';
import { generatedImage } from './images';
import { previewRoster } from '../pages/admin/roster';
import { factorError, paceError, seasonError, targetError } from '../pages/admin/operations';
import {
  BERKELEY_PACE_PERCENT,
  berkeleyTotal,
  ghostMeters,
  raceWeekBounds,
} from '../../../shared/race';
import { personalPlan, covers } from '../lib/myPlan';
import { DIVE_PROMPTS_PER_DAY } from '../../../shared/games/dive';
import { unpack, score } from '../../../shared/games/wordGuess';
import { GUESSES } from '../../../shared/games/wordGuessGuesses';
import {
  parsePerceptionAnswer,
  perceptionTotal,
  PERCEPTION_ROUNDS,
  scoreClock,
  scoreColor,
  scoreDot,
  scorePattern,
  scoreReaction,
  type PerceptionScores,
  type PerceptionAnswer,
} from '../../../shared/games/perception';
import {
  boardWords,
  connectionsScore,
  parsePuzzle,
  replayConnections,
} from '../../../shared/games/connections';

type MockGameScore = (payload: unknown, date: string) => { score: number; payload: unknown } | null;
let mockGuesses: Set<string> | null = null;
const MOCK_CONNECTIONS = parsePuzzle([
  'Boat Classes: Eight, Quad, Pair, Single',
  'Erg Readouts: Rate, Watts, Meters, Time',
  'Bowling Terms: Split, Spare, Strike, Frame',
  'Sound Like Rowing Words: Ore, Skull, Whey, Ate',
  'Ate>0',
  'Skull>0',
  'Split>1',
]);
const connectionsPuzzleFor = (_date: string) => MOCK_CONNECTIONS;

const MOCK_GAMES: Record<string, MockGameScore | null> = {
  dive: null,
  wordguess: null,
  perception: null,
  connections: null,
};
const MOCK_PERCEPTION = {
  clockMs: 4000,
  hue: 200,
  dot: [500, 500] as [number, number],
  cells: [0, 1, 2, 3, 4, 5, 6],
  reactionDelayMs: 2000,
};
class MockError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
function fail(status: number, message: string, code?: string): never {
  throw new MockError(
    status,
    code ??
      (status === 400
        ? 'VALIDATION_ERROR'
        : status === 401
          ? 'UNAUTHORIZED'
          : status === 403
            ? 'FORBIDDEN'
            : status === 404
              ? 'NOT_FOUND'
              : 'CONFLICT'),
    message,
  );
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const empty = () => new Response(null, { status: 204 });
const quoteCsv = (value: unknown) => {
  let text = value == null ? '' : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const dateValid = (date: unknown): date is string =>
  typeof date === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number.isFinite(Date.parse(date)) &&
  new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
function positive(value: unknown, name: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    fail(400, `${name} must be positive`);
}
function text(value: unknown, name: string, max = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    fail(400, `${name} is required and must be at most ${max} characters`);
}
export function createMockApi({
  now = () => new Date(),
  session = 'user-1',
  onSession = (_id: string | null) => {},
}: { now?: () => Date; session?: string | null; onSession?: (id: string | null) => void } = {}) {
  const state = createFixtures(now());
  const gameResults: GameResult[] = [];
  const wordProgress = new Map<string, string[]>();
  const connectionProgress = new Map<string, string[][]>();
  const perceptionProgress = new Map<
    string,
    {
      scores: Partial<PerceptionScores>;
      answer: Partial<PerceptionAnswer>;
      active: { round: number; at: number } | null;
    }
  >();
  const ergTests: ErgTest[] = state.users.flatMap((user) =>
    (['2k', '6k'] as const).flatMap((kind) => {
      const split = user[kind === '2k' ? 'best2k_split_s' : 'best6k_split_s'];
      return split === null
        ? []
        : [
            {
              id: `test-${user.id}-${kind}`,
              user_id: user.id,
              kind,
              date: today(new Date(user.updated_at)),
              time_s: split * (kind === '2k' ? 4 : 12),
              split_s: split,
              is_pr: true,
              created_at: user.updated_at,
              updated_at: user.updated_at,
            },
          ];
    }),
  );
  const challenges: TeamChallenge[] = [];
  function testHistory(userId: string) {
    const best = { '2k': Infinity, '6k': Infinity };
    return ergTests
      .filter((row) => row.user_id === userId)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.created_at.localeCompare(b.created_at) ||
          a.id.localeCompare(b.id),
      )
      .map((row) => {
        const is_pr = row.split_s < best[row.kind];
        best[row.kind] = Math.min(best[row.kind], row.split_s);
        return { ...row, is_pr };
      })
      .reverse();
  }
  function derive(userId: string) {
    const user = userById(userId);
    for (const kind of ['2k', '6k'] as const) {
      const values = ergTests
        .filter((row) => row.user_id === userId && row.kind === kind)
        .map((row) => row.split_s);
      user[kind === '2k' ? 'best2k_split_s' : 'best6k_split_s'] = values.length
        ? Math.min(...values)
        : null;
    }
    user.updated_at = stamp();
  }
  function saveTest(userId: string, body: Record<string, unknown>, before?: ErgTest) {
    if (!before && ergTests.filter((row) => row.user_id === userId).length >= 200)
      fail(400, 'At most 200 tests');
    const kind = body.kind === undefined ? before?.kind : body.kind,
      date = body.date === undefined ? before?.date : body.date;
    if (
      (kind !== '2k' && kind !== '6k') ||
      !dateValid(date) ||
      date < '2000-01-01' ||
      date > today(now())
    )
      fail(400, 'Invalid test kind or date');
    if (body.time_s !== undefined && body.split_s !== undefined)
      fail(400, 'Supply exactly one time or split');
    const factor = kind === '2k' ? 4 : 12;
    if (
      body.split_s !== undefined &&
      (typeof body.split_s !== 'number' || !Number.isFinite(body.split_s))
    )
      fail(400, 'Invalid split');
    const time =
      body.split_s !== undefined
        ? Number(body.split_s) * factor
        : body.time_s === undefined
          ? before?.time_s
          : body.time_s;
    if (
      typeof time !== 'number' ||
      !Number.isFinite(time) ||
      time < 60 * factor ||
      time > 300 * factor
    )
      fail(400, 'Split must be 60–300');
    const time_s = Math.round(time * 10) / 10;
    const row: ErgTest = {
      id: before?.id ?? id('test'),
      user_id: userId,
      kind,
      date,
      time_s,
      split_s: Math.round((time_s / factor) * 10) / 10,
      is_pr: false,
      created_at: before?.created_at ?? stamp(),
      updated_at: stamp(),
    };
    if (before) Object.assign(before, row);
    else ergTests.push(row);
    derive(userId);
    return testHistory(userId).find((test) => test.id === row.id)!;
  }
  function challengeView(row: TeamChallenge): TeamChallenge {
    const day = today(now());
    const entries = state.entries.filter(
      (e) =>
        e.date >= row.start_date &&
        e.date <= row.end_date &&
        (!row.modality || e.modality === row.modality),
    );
    const progress_m = entries.reduce(
      (n, e) => n + (row.unit === 'emeters' ? e.equiv_m : e.distance_m),
      0,
    );
    return {
      ...row,
      status:
        row.ended_at || row.end_date < day ? 'ended' : row.start_date > day ? 'upcoming' : 'active',
      progress_m,
      percent: Math.round((progress_m / row.goal_m) * 1000) / 10,
    };
  }
  let currentId = session;
  let sequence = 100000;
  let settings: Settings = {
    team_code: 'cardinal-oyo',
    mode_factors: { ...MODE_FACTORS },
    zone_factors: { ...ZONE_FACTORS },
    group_targets: { ...GROUP_TARGETS },
    season_start: '09-01',
    berkeley_pace_percent: BERKELEY_PACE_PERCENT,
  };
  let presets = structuredClone(PRESETS);
  let plan: Plan = { slots: structuredClone(PLAN_SLOTS), totals: structuredClone(PLAN_TOTALS) };
  const roster: RosterRow[] = state.roster;
  const audit: AuditLog[] = [];
  const reports: ContentReport[] = [];
  const mentionHistory = new Map<string, Set<string>>();
  const groupHistory = [{ week: '0000-01-01', targets: { ...settings.group_targets } }];
  const uploads = new Map<string, { blob: Blob; owner: string }>();
  const entryKeys = new Map<string, { entryId: string; createdAt: number }>();
  const passwords = new Map(state.users.map((u) => [u.id, 'password']));
  const intro = new Map(state.users.map((u) => [u.id, now().toISOString()]));
  const credentialVersions = new Map<string, number>();
  const passkeys: (Passkey & { user_id: string })[] = [];
  const passkeyPolicy = { requireReauth: false };
  const publicPasskey = (p: Passkey): Passkey => ({
    id: p.id,
    name: p.name,
    created_at: p.created_at,
    last_used_at: p.last_used_at,
    backed_up: p.backed_up,
  });
  let currentSession = session ? crypto.randomUUID() : null;
  const reauthGrants = new Map<
    string,
    { userId: string; session: string; version: number; expires_at: string }
  >();
  function setPassword(userId: string, password: string) {
    passwords.set(userId, password);
    credentialVersions.set(userId, (credentialVersions.get(userId) ?? 0) + 1);
    for (const [token, grant] of reauthGrants)
      if (grant.userId === userId) reauthGrants.delete(token);
  }
  const id = (prefix: string) => `${prefix}-${++sequence}`;
  const stamp = () => now().toISOString();
  const userById = (userId: string) =>
    state.users.find((u) => u.id === userId) || fail(404, 'User not found');
  const me = () => {
    const user = currentId && state.users.find((u) => u.id === currentId && u.active);
    if (!user) fail(401, 'Please log in.', 'UNAUTHENTICATED');
    return user;
  };
  const staff = () => ['admin', 'coach', 'coxswain'].includes(me().role);
  const requireStaff = () => {
    if (!staff()) fail(403, 'Staff access required');
  };
  function recordAudit(action: string, target: string, before: unknown, after: unknown) {
    audit.unshift({
      id: id('audit'),
      actor_id: me().id,
      action,
      target,
      detail_json: JSON.stringify({ before, after }),
      created_at: stamp(),
    });
  }
  function setSession(userId: string | null) {
    for (const [token, grant] of reauthGrants)
      if (grant.session === currentSession) reauthGrants.delete(token);
    currentId = userId;
    currentSession = userId ? crypto.randomUUID() : null;
    onSession(userId);
  }
  function target(userId: string, week: string) {
    const personal = state.targets
      .filter((t) => t.user_id === userId && t.week_start <= week)
      .sort((a, b) => b.week_start.localeCompare(a.week_start))[0];
    return {
      week_start: week,
      target_m:
        personal?.target_m ??
        groupHistory.filter((row) => row.week <= week).at(-1)!.targets[userById(userId).group_key],
      source: personal ? ('personal' as const) : ('group' as const),
    };
  }
  function detail(entry: Entry): EntryDetail {
    return {
      ...entry,
      author: publicUser(userById(entry.user_id)),
      images: state.imageLinks[entry.id] || [],
      tagged: (state.tags[entry.id] ?? [])
        .map(userById)
        .filter((u) => u.active)
        .map(publicUser),
      kudos_count: (state.kudos[entry.id] || []).length,
      has_kudos: (state.kudos[entry.id] || []).some((k) => k.user_id === currentId),
      comment_count: state.comments.filter((c) => c.entry_id === entry.id).length,
    };
  }
  function entryById(entryId: string) {
    const entry = state.entries.find((e) => e.id === entryId);
    if (!entry) fail(404, 'Entry not found');
    return entry;
  }
  function own(userId: string) {
    if (userId !== me().id && !staff()) fail(403, 'Only the owner or staff can change this');
  }
  function reportContent(report: ContentReport): ContentReport {
    const comment =
      report.target_type === 'comment'
        ? state.comments.find((c) => c.id === report.target_id)
        : undefined;
    const entry = state.entries.find((e) => e.id === report.entry_id);
    return {
      ...report,
      content:
        entry && (report.target_type === 'entry' || comment)
          ? {
              author: publicUser(userById(comment?.user_id ?? entry.user_id)),
              body: comment?.body ?? entry.notes,
              title: report.target_type === 'entry' ? entry.title : null,
            }
          : null,
    };
  }
  function closeReports(targetType: 'entry' | 'comment', targetId: string) {
    for (const report of reports)
      if (
        report.status === 'open' &&
        (targetType === 'entry'
          ? report.entry_id === targetId
          : report.target_type === 'comment' && report.target_id === targetId)
      )
        Object.assign(report, { status: 'deleted', reviewed_at: stamp(), reviewed_by: me().id });
  }
  function totals(entries: Entry[]): Totals {
    const result: Totals = {
      total_m: 0,
      by_modality: { erg: 0, bike: 0, run: 0 },
      by_zone: Object.fromEntries(ZONES.map((z) => [z, 0])) as Record<Zone, number>,
    };
    for (const e of entries) {
      result.total_m += e.equiv_m;
      result.by_modality[e.modality] += e.equiv_m;
      result.by_zone[e.zone] += e.equiv_m;
    }
    return result;
  }
  function summary(userId: string, week: string): WeekSummary {
    const total = totals(
      state.entries.filter((e) => e.user_id === userId && e.week_start === week),
    );
    const target_m = target(userId, week).target_m;
    return {
      ...total,
      week_start: week,
      target_m,
      percent: target_m ? (total.total_m / target_m) * 100 : 0,
      hit_target: target_m > 0 && total.total_m >= target_m,
    };
  }
  function streak(userId: string, week: string) {
    const first = weekStart(seasonRange(week, settings.season_start).start);
    let w = week;
    if (w === weekStart(today(now())) && !summary(userId, w).hit_target) w = addDays(w, -7);
    let count = 0;
    for (; w >= first && summary(userId, w).hit_target; w = addDays(w, -7)) count++;
    return count;
  }
  function weekStats(userId: string, week: string): WeekStats {
    const all = state.entries.filter((e) => e.user_id === userId && e.week_start === week);
    return {
      ...summary(userId, week),
      by_day: Array.from({ length: 7 }, (_, i) => {
        const date = addDays(week, i);
        return { date, equiv_m: totals(all.filter((e) => e.date === date)).total_m };
      }),
      entries: all.sort((a, b) => b.created_at.localeCompare(a.created_at)).map(detail),
    };
  }
  function seasonStats(
    userId: string,
    range = seasonRange(today(now()), settings.season_start),
  ): SeasonStats {
    const end = range.end < today(now()) ? range.end : today(now());
    const entries = state.entries.filter(
      (e) => e.user_id === userId && e.date >= range.start && e.date <= end,
    );
    const days = new Map<string, number>();
    for (const entry of entries) days.set(entry.date, (days.get(entry.date) ?? 0) + entry.equiv_m);
    const weeks: WeekSummary[] = [];
    for (let w = weekStart(range.start); w <= end; w = addDays(w, 7))
      weeks.push(summary(userId, w));
    return {
      days: [...days]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, equiv_m]) => ({ date, equiv_m }))
        .filter((day) => day.equiv_m > 0),
      ...totals(entries),
      ...range,
      weeks,
      streak: streak(userId, weekStart(end)),
      best_week: weeks.reduce<WeekSummary | null>(
        (best, w) => (!best || w.total_m > best.total_m ? w : best),
        null,
      ),
    };
  }
  function leaderboard(week: string, metric = 'percent', compliance = false): LeaderboardRow[] {
    const range = seasonRange(week, settings.season_start);
    const lastDate = range.end < addDays(week, 6) ? range.end : addDays(week, 6);
    const rows = state.users
      .filter((u) => u.active && (compliance ? u.role === 'rower' : u.on_leaderboard))
      .map((user) => {
        const s = summary(user.id, week);
        let target_m = s.target_m;
        let total_m = s.total_m;
        if (metric === 'season') {
          target_m = 0;
          for (let w = weekStart(range.start); w <= week; w = addDays(w, 7))
            target_m += target(user.id, w).target_m;
          total_m = totals(
            state.entries.filter(
              (e) => e.user_id === user.id && e.date >= range.start && e.date <= lastDate,
            ),
          ).total_m;
        }
        return {
          user: publicUser(user),
          target_m,
          total_m,
          percent: target_m > 0 ? Math.round((total_m / target_m) * 1000) / 10 : 0,
          rank: 0,
          streak: streak(user.id, week),
          entry_count: state.entries.filter((e) => e.user_id === user.id && e.week_start === week)
            .length,
        };
      });
    const score = (a: LeaderboardRow, b: LeaderboardRow) =>
      (metric === 'percent'
        ? (b.target_m > 0 ? b.total_m : 0) * (a.target_m || 1) -
          (a.target_m > 0 ? a.total_m : 0) * (b.target_m || 1)
        : 0) || b.total_m - a.total_m;
    rows.sort(
      (a, b) =>
        score(a, b) || a.user.name.localeCompare(b.user.name) || a.user.id.localeCompare(b.user.id),
    );
    rows.forEach((row, i) => {
      row.rank = i > 0 && score(rows[i - 1], row) === 0 ? rows[i - 1].rank : i + 1;
    });
    return rows;
  }
  function paginate<T>(items: T[], cursor: string | null) {
    const offset = cursor ? Number(cursor) : 0;
    if (!Number.isSafeInteger(offset) || offset < 0) fail(400, 'Invalid cursor');
    return {
      items: items.slice(offset, offset + 20),
      next_cursor: offset + 20 < items.length ? String(offset + 20) : null,
    };
  }
  function validateEntry(input: EntryInput) {
    if (
      !dateValid(input.date) ||
      input.date < '2020-01-01' ||
      input.date > addDays(today(now()), 1)
    )
      fail(400, 'Date must be between 2020 and tomorrow');
    if (!['erg', 'bike', 'run'].includes(input.modality) || !ZONES.includes(input.zone))
      fail(400, 'Choose a valid modality and zone');
    if (!Number.isInteger(input.distance_m) || input.distance_m < 1 || input.distance_m > 200000)
      fail(400, 'Distance must be 1–200,000 meters');
    if (typeof input.title !== 'string' || input.title.trim().length > 120)
      fail(400, 'Title must be at most 120 characters');
    if (typeof input.notes !== 'string' || input.notes.length > 2000)
      fail(400, 'Notes must be at most 2,000 characters');
    for (const [key, min, max, integer] of [
      ['duration_s', 1, 86400, true],
      ['avg_split_s', 60, 600, false],
      ['stroke_rate', 10, 60, true],
      ['avg_hr', 30, 240, true],
    ] as const) {
      const value = input[key];
      if (
        value != null &&
        (!Number.isFinite(value) ||
          (integer && !Number.isInteger(value)) ||
          value < min ||
          value > max)
      )
        fail(400, `${key} must be between ${min} and ${max}`);
    }
    if (
      input.image_ids &&
      (!Array.isArray(input.image_ids) ||
        input.image_ids.length > 4 ||
        new Set(input.image_ids).size !== input.image_ids.length ||
        input.image_ids.some(
          (image) =>
            typeof image !== 'string' ||
            image.length < 1 ||
            image.length > 200 ||
            (uploads.get(image)?.owner !== me().id &&
              !Object.values(state.imageLinks)
                .flat()
                .some((x) => x.id === image && x.owner_id === me().id)),
        ))
    )
      fail(400, 'Choose up to four of your uploaded images');
  }
  function validateRoster(row: RosterInput) {
    text(row.name, 'Name', 80);
    if (row.email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
      fail(400, 'Valid email required');
    if (
      !['rower', 'coxswain', 'coach', 'admin'].includes(row.role) ||
      (row.group_key !== null && !['frosh', 'normal', 'u23'].includes(row.group_key)) ||
      (row.side !== null && !['port', 'starboard', 'both', 'cox'].includes(row.side))
    )
      fail(400, 'Invalid roster role, group or side');
    if (
      row.class_year !== null &&
      (!Number.isInteger(row.class_year) || row.class_year < 1950 || row.class_year > 2100)
    )
      fail(400, 'Invalid class year');
  }
  function adminOnly() {
    if (me().role !== 'admin') fail(403, 'Only admins can manage admin accounts');
  }
  function protectAdmin(target: User, body: Record<string, unknown>) {
    if (
      body.role === 'admin' ||
      (target.role === 'admin' && ['role', 'active', 'group_key'].some((key) => key in body))
    )
      adminOnly();
    if (
      target.role === 'admin' &&
      target.active &&
      ((body.role !== undefined && body.role !== 'admin') || body.active === false) &&
      state.users.filter((user) => user.role === 'admin' && user.active).length <= 1
    )
      fail(409, 'The last active admin cannot be demoted or deactivated.');
  }
  function saveMockRoster(
    input: RosterInput,
    existing?: RosterRow,
    changed: Record<string, unknown> = { ...input },
  ) {
    validateRoster(input);
    if (input.role === 'admin' || existing?.role === 'admin') adminOnly();
    const linked = existing?.claimed_by_user_id ? userById(existing.claimed_by_user_id) : undefined;
    if (linked?.role === 'admin') adminOnly();
    if (linked) protectAdmin(linked, changed);
    if (
      roster.some(
        (row) =>
          row.id !== existing?.id && row.name.toLowerCase() === input.name.trim().toLowerCase(),
      )
    )
      fail(409, 'This name is already on the roster.');
    if (
      input.email &&
      roster.some(
        (row) => row.id !== existing?.id && row.email?.toLowerCase() === input.email?.toLowerCase(),
      )
    )
      fail(409, 'This email is already on the roster.');
    const row = existing ?? {
      id: id('roster'),
      claimed_by_user_id: null,
      added_by: me().id,
      created_at: stamp(),
      ...input,
    };
    Object.assign(row, input, {
      name: input.name.trim(),
      email: input.email?.toLowerCase() ?? null,
    });
    if (!existing) roster.push(row);
    if (linked) {
      for (const key of ['name', 'role', 'side', 'class_year'] as const)
        if (key in changed) Object.assign(linked, { [key]: row[key] });
      if ('group_key' in changed) linked.group_key = row.group_key ?? 'normal';
      linked.updated_at = stamp();
    }
    return row;
  }
  function validatePreset(p: PresetInput) {
    text(p.name, 'Preset name', 120);
    if (
      !['erg', 'bike', 'run'].includes(p.modality) ||
      !ZONES.includes(p.zone) ||
      typeof p.active !== 'boolean' ||
      !Number.isInteger(p.sort) ||
      p.sort < -1000000 ||
      p.sort > 1000000 ||
      (p.distance_m !== null &&
        (!Number.isInteger(p.distance_m) || p.distance_m < 1 || p.distance_m > 200000))
    )
      fail(400, 'Invalid preset');
  }
  function validateSlot(s: PlanSlot) {
    if (
      !s ||
      !['frosh', 'normal', 'u23'].includes(s.group_key) ||
      ![1, 2].includes(s.week) ||
      !Number.isInteger(s.day) ||
      s.day < 0 ||
      s.day > 6 ||
      !['AM', 'PM1', 'PM2'].includes(s.slot) ||
      !['team', 'oyo', 'off'].includes(s.kind) ||
      (s.zone !== null && !ZONES.includes(s.zone)) ||
      typeof s.text !== 'string' ||
      s.text.length > 2000
    )
      fail(400, 'Invalid plan slot');
  }
  function notify(
    userId: string,
    kind: Notification['kind'],
    entry: Entry | null,
    announcementId?: string,
  ) {
    if (userId === me().id || !userById(userId).active) return;
    state.notifications.unshift({
      id: id('notification'),
      user_id: userId,
      actor_id: me().id,
      actor: publicUser(me()),
      kind,
      ...(announcementId ? { announcement_id: announcementId } : {}),
      entry_id: entry?.id || null,
      entry_title: entry?.title || null,
      created_at: stamp(),
      read_at: null,
    });
  }
  function recipientIds(value: unknown, self: string): string[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.some((id) => typeof id !== 'string'))
      fail(400, 'Recipients must be user IDs');
    const ids = [...new Set(value as string[])].filter((id) => id !== self);
    if (ids.length > 10 || ids.some((id) => !state.users.some((u) => u.id === id && u.active)))
      fail(400, 'Select at most ten active teammates');
    return ids;
  }
  function setTags(entry: Entry, ids: string[]) {
    const previous = state.tags[entry.id] ?? [];
    state.tags[entry.id] = ids;
    for (const id of ids)
      if (
        !previous.includes(id) &&
        !state.notifications.some(
          (n) => n.user_id === id && n.entry_id === entry.id && n.kind === 'tag',
        )
      )
        notify(id, 'tag', entry);
  }
  async function handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;
      const parts = path.split('/').map(decodeURIComponent);
      const resourceId = parts[3];
      let body: Record<string, unknown> = {};
      if (!['GET', 'HEAD'].includes(method) && path !== '/api/images') {
        const raw = await request.text();
        if (raw) {
          try {
            body = JSON.parse(raw);
          } catch {
            fail(400, 'Invalid JSON');
          }
          if (!body || typeof body !== 'object' || Array.isArray(body))
            fail(400, 'JSON object required');
        }
      }
      if (path === '/api/health' && method === 'GET') return json({ ok: true, schema_version: 17 });
      if (path === '/api/auth/logout' && method === 'POST') {
        setSession(null);
        return empty();
      }
      if (path === '/api/auth/login' && method === 'POST') {
        const user = state.users.find((u) => u.email === String(body.email).toLowerCase());
        if (!user || !user.active || passwords.get(user.id) !== body.password)
          fail(401, 'Email or password is incorrect', 'INVALID_CREDENTIALS');
        setSession(user.id);
        return json(user);
      }
      if (path === '/api/auth/passkey/options' && method === 'POST') {
        const challenge = id('challenge');
        return json({
          challenge: btoa(challenge).replaceAll('=', ''),
          rp_id: new URL(request.url).hostname,
          timeout_ms: 300000,
          expires_at: new Date(now().getTime() + 300000).toISOString(),
        });
      }
      if (path === '/api/auth/passkey/login' && method === 'POST') {
        const passkey = passkeys.find((p) => p.id === body.id);
        const user = passkey && state.users.find((u) => u.id === passkey.user_id);
        if (!passkey || !user) fail(401, 'This passkey is not set up here.', 'PASSKEY_UNKNOWN');
        if (!user.active) fail(403, 'This account is inactive.', 'ACCOUNT_INACTIVE');
        passkey.last_used_at = stamp();
        setSession(user.id);
        return json(user);
      }
      if (path === '/api/me/passkeys' && method === 'GET')
        return json(passkeys.filter((p) => p.user_id === me().id).map(({ user_id: _, ...p }) => p));
      if (path === '/api/me/passkeys/options' && method === 'POST') {
        const user = me();
        const grant =
          typeof body.reauth_token === 'string' ? reauthGrants.get(body.reauth_token) : undefined;
        if (passkeyPolicy.requireReauth && grant?.userId !== user.id)
          fail(401, 'Verify your password again.', 'REAUTH_REQUIRED');
        const challenge = id('challenge');
        return json({
          challenge: btoa(challenge).replaceAll('=', ''),
          rp_id: new URL(request.url).hostname,
          rp_name: 'Stanford Rowing OYO',
          timeout_ms: 300000,
          expires_at: new Date(now().getTime() + 300000).toISOString(),
          user: {
            id: btoa(user.id).replaceAll('=', ''),
            name: user.email,
            display_name: user.name,
          },
          exclude_credentials: passkeys
            .filter((p) => p.user_id === user.id)
            .map((p) => ({ id: p.id, transports: ['internal'] })),
        });
      }
      if (path === '/api/me/passkeys' && method === 'POST') {
        const user = me();
        if (typeof body.id !== 'string')
          fail(400, 'Passkey could not be verified.', 'PASSKEY_INVALID');
        if (passkeys.some((p) => p.id === body.id))
          fail(409, 'This passkey is already set up.', 'PASSKEY_EXISTS');
        const passkey = {
          id: body.id,
          user_id: user.id,
          name: 'iPhone',
          created_at: stamp(),
          last_used_at: null,
          backed_up: true,
        };
        passkeys.push(passkey);
        recordAudit('passkey.add', user.id, null, { id: passkey.id, name: passkey.name });
        return json(publicPasskey(passkey), 201);
      }
      if (parts[2] === 'me' && parts[3] === 'passkeys' && parts[4] && method === 'DELETE') {
        const user = me();
        const index = passkeys.findIndex((p) => p.id === parts[4] && p.user_id === user.id);
        if (index < 0) fail(404, 'Passkey not found.', 'NOT_FOUND');
        const [removed] = passkeys.splice(index, 1);
        recordAudit('passkey.remove', user.id, { id: removed.id, name: removed.name }, null);
        return empty();
      }
      if (path === '/api/auth/roster' && method === 'POST') {
        if (body.team_code !== settings.team_code)
          fail(403, 'Enter a valid team code', 'INVALID_TEAM_CODE');
        return json(
          roster
            .filter((r) => !r.claimed_by_user_id)
            .map(({ id, name, role }) => ({ id, name, role })),
        );
      }
      if (path === '/api/auth/signup' && method === 'POST') {
        if (
          typeof body.email !== 'string' ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ||
          typeof body.password !== 'string' ||
          body.password.length < 8
        )
          fail(400, 'Valid email and password of at least 8 characters required');
        const email = body.email.toLowerCase();
        if (state.users.some((u) => u.email === email))
          fail(409, 'Email already registered', 'EMAIL_TAKEN');
        const invited = roster.find((r) => r.email === email);
        if (!invited && body.team_code !== settings.team_code)
          fail(403, 'Enter a valid team code or use your invite email', 'INVALID_TEAM_CODE');
        const listed = invited ?? roster.find((r) => r.id === body.roster_id);
        if (!listed) fail(400, 'Choose your name from the roster', 'ROSTER_REQUIRED');
        if (listed.claimed_by_user_id) fail(409, 'That name was already claimed', 'ROSTER_CLAIMED');
        if (
          body.group_key !== undefined &&
          !['frosh', 'normal', 'u23'].includes(String(body.group_key))
        )
          fail(400, 'Choose a valid group');
        const user: User = {
          ...state.users[0],
          id: id('user'),
          name: listed.name,
          email,
          role: listed.role,
          group_key:
            listed.role === 'rower'
              ? ((body.group_key as GroupKey | undefined) ?? 'normal')
              : 'normal',
          side: listed?.side || null,
          class_year: listed?.class_year || null,
          bio: '',
          avatar_image_id: null,
          best6k_split_s: null,
          best2k_split_s: null,
          on_leaderboard: listed.role === 'rower',
          active: true,
          must_change_password: false,
          created_at: stamp(),
          updated_at: stamp(),
        };
        state.users.push(user);
        listed.claimed_by_user_id = user.id;
        setPassword(user.id, body.password);
        setSession(user.id);
        return json(user, 201);
      }
      const user = me();
      if (parts[2] === 'games') {
        const date = today(now());
        const plan = state.myPlans
          .filter((row) => row.user_id === user.id && covers(row, date))
          .sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
        const reason =
          user.role !== 'rower'
            ? 'staff'
            : state.entries.some((row) => row.user_id === user.id && row.date === date)
              ? 'workout'
              : plan?.rest_days.some(
                    ({ week, day }) => addDays(plan.start_date, (week - 1) * 7 + day) === date,
                  )
                ? 'rest_day'
                : 'locked';
        const access = { date, unlocked: reason !== 'locked', reason };
        if (path === '/api/games/access' && method === 'GET') return json(access);
        if (path === '/api/games' && method === 'GET')
          return json({
            date,
            access,
            games: Object.keys(MOCK_GAMES).map((id) => ({ id, direction: 'higher' })),
            results: gameResults.filter((row) => row.user_id === user.id && row.date === date),
          });
        if (path === '/api/games/leaderboard' && method === 'GET')
          return json({ week_start: weekStart(url.searchParams.get('week') ?? date), rows: [] });
        const gameId = parts[3];
        if (!Object.hasOwn(MOCK_GAMES, gameId)) fail(404, 'Game not found.');
        const mine = (day: string) =>
          gameResults.find(
            (row) => row.game_id === gameId && row.date === day && row.user_id === user.id,
          ) ?? null;
        if (gameId === 'wordguess' && ['today', 'guess'].includes(parts[4])) {
          const key = `${user.id}:${date}`;
          const guesses = wordProgress.get(key) ?? [];
          const answer = 'crane';
          if (parts[4] === 'guess' && method === 'POST') {
            if (!access.unlocked) fail(403, 'Log a workout today to play.', 'GAME_LOCKED');
            if (mine(date)) fail(409, 'Already played today.', 'ALREADY_PLAYED');
            mockGuesses ??= new Set(unpack(GUESSES));
            if (
              typeof body.guess !== 'string' ||
              (body.guess !== answer && !mockGuesses.has(body.guess))
            )
              fail(400, 'Not in Word List');
            guesses.push(body.guess);
            wordProgress.set(key, guesses);
            if (body.guess === answer || guesses.length === 6) {
              const stamp = now().toISOString();
              gameResults.push({
                game_id: gameId,
                date,
                user_id: user.id,
                score: body.guess === answer ? 7 - guesses.length : 0,
                payload: {
                  guesses,
                  answer,
                  solved: body.guess === answer,
                  tries: guesses.length,
                  marks: guesses.map((word) => score(word, answer)),
                },
                created_at: stamp,
                updated_at: stamp,
              });
            }
          }
          const done = Boolean(mine(date));
          return json({
            date,
            access,
            guesses: guesses.map((word) => ({ word, marks: score(word, answer) })),
            done,
            won: guesses.at(-1) === answer,
            answer: done ? answer : null,
          });
        }
        if (gameId === 'dive' && parts[4] === 'today' && method === 'GET')
          return json({
            date,
            access,
            prompts: access.unlocked
              ? [
                  'Name a part of a rowing shell.',
                  'Name a fruit with a peel.',
                  'Name a Bay Area city.',
                  'Name a thing in a gym bag.',
                  'Name a Stanford campus landmark.',
                  'Name an animal with stripes.',
                  'Name a snack after a long row.',
                ]
              : [],
            answers: [],
            complete: false,
            score: 0,
            reveal: user.role === 'admin' ? [] : null,
          });
        const addResult = (score: number, payload: unknown) => {
          const stamp = now().toISOString();
          gameResults.push({
            game_id: gameId,
            date,
            user_id: user.id,
            score,
            payload,
            created_at: stamp,
            updated_at: stamp,
          });
        };
        if (gameId === 'perception' && ['today', 'start', 'answer'].includes(parts[4])) {
          const key = `${user.id}:${date}`;
          const p = perceptionProgress.get(key) ?? { scores: {}, answer: {}, active: null };
          perceptionProgress.set(key, p);
          if (method === 'GET' && parts[4] === 'today' && p.active) {
            p.scores[PERCEPTION_ROUNDS[p.active.round]] = 0;
            p.active = null;
          }
          const round = Object.keys(p.scores).length;
          if (method === 'POST') {
            if (!access.unlocked) fail(403, 'Log a workout today to play.', 'GAME_LOCKED');
            if (mine(date)) fail(409, 'Already played today.');
            if (body.round !== round) fail(409, 'Play rounds in order.');
            if (parts[4] === 'start') {
              if (p.active) fail(409, 'Already started.');
              p.active = { round, at: now().getTime() };
            } else {
              if (!p.active) fail(409, 'Start this round first.');
              const field = ['clockMs', 'hue', 'dot', 'cells', 'reactionMs'][round];
              const answer = parsePerceptionAnswer({
                clockMs: 0,
                hue: 0,
                dot: [0, 0],
                cells: [0, 1, 2, 3, 4, 5, 6],
                reactionMs: -1,
                [field]: (body.answer as Record<string, unknown>)?.[field],
              });
              if (!answer) fail(400, 'Invalid round answer.');
              const elapsed = now().getTime() - p.active.at;
              if (
                (round === 0 && answer.clockMs > elapsed + 1000) ||
                (round === 4 &&
                  answer.reactionMs >= 0 &&
                  (elapsed < MOCK_PERCEPTION.reactionDelayMs ||
                    answer.reactionMs > elapsed - MOCK_PERCEPTION.reactionDelayMs + 1000))
              )
                fail(400, 'Timing is not plausible.');
              const scores = {
                clock: scoreClock(MOCK_PERCEPTION, answer.clockMs),
                color: scoreColor(MOCK_PERCEPTION, answer.hue),
                dot: scoreDot(MOCK_PERCEPTION, answer.dot),
                pattern: scorePattern(MOCK_PERCEPTION, answer.cells),
                reaction: scoreReaction(answer.reactionMs),
              };
              p.scores[PERCEPTION_ROUNDS[round]] = scores[PERCEPTION_ROUNDS[round]];
              Object.assign(p.answer, { [field]: answer[field as keyof PerceptionAnswer] });
              p.active = null;
            }
          }
          const done = Object.keys(p.scores).length === 5;
          if (done && !mine(date))
            addResult(perceptionTotal(p.scores as PerceptionScores), {
              answer: p.answer,
              scores: p.scores,
            });
          const stimuli = [
            { clockMs: MOCK_PERCEPTION.clockMs },
            { hue: MOCK_PERCEPTION.hue },
            { dot: MOCK_PERCEPTION.dot },
            { cells: MOCK_PERCEPTION.cells },
            { reactionDelayMs: MOCK_PERCEPTION.reactionDelayMs },
          ];
          return json({
            date,
            access,
            round: Object.keys(p.scores).length,
            scores: p.scores,
            done,
            ...(parts[4] === 'start' ? { stimulus: stimuli[round] } : {}),
          });
        }
        if (gameId === 'connections' && ['today', 'guess', 'check'].includes(parts[4])) {
          if (parts[4] === 'check') fail(405, 'Use the single-guess endpoint.');
          const key = `${user.id}:${date}`;
          const guesses = connectionProgress.get(key) ?? [];
          const puzzle = connectionsPuzzleFor(date);
          if (parts[4] === 'guess' && method === 'POST') {
            if (!access.unlocked) fail(403, 'Log a workout today to play.', 'GAME_LOCKED');
            if (mine(date)) fail(409, 'Already played today.');
            if (!replayConnections(puzzle, [...guesses, body.guess]))
              fail(400, 'Repeated guess or words do not fit today’s board.');
            guesses.push(body.guess as string[]);
            connectionProgress.set(key, guesses);
          }
          const replay = replayConnections(puzzle, guesses)!;
          if (replay.finished && !mine(date))
            addResult(connectionsScore(replay), { ...replay, guesses, groups: puzzle.groups });
          return json({
            date,
            access,
            words: access.unlocked ? boardWords(date, puzzle) : [],
            guesses,
            outcomes: replay.outcomes,
            outcome: replay.outcomes.at(-1) ?? null,
            mistakes: replay.mistakes,
            finished: replay.finished,
            won: replay.won,
            solved: replay.solved.map((level) => puzzle.groups[level]),
            groups: replay.finished ? puzzle.groups : null,
          });
        }
        if (parts[4] === 'results' && method === 'GET')
          return json(mine(url.searchParams.get('date') ?? date));
        if (parts[4] === 'results' && method === 'POST') {
          if (!access.unlocked) fail(403, 'Log a workout today to play.', 'GAME_LOCKED');
          const scorer = MOCK_GAMES[gameId];
          if (!scorer) fail(405, 'Use this game’s own submit endpoint.', 'METHOD_NOT_ALLOWED');
          if (mine(date)) fail(409, 'Already played today.', 'ALREADY_PLAYED');
          const scored = scorer(body.payload, date);
          if (!scored) fail(400, 'Invalid result.');
          const stamp = now().toISOString();
          const row: GameResult = {
            game_id: gameId,
            date,
            user_id: user.id,
            ...scored,
            created_at: stamp,
            updated_at: stamp,
          };
          gameResults.push(row);
          return json(row, 201);
        }
        if (parts[4] === 'leaderboard' && method === 'GET') {
          const day = url.searchParams.get('date') ?? date;
          if (!dateValid(day) || day > date) fail(400, 'Invalid date.');
          if (
            user.role !== 'admin' &&
            (!mine(day) ||
              (gameId === 'dive' &&
                (mine(day)?.payload as { answered?: number })?.answered !== DIVE_PROMPTS_PER_DAY))
          )
            fail(403, 'Play today to see the board.', 'PLAY_FIRST');
          const rows = gameResults
            .filter((row) => row.game_id === gameId && row.date === day)
            .sort((a, b) => b.score - a.score)
            .map((row) => ({
              score: row.score,
              rank:
                1 +
                gameResults.filter(
                  (o) => o.game_id === gameId && o.date === day && o.score > row.score,
                ).length,
              user: publicUser(state.users.find((u) => u.id === row.user_id)!),
              me: row.user_id === user.id,
            }));
          return json({
            game_id: gameId,
            date: day,
            final: day < date,
            players: rows.length,
            rows,
          });
        }
      }
      if (
        user.must_change_password &&
        !['/api/me/password', '/api/me/password/verify', '/api/me'].includes(path)
      )
        fail(403, 'Change your temporary password first');
      if (path.startsWith('/api/admin/')) requireStaff();
      if (path === '/api/me/intro') {
        if (method === 'POST' && !intro.has(user.id)) intro.set(user.id, stamp());
        if (method === 'GET' || method === 'POST')
          return json({ completed_at: intro.get(user.id) ?? null });
      }
      if (path === '/api/me/export/workouts' && method === 'GET') {
        const columns = [
          'id',
          'date',
          'week_start',
          'modality',
          'zone',
          'distance_m',
          'duration_s',
          'avg_split_s',
          'stroke_rate',
          'avg_hr',
          'mode_factor',
          'zone_factor',
          'equiv_m',
          'title',
          'notes',
          'created_at',
          'updated_at',
        ] as const;
        const rows = state.entries
          .filter((entry) => entry.user_id === user.id)
          .sort(
            (a, b) =>
              a.date.localeCompare(b.date) ||
              a.created_at.localeCompare(b.created_at) ||
              a.id.localeCompare(b.id),
          );
        return new Response(
          [
            columns.join(','),
            ...rows.map((row) => columns.map((column) => quoteCsv(row[column])).join(',')),
            '',
          ].join('\r\n'),
          { headers: { 'Content-Type': 'text/csv', 'Cache-Control': 'private, no-store' } },
        );
      }
      if (path === '/api/me/export' && method === 'GET') {
        const person = (id: string) => ({ id, name: userById(id).name });
        const data: AccountDataExport = {
          game_results: [],
          dive_answers: [],
          format_version: 1,
          exported_at: stamp(),
          profile: user,
          roster: roster.find((row) => row.claimed_by_user_id === user.id) ?? null,
          weekly_targets: state.targets.filter((row) => row.user_id === user.id),
          erg_tests: testHistory(user.id).map(({ is_pr: _isPr, ...row }) => {
            void _isPr;
            return row;
          }),
          workouts: state.entries
            .filter((entry) => entry.user_id === user.id)
            .map((entry) => ({
              ...entry,
              images: state.imageLinks[entry.id] ?? [],
              tagged: (state.tags[entry.id] ?? []).map(person),
              kudos_count: state.kudos[entry.id]?.length ?? 0,
              comment_count: state.comments.filter((row) => row.entry_id === entry.id).length,
            })),
          images: Object.values(state.imageLinks)
            .flat()
            .filter((image) => image.owner_id === user.id),
          comments: state.comments
            .filter((row) => row.user_id === user.id)
            .map((comment) => ({
              ...comment,
              mentions: (state.mentions[comment.id] ?? []).map(person),
            })),
          kudos_given: Object.entries(state.kudos).flatMap(([entry_id, rows]) =>
            rows.filter((row) => row.user_id === user.id).map((row) => ({ ...row, entry_id })),
          ),
          plans: state.myPlans
            .filter((row) => row.user_id === user.id)
            .map((row) =>
              personalPlan(
                { start_date: row.start_date, sessions: row.sessions, rest_days: row.rest_days },
                settings,
                row.updated_at,
                state.entries.filter((entry) => entry.user_id === user.id),
              ),
            ),
          tagged_in: state.entries
            .filter((entry) => entry.user_id !== user.id && state.tags[entry.id]?.includes(user.id))
            .map((entry) => ({
              entry_id: entry.id,
              entry_owner_id: entry.user_id,
              tagged_at: entry.updated_at,
            })),
          mentioned_in: state.comments
            .filter((row) => row.user_id !== user.id && state.mentions[row.id]?.includes(user.id))
            .map((row) => ({
              comment_id: row.id,
              entry_id: row.entry_id,
              author_id: row.user_id,
              created_at: row.created_at,
            })),
        };
        const response = json(data);
        response.headers.set('Cache-Control', 'private, no-store');
        return response;
      }
      if (
        method !== 'GET' &&
        !path.endsWith('/remove') &&
        path.startsWith('/api/admin/') &&
        !['/api/admin/settings', '/api/admin/recalculate'].includes(path) &&
        !path.startsWith('/api/admin/presets') &&
        !(path === '/api/admin/plan' && method === 'PUT')
      )
        audit.unshift({
          id: id('audit'),
          actor_id: user.id,
          action: method,
          target: path,
          detail_json: JSON.stringify(body),
          created_at: stamp(),
        });
      if (/^\/api\/users\/[^/]+\/tests$/.test(path) && method === 'GET')
        return json(testHistory(resourceId));
      if (path === '/api/me/tests' && method === 'POST') return json(saveTest(user.id, body), 201);
      if (/^\/api\/me\/tests\/[^/]+$/.test(path)) {
        const row =
          ergTests.find((test) => test.id === parts[4] && test.user_id === user.id) ??
          fail(404, 'Test not found');
        if (method === 'PATCH') return json(saveTest(user.id, body, row));
        if (method === 'DELETE') {
          ergTests.splice(ergTests.indexOf(row), 1);
          derive(user.id);
          return empty();
        }
      }
      if (path === '/api/challenges' && method === 'GET')
        return json(
          challenges
            .map(challengeView)
            .filter((row) => row.status !== 'ended')
            .sort((a, b) => a.end_date.localeCompare(b.end_date)),
        );
      if (path.startsWith('/api/admin/challenges')) {
        const before = challenges.find((row) => row.id === parts[4]);
        if (method === 'GET') return json([...challenges].reverse().map(challengeView));
        if (parts[4] && !before) fail(404, 'Challenge not found');
        if (before && method === 'DELETE') {
          challenges.splice(challenges.indexOf(before), 1);
          recordAudit('challenge.delete', before.id, before, null);
          return empty();
        }
        if (before && parts[5] === 'end' && method === 'POST') {
          before.ended_at ??= stamp();
          before.updated_at = stamp();
          recordAudit('challenge.end', before.id, null, before);
          return json(challengeView(before));
        }
        if (before && challengeView(before).status === 'ended')
          fail(409, 'Ended challenges cannot be edited');
        const input = { ...before, ...body };
        text(input.title, 'Title', 60);
        if (
          !['emeters', 'km'].includes(String(input.unit)) ||
          !Number.isInteger(input.goal_m) ||
          Number(input.goal_m) < 1 ||
          Number(input.goal_m) > 1e9 ||
          !dateValid(input.start_date) ||
          !dateValid(input.end_date) ||
          input.end_date < input.start_date ||
          input.end_date > addDays(input.start_date, 366) ||
          (input.modality !== null && !['erg', 'bike', 'run'].includes(String(input.modality)))
        )
          fail(400, 'Invalid challenge');
        const row = {
          ...input,
          id: before?.id ?? id('challenge'),
          title: String(input.title).trim(),
          created_by: before?.created_by ?? user.id,
          created_at: before?.created_at ?? stamp(),
          updated_at: stamp(),
          ended_at: null,
          status: 'upcoming',
          progress_m: 0,
          percent: 0,
        } as TeamChallenge;
        if (before) Object.assign(before, row);
        else challenges.push(row);
        recordAudit(before ? 'challenge.update' : 'challenge.create', row.id, before, row);
        return json(challengeView(row), before ? 200 : 201);
      }
      if (path === '/api/stats/race' && method === 'GET') {
        const date = url.searchParams.get('week') ?? today(now());
        if (!dateValid(date) || date < '2000-01-01' || date > addDays(today(now()), 365))
          fail(400, 'Week date must be between 2000-01-01 and one year from today.');
        const at = now().getTime();
        const ratio = settings.berkeley_pace_percent / 100;
        const rowers = state.users.filter((u) => u.active && u.role === 'rower');
        const ids = new Set(rowers.map((u) => u.id));
        const build = (start: string): RaceWeek => {
          const bounds = raceWeekBounds(start);
          const target_m = rowers.reduce((n, u) => n + target(u.id, start).target_m, 0);
          const berkeley_total_m = berkeleyTotal(target_m, ratio);
          return {
            week_start: start,
            starts_at: new Date(bounds.start).toISOString(),
            ends_at: new Date(bounds.end).toISOString(),
            status: at < bounds.start ? 'upcoming' : at < bounds.end ? 'live' : 'final',
            rowers: rowers.length,
            stanford_m: state.entries
              .filter((e) => e.week_start === start && ids.has(e.user_id))
              .reduce((n, e) => n + e.equiv_m, 0),
            target_m,
            berkeley_total_m,
            berkeley_m: ghostMeters(berkeley_total_m, bounds.start, bounds.end, at),
          };
        };
        const week = weekStart(date);
        return json({
          as_of: now().toISOString(),
          ratio,
          week: build(week),
          previous: build(addDays(week, -7)),
        });
      }
      if (path === '/api/stats/recap' && method === 'GET') {
        const date = url.searchParams.get('week') ?? addDays(weekStart(today(now())), -7);
        if (!dateValid(date) || date < '2000-01-01' || weekStart(date) >= weekStart(today(now())))
          fail(400, 'Choose a completed week');
        const week = weekStart(date),
          summary = weekStats(user.id, week),
          board = leaderboard(week, 'percent');
        const entries = state.entries
          .filter((e) => e.user_id === user.id && e.week_start === week)
          .sort((a, b) => b.equiv_m - a.equiv_m || a.created_at.localeCompare(b.created_at));
        let streak = 0;
        for (
          let d = week;
          d >= '2000-01-01' && weekStats(user.id, d).hit_target;
          d = addDays(d, -7)
        )
          streak++;
        return json({
          ...summary,
          entry_count: entries.length,
          best_effort: entries[0] ?? null,
          streak,
          team: {
            total_m: board.reduce((n, r) => n + r.total_m, 0),
            entry_count: board.reduce((n, r) => n + r.entry_count, 0),
            rowers: board.length,
            rowers_hit_target: board.filter((r) => r.target_m > 0 && r.total_m >= r.target_m)
              .length,
          },
          rank: board.find((r) => r.user.id === user.id)?.rank ?? null,
        });
      }
      if (path === '/api/me') {
        if (method === 'GET') return json(user);
        if (method === 'PATCH') {
          if (body.name !== undefined) text(body.name, 'Name', 100);
          if (
            body.group_key !== undefined &&
            !['frosh', 'normal', 'u23'].includes(String(body.group_key))
          )
            fail(400, 'Choose a valid group');
          if (body.bio !== undefined && typeof body.bio !== 'string') fail(400, 'Bio must be text');
          if (
            body.side !== undefined &&
            body.side !== null &&
            !['port', 'starboard', 'both', 'cox'].includes(String(body.side))
          )
            fail(400, 'Invalid side');
          if (
            body.class_year !== undefined &&
            body.class_year !== null &&
            (!Number.isInteger(body.class_year) || Number(body.class_year) < 2020)
          )
            fail(400, 'Invalid class year');
          for (const key of ['best6k_split_s', 'best2k_split_s'] as const)
            if (body[key] != null) positive(body[key], key);
          if (
            body.avatar_image_id != null &&
            uploads.get(String(body.avatar_image_id))?.owner !== user.id
          )
            fail(400, 'Upload your avatar first');
          for (const key of ['name', 'bio', 'side', 'class_year', 'group_key', 'avatar_image_id'])
            if (key in body) Object.assign(user, { [key]: body[key] });
          user.updated_at = stamp();
          for (const kind of ['2k', '6k'] as const) {
            const split = body[kind === '2k' ? 'best2k_split_s' : 'best6k_split_s'];
            if (split != null) saveTest(user.id, { kind, date: today(now()), split_s: split });
          }
          return json(user);
        }
      }
      if (['/api/me/password/verify', '/api/me/password'].includes(path) && method === 'POST') {
        const verify = path.endsWith('/verify');
        const value = verify ? body.current_password : body.new_password;
        const label = verify ? 'Current password' : 'New password';
        if (!verify && 'current_password' in body)
          fail(400, 'Use /api/me/password/verify to verify the current password first.');
        if (typeof value !== 'string') fail(400, `${label} must be a string.`);
        if (value.length < 8 || value.length > 200)
          fail(400, `${label} must contain between 8 and 200 characters.`);
        const version = credentialVersions.get(user.id) ?? 0;
        const session = currentSession!;
        const checkGrant = () => {
          if (user.must_change_password) return;
          const grant =
            typeof body.reauth_token === 'string' ? reauthGrants.get(body.reauth_token) : undefined;
          if (
            !grant ||
            grant.userId !== user.id ||
            grant.session !== session ||
            grant.version !== version ||
            Date.parse(grant.expires_at) <= now().getTime()
          )
            fail(401, 'Verify your current password again before changing it.', 'REAUTH_REQUIRED');
        };
        if (verify) {
          if (value !== passwords.get(user.id))
            fail(401, 'Current password is incorrect.', 'INVALID_CREDENTIALS');
        } else checkGrant();
        await Promise.resolve();
        if (
          me().id !== user.id ||
          currentSession !== session ||
          (credentialVersions.get(user.id) ?? 0) !== version
        )
          fail(409, 'Credentials changed. Please try again.', 'CREDENTIALS_CHANGED');
        if (verify) {
          const expires_at = new Date(now().getTime() + 5 * 60 * 1000).toISOString();
          const reauth_token = (crypto.randomUUID() + crypto.randomUUID())
            .replaceAll('-', '')
            .slice(0, 43);
          for (const [token, grant] of reauthGrants)
            if (Date.parse(grant.expires_at) <= now().getTime()) reauthGrants.delete(token);
          reauthGrants.set(reauth_token, { userId: user.id, session, version, expires_at });
          return json({ reauth_token, expires_at });
        }
        checkGrant();
        setPassword(user.id, value);
        user.must_change_password = false;
        user.updated_at = stamp();
        return empty();
      }
      if (path === '/api/me/plan' || /^\/api\/me\/plan\/[^/]+$/.test(path)) {
        if (url.searchParams.has('user'))
          fail(400, 'Personal plans do not accept a user parameter.');
        const date = url.searchParams.get('date') ?? today(now());
        if (!dateValid(date)) fail(400, 'Invalid date');
        if (method === 'GET' && path === '/api/me/plan') {
          const plan = state.myPlans.find((row) => row.user_id === user.id && covers(row, date));
          if (!plan) return json(null);
          const { user_id: _owner, updated_at, ...input } = plan;
          void _owner;
          return json(
            personalPlan(
              input,
              settings,
              updated_at,
              state.entries.filter((entry) => entry.user_id === user.id),
            ),
          );
        }
        if (method === 'PUT' && path === '/api/me/plan') {
          const input = body as unknown as MyPlanInput;
          if (
            !dateValid(input.start_date) ||
            weekStart(input.start_date) !== input.start_date ||
            !Array.isArray(input.sessions) ||
            input.sessions.length > 42 ||
            !Array.isArray(input.rest_days) ||
            input.rest_days.length > 14
          )
            fail(400, 'Invalid personal plan');
          for (const row of [...input.sessions, ...input.rest_days])
            if (
              !row ||
              ![1, 2].includes(row.week) ||
              !Number.isInteger(row.day) ||
              row.day < 0 ||
              row.day > 6
            )
              fail(400, 'Invalid plan day');
          for (const row of input.sessions)
            if (
              !['AM', 'PM1', 'PM2'].includes(row.slot) ||
              !['erg', 'bike', 'run'].includes(row.modality) ||
              !ZONES.includes(row.zone) ||
              (row.distance_m !== null &&
                (!Number.isInteger(row.distance_m) ||
                  row.distance_m < 1 ||
                  row.distance_m > 200000)) ||
              typeof row.note !== 'string' ||
              row.note.trim().length > 200
            )
              fail(400, 'Invalid session');
          const rest = new Set(input.rest_days.map((row) => `${row.week}|${row.day}`));
          if (
            rest.size !== input.rest_days.length ||
            new Set(input.sessions.map((row) => `${row.week}|${row.day}|${row.slot}`)).size !==
              input.sessions.length ||
            input.sessions.some((row) => rest.has(`${row.week}|${row.day}`))
          )
            fail(400, 'Duplicate or conflicting plan days');
          if (
            state.myPlans.some(
              (row) =>
                row.user_id === user.id &&
                row.start_date !== input.start_date &&
                row.start_date >= addDays(input.start_date, -13) &&
                row.start_date <= addDays(input.start_date, 13),
            )
          )
            fail(409, 'Personal plans cannot overlap.');
          const saved = {
            start_date: input.start_date,
            sessions: input.sessions.map((row) => ({ ...row, note: row.note.trim() })),
            rest_days: input.rest_days,
            user_id: user.id,
            updated_at: stamp(),
          };
          state.myPlans = [
            ...state.myPlans.filter(
              (row) => row.user_id !== user.id || row.start_date !== input.start_date,
            ),
            saved,
          ];
          return json(
            personalPlan(
              saved,
              settings,
              saved.updated_at,
              state.entries.filter((entry) => entry.user_id === user.id),
            ),
          );
        }
        if (method === 'DELETE' && path !== '/api/me/plan') {
          const start = decodeURIComponent(path.split('/').at(-1)!);
          if (!dateValid(start) || weekStart(start) !== start) fail(400, 'Invalid start date');
          const index = state.myPlans.findIndex(
            (row) => row.user_id === user.id && row.start_date === start,
          );
          if (index < 0) fail(404, 'Personal plan not found');
          state.myPlans.splice(index, 1);
          return empty();
        }
        fail(405, 'Method not allowed');
      }
      if (path === '/api/me/target') {
        const week = weekStart(today(now()));
        if (method === 'GET') return json(target(user.id, week));
        if (method === 'PUT') {
          positive(body.target_m, 'Target');
          if (!Number.isInteger(body.target_m)) fail(400, 'Target must be whole meters');
          const existing = state.targets.find(
            (t) => t.user_id === user.id && t.week_start === week,
          );
          const row = { user_id: user.id, week_start: week, target_m: body.target_m as number };
          if (existing) Object.assign(existing, row);
          else state.targets.push(row);
          return json(row);
        }
      }
      if (path === '/api/config' && method === 'GET') {
        const config: Partial<Settings> = { ...settings };
        delete config.team_code;
        return json({
          ...config,
          presets: presets.filter((p) => p.active),
          zones: ZONES,
          today: today(now()),
          current_week_start: weekStart(today(now())),
        });
      }
      if (path === '/api/entries') {
        if (method === 'GET') {
          const scope = url.searchParams.get('scope') || 'feed';
          if (scope !== 'feed' && scope !== 'mine' && !scope.startsWith('user:'))
            fail(400, 'Invalid entries scope');
          if (scope.startsWith('user:')) userById(scope.slice(5));
          const entries = state.entries.filter((e) =>
            scope === 'feed'
              ? true
              : scope === 'mine'
                ? e.user_id === user.id
                : e.user_id === scope.slice(5),
          );
          return json(
            paginate(
              entries
                .sort(
                  (a, b) =>
                    b.date.localeCompare(a.date) ||
                    b.created_at.localeCompare(a.created_at) ||
                    b.id.localeCompare(a.id),
                )
                .map(detail),
              url.searchParams.get('cursor'),
            ),
          );
        }
        if (method === 'POST') {
          const input = body as unknown as EntryInput;
          validateEntry(input);
          const key = request.headers.get('Idempotency-Key');
          if (key !== null && !/^[A-Za-z0-9_-]{8,128}$/.test(key))
            fail(400, 'Invalid Idempotency-Key');
          const scopedKey = JSON.stringify([user.id, key]);
          const mapping = key === null ? undefined : entryKeys.get(scopedKey);
          if (mapping) {
            const original = state.entries.find((entry) => entry.id === mapping.entryId);
            if (!original) fail(404, 'Entry not found');
            return json(detail(original));
          }
          const { image_ids = [], tagged_user_ids, ...fields } = input;
          const tags = recipientIds(tagged_user_ids, user.id);
          const entry: Entry = {
            ...fields,
            visibility: 'team',
            id: id('entry'),
            user_id: user.id,
            week_start: weekStart(input.date),
            mode_factor: settings.mode_factors[input.modality],
            zone_factor: settings.zone_factors[input.zone],
            equiv_m: equivalentMeters(
              input.distance_m,
              input.modality,
              input.zone,
              settings.mode_factors,
              settings.zone_factors,
            ),
            duration_s: input.duration_s ?? null,
            avg_split_s: input.avg_split_s ?? null,
            stroke_rate: input.stroke_rate ?? null,
            avg_hr: input.avg_hr ?? null,
            preset_id: input.preset_id ?? null,
            created_at: stamp(),
            updated_at: stamp(),
          };
          state.entries.push(entry);
          if (key !== null) {
            const time = now().getTime();
            for (const [storedKey, stored] of entryKeys)
              if (stored.createdAt < time - 7 * 86400000) entryKeys.delete(storedKey);
            entryKeys.set(scopedKey, { entryId: entry.id, createdAt: time });
          }
          setTags(entry, tags);
          state.imageLinks[entry.id] = image_ids.map(
            (imageId) =>
              Object.values(state.imageLinks)
                .flat()
                .find((image) => image.id === imageId) || {
                id: imageId,
                owner_id: user.id,
                mime: uploads.get(imageId)!.blob.type as 'image/jpeg',
                width: 960,
                height: 640,
                created_at: stamp(),
              },
          );
          return json(detail(entry), 201);
        }
      }
      if (parts[2] === 'entries' && resourceId) {
        const entry = entryById(resourceId);
        if (parts[4] === 'kudos') {
          const list = (state.kudos[entry.id] ||= []);
          if (method === 'GET')
            return json(
              [...list]
                .sort(
                  (a, b) =>
                    Date.parse(b.created_at) - Date.parse(a.created_at) ||
                    (a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0),
                )
                .map((k) => publicUser(userById(k.user_id))),
            );
          if (method !== 'POST' && method !== 'DELETE') fail(404, 'Endpoint not found');
          if (method === 'POST' && !list.some((k) => k.user_id === user.id)) {
            list.push({ user_id: user.id, created_at: stamp() });
            notify(entry.user_id, 'kudos', entry);
          }
          if (method === 'DELETE')
            state.kudos[entry.id] = list.filter((k) => k.user_id !== user.id);
          return empty();
        }
        if (parts[4] === 'comments') {
          if (method === 'GET')
            return json(
              state.comments
                .filter((c) => c.entry_id === entry.id)
                .map((c) => ({
                  ...c,
                  mentions: (state.mentions[c.id] ?? [])
                    .map(userById)
                    .filter((u) => u.active)
                    .map(publicUser),
                  author: publicUser(userById(c.user_id)),
                })),
            );
          if (method === 'POST') {
            text(body.body, 'Comment');
            const comment = {
              id: id('comment'),
              entry_id: entry.id,
              user_id: user.id,
              body: body.body as string,
              created_at: stamp(),
            };
            const supplied = recipientIds(body.mention_ids, user.id);
            const ids = mentionIds(comment.body, supplied.map(userById));
            state.mentions[comment.id] = ids;
            mentionHistory.set(comment.id, new Set(ids));
            state.comments.push(comment);
            for (const id of ids) notify(id, 'mention', entry);
            if (!ids.includes(entry.user_id)) notify(entry.user_id, 'comment', entry);
            return json(
              { ...comment, mentions: ids.map(userById).map(publicUser), author: publicUser(user) },
              201,
            );
          }
        }
        if (parts.length === 4) {
          if (method === 'GET') return json(detail(entry));
          own(entry.user_id);
          if (method === 'DELETE') {
            closeReports('entry', entry.id);
            state.entries.splice(state.entries.indexOf(entry), 1);
            state.comments = state.comments.filter((c) => c.entry_id !== entry.id);
            delete state.imageLinks[entry.id];
            delete state.kudos[entry.id];
            delete state.tags[entry.id];
            return empty();
          }
          if (method === 'PATCH') {
            const input = { ...entry, ...body } as EntryInput;
            validateEntry(input);
            const tags =
              body.tagged_user_ids === undefined
                ? undefined
                : recipientIds(body.tagged_user_ids, entry.user_id);
            const allowed = [
              'date',
              'modality',
              'zone',
              'distance_m',
              'duration_s',
              'avg_split_s',
              'stroke_rate',
              'avg_hr',
              'title',
              'notes',
              'preset_id',
            ];
            for (const key of allowed) if (key in body) Object.assign(entry, { [key]: body[key] });
            Object.assign(entry, {
              visibility: 'team',
              week_start: weekStart(entry.date),
              mode_factor: settings.mode_factors[entry.modality],
              zone_factor: settings.zone_factors[entry.zone],
              equiv_m: equivalentMeters(
                entry.distance_m,
                entry.modality,
                entry.zone,
                settings.mode_factors,
                settings.zone_factors,
              ),
              updated_at: stamp(),
            });
            if (tags) setTags(entry, tags);
            if (input.image_ids)
              state.imageLinks[entry.id] = input.image_ids.map(
                (imageId) =>
                  state.imageLinks[entry.id]?.find((i) => i.id === imageId) || {
                    id: imageId,
                    owner_id: user.id,
                    mime: uploads.get(imageId)!.blob.type as 'image/jpeg',
                    width: 960,
                    height: 640,
                    created_at: stamp(),
                  },
              );
            return json(detail(entry));
          }
        }
      }
      if (parts[2] === 'comments' && method === 'PATCH') {
        const comment =
          state.comments.find((c) => c.id === resourceId) || fail(404, 'Comment not found');
        if (comment.user_id !== user.id) fail(403, 'Only the author may edit this comment');
        text(body.body, 'Comment');
        const supplied = recipientIds(
          body.mention_ids ?? state.mentions[comment.id] ?? [],
          user.id,
        );
        const ids = mentionIds(String(body.body), supplied.map(userById));
        const history = mentionHistory.get(comment.id) ?? new Set(state.mentions[comment.id] ?? []);
        if (comment.body !== String(body.body).trim()) comment.edited_at = stamp();
        comment.body = String(body.body).trim();
        state.mentions[comment.id] = ids;
        for (const id of ids) {
          if (!history.has(id)) notify(id, 'mention', entryById(comment.entry_id));
          history.add(id);
        }
        mentionHistory.set(comment.id, history);
        return json({
          ...comment,
          mentions: ids.map(userById).map(publicUser),
          author: publicUser(user),
        });
      }
      if (path === '/api/reports' && method === 'POST') {
        if (
          !['entry', 'comment'].includes(String(body.target_type)) ||
          typeof body.target_id !== 'string'
        )
          fail(400, 'Invalid report target');
        if (
          body.reason !== undefined &&
          (typeof body.reason !== 'string' || body.reason.trim().length > 300)
        )
          fail(400, 'Reason must be at most 300 characters');
        const previous = reports.find(
          (r) =>
            r.reporter.id === user.id &&
            r.target_type === body.target_type &&
            r.target_id === body.target_id,
        );
        if (previous) return json({ id: previous.id });
        const comment =
          body.target_type === 'comment'
            ? state.comments.find((c) => c.id === body.target_id) || fail(404, 'Comment not found')
            : undefined;
        const entry = entryById(comment?.entry_id ?? String(body.target_id));
        const report: ContentReport = {
          id: id('report'),
          target_type: body.target_type as 'entry' | 'comment',
          target_id: String(body.target_id),
          entry_id: entry.id,
          reporter: publicUser(user),
          reason: String(body.reason ?? '').trim(),
          status: 'open',
          created_at: stamp(),
          reviewed_at: null,
          reviewed_by: null,
          content: null,
        };
        reports.unshift(report);
        for (const member of state.users)
          if (member.active && member.role !== 'rower') notify(member.id, 'report', entry);
        return json({ id: report.id }, 201);
      }
      if (path === '/api/admin/reports' && method === 'GET') {
        const status = url.searchParams.get('status') ?? 'open';
        if (!['open', 'dismissed', 'deleted'].includes(status)) fail(400, 'Invalid report status');
        return json(
          paginate(
            reports.filter((r) => r.status === status).map(reportContent),
            url.searchParams.get('cursor'),
          ),
        );
      }
      if (parts[2] === 'admin' && parts[3] === 'reports' && method === 'PATCH') {
        const report = reports.find((r) => r.id === parts[4]) || fail(404, 'Report not found');
        if (!['dismiss', 'delete'].includes(String(body.action))) fail(400, 'Invalid action');
        if (report.status !== 'open') fail(409, 'Report already reviewed');
        const before = { ...report };
        if (body.action === 'delete') {
          const content = reportContent(report).content;
          if (report.target_type === 'entry') {
            state.entries = state.entries.filter((e) => e.id !== report.target_id);
            state.comments = state.comments.filter((c) => c.entry_id !== report.entry_id);
          } else state.comments = state.comments.filter((c) => c.id !== report.target_id);
          if (content) recordAudit(`${report.target_type}.delete`, report.target_id, content, null);
          closeReports(report.target_type, report.target_id);
        } else
          Object.assign(report, {
            status: 'dismissed',
            reviewed_at: stamp(),
            reviewed_by: user.id,
          });
        recordAudit(`report.${body.action}`, report.id, before, report);
        return json(reportContent(report));
      }
      if (parts[2] === 'comments' && method === 'DELETE') {
        const comment =
          state.comments.find((c) => c.id === resourceId) || fail(404, 'Comment not found');
        own(comment.user_id);
        closeReports('comment', comment.id);
        state.comments.splice(state.comments.indexOf(comment), 1);
        delete state.mentions[comment.id];
        return empty();
      }
      if (path === '/api/images' && method === 'POST') {
        const blob = await request.blob();
        if (
          !['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) ||
          blob.size === 0 ||
          blob.size > 1.5 * 1024 * 1024
        )
          fail(400, 'Upload JPEG, PNG or WebP up to 1.5 MB');
        const imageId = id('image');
        uploads.set(imageId, { blob, owner: user.id });
        return json({ id: imageId }, 201);
      }
      if (parts[2] === 'images' && method === 'GET') {
        const upload = uploads.get(resourceId);
        const linked = state.entries.some((e) =>
          state.imageLinks[e.id]?.some((i) => i.id === resourceId),
        );
        if (
          !linked &&
          upload?.owner !== user.id &&
          !state.users.some((u) => u.avatar_image_id === resourceId)
        )
          fail(404, 'Image not found');
        const blob = upload?.blob || (await generatedImage(resourceId));
        return new Response(blob, {
          headers: {
            'Content-Type': blob.type,
            'Cache-Control': 'private, max-age=31536000, immutable',
          },
        });
      }
      if (path === '/api/stats/week' || path === '/api/stats/season') {
        const userId = url.searchParams.get('user') || user.id;
        userById(userId);
        if (path.endsWith('/week')) {
          const week = url.searchParams.get('week') || weekStart(today(now()));
          if (!dateValid(week) || weekStart(week) !== week) fail(400, 'Week must be a Monday date');
          return json(weekStats(userId, week));
        }
        const year = url.searchParams.get('year');
        const season = url.searchParams.get('season');
        if ((year && season) || ((year || season) && !/^\d{4}$/.test((year || season)!)))
          fail(400, 'Choose a valid season or year');
        const range = year
          ? yearRange(Number(year))
          : season
            ? {
                start: `${season}-${settings.season_start}`,
                end: addDays(`${Number(season) + 1}-${settings.season_start}`, -1),
              }
            : seasonRange(today(now()), settings.season_start);
        return json(seasonStats(userId, range));
      }
      if (path === '/api/leaderboard' && method === 'GET') {
        const week = url.searchParams.get('week') || weekStart(today(now()));
        const metric = url.searchParams.get('metric') || 'percent';
        if (
          !dateValid(week) ||
          weekStart(week) !== week ||
          !['percent', 'meters', 'season'].includes(metric)
        )
          fail(400, 'Invalid leaderboard query');
        return json(leaderboard(week, metric));
      }
      if (path === '/api/users' && method === 'GET')
        return json(state.users.filter((u) => u.active).map(publicUser));
      if (parts[2] === 'users' && method === 'GET') {
        const profile = userById(resourceId);
        return json({ user: publicUser(profile), stats: seasonStats(profile.id) });
      }
      if (parts[2] === 'announcements') {
        if (method === 'GET' && resourceId)
          return json(
            state.announcements.find((announcement) => announcement.id === resourceId) ||
              fail(404, 'Announcement not found'),
          );
        if (method === 'GET' && !resourceId)
          return json(
            [...state.announcements].sort(
              (a, b) =>
                Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at),
            ),
          );
        requireStaff();
        if (method === 'POST' && !resourceId) {
          const input = body as unknown as AnnouncementInput;
          text(input.title, 'Title', 120);
          text(input.body, 'Body', 5000);
          if (typeof input.pinned !== 'boolean') fail(400, 'Pinned must be boolean');
          const announcement = {
            ...input,
            id: id('announcement'),
            author_id: user.id,
            author: publicUser(user),
            created_at: stamp(),
          };
          state.announcements.unshift(announcement);
          recordAudit('announcement.create', announcement.id, null, announcement);
          for (const u of state.users) notify(u.id, 'announcement', null, announcement.id);
          return json(announcement, 201);
        }
        const announcement =
          state.announcements.find((a) => a.id === resourceId) ||
          fail(404, 'Announcement not found');
        if (method === 'DELETE') {
          recordAudit('announcement.delete', announcement.id, announcement, null);
          state.announcements.splice(state.announcements.indexOf(announcement), 1);
          state.notifications = state.notifications.filter(
            (notification) =>
              notification.kind !== 'announcement' ||
              notification.announcement_id !== announcement.id,
          );
          return empty();
        }
        if (method === 'PATCH') {
          if (body.title !== undefined) text(body.title, 'Title', 120);
          if (body.body !== undefined) text(body.body, 'Body', 5000);
          if (body.pinned !== undefined && typeof body.pinned !== 'boolean')
            fail(400, 'Pinned must be boolean');
          const before = structuredClone(announcement);
          for (const key of ['title', 'body', 'pinned'])
            if (key in body) Object.assign(announcement, { [key]: body[key] });
          recordAudit('announcement.update', announcement.id, before, announcement);
          return json(announcement);
        }
      }
      if (path === '/api/notifications' && method === 'GET')
        return json(
          state.notifications
            .filter((n) => n.user_id === user.id && (n.kind !== 'report' || staff()))
            .sort((a, b) => b.created_at.localeCompare(a.created_at)),
        );
      if (path === '/api/me/push' && method === 'GET')
        return json({
          public_key:
            'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
        });
      if (path === '/api/me/push' && (method === 'PUT' || method === 'DELETE')) {
        if (typeof body.endpoint !== 'string' || !body.endpoint.startsWith('https://'))
          fail(400, 'Push endpoint required');
        return empty();
      }
      if (path === '/api/notifications/read' && method === 'POST') {
        if (!Array.isArray(body.ids) || body.ids.some((x) => typeof x !== 'string'))
          fail(400, 'Notification IDs required');
        for (const n of state.notifications)
          if (n.user_id === user.id && (body.ids as string[]).includes(n.id)) n.read_at = stamp();
        return empty();
      }
      if (path === '/api/plan' && method === 'GET') {
        const group = url.searchParams.get('group') || user.group_key;
        if (!['frosh', 'normal', 'u23'].includes(group)) fail(400, 'Invalid group');
        return json({
          slots: plan.slots.filter((s) => s.group_key === group),
          totals: plan.totals.filter((t) => t.group_key === group),
        });
      }
      if (path === '/api/admin/users' && method === 'GET') return json(state.users);
      if (parts[2] === 'admin' && parts[3] === 'users' && parts[4]) {
        const targetUser = userById(parts[4]);
        if (parts[5] === 'remove' && method === 'POST') {
          adminOnly();
          if (targetUser.id === user.id || targetUser.role !== 'rower')
            fail(409, 'Only another rower can be removed');
          if (
            typeof body.confirmation_email !== 'string' ||
            body.confirmation_email.trim().toLowerCase() !== targetUser.email.toLowerCase()
          )
            fail(400, 'Type the account email exactly to confirm', 'CONFIRMATION_MISMATCH');
          const removedEntries = new Set(
            state.entries
              .filter((entry) => entry.user_id === targetUser.id)
              .map((entry) => entry.id),
          );
          const removedComments = state.comments.filter(
            (row) => row.user_id === targetUser.id || removedEntries.has(row.entry_id),
          );
          for (const entry of removedEntries) closeReports('entry', entry);
          for (const comment of removedComments) closeReports('comment', comment.id);
          for (let index = reports.length - 1; index >= 0; index--)
            if (reports[index].reporter.id === targetUser.id) reports.splice(index, 1);
          for (const report of reports)
            if (report.reviewed_by === targetUser.id) report.reviewed_by = null;
          for (const [commentId, ids] of mentionHistory) {
            if (removedComments.some((comment) => comment.id === commentId))
              mentionHistory.delete(commentId);
            else ids.delete(targetUser.id);
          }
          for (const [key] of entryKeys)
            if (JSON.parse(key)[0] === targetUser.id) entryKeys.delete(key);
          for (let index = passkeys.length - 1; index >= 0; index--)
            if (passkeys[index].user_id === targetUser.id) passkeys.splice(index, 1);
          const removedRoster = roster.find((row) => row.claimed_by_user_id === targetUser.id);
          const removedTests = ergTests.filter((row) => row.user_id === targetUser.id);
          const removedChallenges = challenges.filter((row) => row.created_by === targetUser.id);
          for (const row of removedTests) ergTests.splice(ergTests.indexOf(row), 1);
          for (const row of removedChallenges) challenges.splice(challenges.indexOf(row), 1);
          for (const row of audit) {
            if (
              row.actor_id === targetUser.id ||
              [targetUser.id, removedRoster?.id].includes(row.target) ||
              [targetUser.id, targetUser.email, targetUser.name].some((value) =>
                row.detail_json.includes(value),
              )
            )
              row.detail_json = JSON.stringify({
                before: null,
                after: null,
                redacted: 'account_removed',
              });
          }
          for (const entry of state.entries) {
            state.tags[entry.id] = (state.tags[entry.id] ?? []).filter(
              (id) => id !== targetUser.id,
            );
            state.kudos[entry.id] = (state.kudos[entry.id] ?? []).filter(
              (row) => row.user_id !== targetUser.id,
            );
            state.imageLinks[entry.id] = (state.imageLinks[entry.id] ?? []).filter(
              (image) => image.owner_id !== targetUser.id,
            );
          }
          for (const entry of removedEntries) {
            delete state.tags[entry];
            delete state.kudos[entry];
            delete state.imageLinks[entry];
          }
          for (const comment of state.comments)
            state.mentions[comment.id] = (state.mentions[comment.id] ?? []).filter(
              (id) => id !== targetUser.id,
            );
          for (const comment of removedComments) delete state.mentions[comment.id];
          state.entries = state.entries.filter((row) => !removedEntries.has(row.id));
          state.comments = state.comments.filter((row) => !removedComments.includes(row));
          state.myPlans = state.myPlans.filter((row) => row.user_id !== targetUser.id);
          state.targets = state.targets.filter((row) => row.user_id !== targetUser.id);
          state.announcements = state.announcements.filter(
            (row) => row.author_id !== targetUser.id,
          );
          state.notifications = state.notifications.filter(
            (row) =>
              row.user_id !== targetUser.id &&
              row.actor_id !== targetUser.id &&
              !removedEntries.has(row.entry_id ?? ''),
          );
          state.users = state.users.filter((row) => row.id !== targetUser.id);
          if (removedRoster) roster.splice(roster.indexOf(removedRoster), 1);
          for (const row of roster) if (row.added_by === targetUser.id) row.added_by = null;
          for (const [id, upload] of uploads)
            if (upload.owner === targetUser.id) uploads.delete(id);
          passwords.delete(targetUser.id);
          credentialVersions.delete(targetUser.id);
          intro.delete(targetUser.id);
          for (const [token, grant] of reauthGrants)
            if (grant.userId === targetUser.id) reauthGrants.delete(token);
          recordAudit(
            'user.remove',
            targetUser.id,
            { role: targetUser.role, active: targetUser.active },
            {
              removed: {
                workouts: removedEntries.size,
                erg_tests: removedTests.length,
                challenges: removedChallenges.length,
              },
            },
          );
          return empty();
        }
        if (parts[5] === 'reset-password' && method === 'POST') {
          if (targetUser.role === 'admin') adminOnly();
          const temporary_password = `temp-${id('password')}`;
          setPassword(targetUser.id, temporary_password);
          targetUser.must_change_password = true;
          return json({ temporary_password });
        }
        if (method === 'PATCH') {
          protectAdmin(targetUser, body);
          if (
            (body.role !== undefined &&
              !['rower', 'coxswain', 'coach', 'admin'].includes(String(body.role))) ||
            (body.group_key !== undefined &&
              !['frosh', 'normal', 'u23'].includes(String(body.group_key)))
          )
            fail(400, 'Invalid role or group');
          for (const key of ['on_leaderboard', 'active'])
            if (key in body && typeof body[key] !== 'boolean') fail(400, `${key} must be boolean`);
          for (const key of ['role', 'group_key', 'on_leaderboard', 'active'])
            if (key in body) Object.assign(targetUser, { [key]: body[key] });
          targetUser.updated_at = stamp();
          return json(targetUser);
        }
      }
      if (path.startsWith('/api/admin/roster')) {
        if (path.endsWith('/import') && method === 'POST') {
          if (typeof body.csv !== 'string' || body.csv.length > 60000)
            fail(400, 'CSV must be at most 60,000 characters.');
          const preview = previewRoster(body.csv as string, user.role === 'admin');
          if (preview.headerError) fail(400, preview.headerError);
          let imported = 0;
          const errors: { row: number; message: string }[] = [];
          preview.rows.forEach((record) => {
            try {
              if (record.errors.length) fail(400, record.errors.join(' '));
              const row = record.input;
              const existing = roster.find((r) =>
                row.email
                  ? r.email?.toLowerCase() === row.email.toLowerCase()
                  : r.name.toLowerCase() === row.name.toLowerCase(),
              );
              if (record.cells.length === 5 && existing) row.email = existing.email;
              saveMockRoster(row, existing);
              imported++;
            } catch (error) {
              errors.push({ row: record.row, message: (error as Error).message });
            }
          });
          return json({ imported, errors });
        }
        const rosterId = parts[4];
        if (method === 'GET' && !rosterId) return json(roster);
        if (method === 'POST' && !rosterId) {
          const input = body as unknown as RosterInput;
          return json(saveMockRoster(input), 201);
        }
        const row = roster.find((r) => r.id === rosterId) || fail(404, 'Roster row not found');
        if (parts[5] === 'unlink' && method === 'POST') {
          if (!row.claimed_by_user_id) fail(409, 'This roster row is not claimed.');
          if (row.claimed_by_user_id === user.id)
            fail(409, 'You cannot unlink your own roster row.');
          if (userById(row.claimed_by_user_id).role === 'admin') adminOnly();
          if (row.claimed_by_user_id) userById(row.claimed_by_user_id).active = false;
          row.claimed_by_user_id = null;
          return json(row);
        }
        if (method === 'DELETE') {
          if (row.role === 'admin') adminOnly();
          if (row.claimed_by_user_id) fail(409, 'Unlink this roster row before deleting it.');
          roster.splice(roster.indexOf(row), 1);
          return empty();
        }
        if (method === 'PATCH') {
          const input = { ...row, ...body } as RosterInput;
          return json(saveMockRoster(input, row, body));
        }
      }
      if (path === '/api/admin/settings') {
        if (method === 'GET') return json(settings);
        if (method === 'PATCH') {
          const next = { ...settings, ...body } as Settings;
          if (!/^[A-Za-z0-9-]{6,64}$/.test(next.team_code))
            fail(400, 'Team code must be 6–64 letters, numbers or hyphens.');
          if (seasonError(next.season_start)) fail(400, 'Invalid season start');
          if (paceError(String(next.berkeley_pace_percent)))
            fail(400, 'Berkeley pace must be a whole percent from 50 to 150.');
          for (const m of Object.keys(MODE_FACTORS) as Modality[])
            if (
              typeof next.mode_factors?.[m] !== 'number' ||
              factorError(String(next.mode_factors[m]))
            )
              fail(400, 'Mode factor must be from 0.01 to 100.');
          for (const z of ZONES)
            if (
              typeof next.zone_factors?.[z] !== 'number' ||
              factorError(String(next.zone_factors[z]))
            )
              fail(400, 'Zone factor must be from 0.01 to 100.');
          for (const g of Object.keys(GROUP_TARGETS) as GroupKey[])
            if (
              typeof next.group_targets?.[g] !== 'number' ||
              targetError(String(next.group_targets[g]))
            )
              fail(400, 'Group target must be whole meters from 1,000 to 1,000,000.');
          const { team_code: oldCode, ...before } = settings;
          const { team_code: newCode, ...after } = next;
          audit.unshift({
            id: id('audit'),
            actor_id: user.id,
            action: 'settings.update',
            target: 'settings',
            detail_json: JSON.stringify({
              before,
              after: { ...after, team_code_changed: oldCode !== newCode },
            }),
            created_at: stamp(),
          });
          settings = next;
          if (body.group_targets !== undefined) {
            const week = weekStart(today(now()));
            const existing = groupHistory.find((row) => row.week === week);
            if (existing) existing.targets = { ...next.group_targets };
            else groupHistory.push({ week, targets: { ...next.group_targets } });
            groupHistory.sort((a, b) => a.week.localeCompare(b.week));
          }
          return json(settings);
        }
      }
      if (path.startsWith('/api/admin/presets')) {
        const presetId = parts[4];
        if (method === 'GET' && !presetId)
          return json([...presets].sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id)));
        if (method === 'POST' && !presetId) {
          const input = body as unknown as PresetInput;
          validatePreset(input);
          const preset = { ...input, id: id('preset') };
          presets.push(preset);
          recordAudit('preset.create', preset.id, null, preset);
          return json(preset, 201);
        }
        const preset = presets.find((p) => p.id === presetId) || fail(404, 'Preset not found');
        if (method === 'DELETE') {
          recordAudit('preset.delete', preset.id, preset, null);
          presets = presets.filter((p) => p !== preset);
          return empty();
        }
        if (method === 'PATCH') {
          const input = { ...preset, ...body } as PresetInput;
          validatePreset(input);
          const before = structuredClone(preset);
          Object.assign(preset, input, { id: presetId });
          recordAudit('preset.update', preset.id, before, preset);
          return json(preset);
        }
      }
      if (path.startsWith('/api/admin/plan')) {
        if (method === 'GET') return json(plan);
        if (method === 'PUT') {
          const input = body as unknown as Plan;
          if (!Array.isArray(input.slots) || !Array.isArray(input.totals))
            fail(400, 'Plan slots and totals required');
          input.slots.forEach(validateSlot);
          if (
            input.totals.some(
              (t) =>
                !t ||
                !['frosh', 'normal', 'u23'].includes(t.group_key) ||
                ![1, 2].includes(t.week) ||
                typeof t.label !== 'string' ||
                t.label.length > 200,
            )
          )
            fail(400, 'Invalid plan totals');
          if (
            new Set(
              input.slots.map((row) => [row.group_key, row.week, row.day, row.slot].join('/')),
            ).size !== input.slots.length ||
            new Set(input.totals.map((row) => [row.group_key, row.week].join('/'))).size !==
              input.totals.length
          )
            fail(400, 'Plan contains duplicate keys');
          const before = plan;
          plan = structuredClone(input);
          recordAudit('plan.replace', 'plan', before, plan);
          return json(plan);
        }
        if (method === 'POST') {
          const slot = body as unknown as PlanSlot;
          validateSlot(slot);
          const existing = plan.slots.find(
            (s) =>
              s.group_key === slot.group_key &&
              s.week === slot.week &&
              s.day === slot.day &&
              s.slot === slot.slot,
          );
          if (existing) Object.assign(existing, slot);
          else plan.slots.push(slot);
          return json(slot, 201);
        }
        if (method === 'DELETE' && parts.length === 8) {
          const previous = plan.slots.length;
          plan.slots = plan.slots.filter(
            (s) =>
              !(
                s.group_key === parts[4] &&
                s.week === Number(parts[5]) &&
                s.day === Number(parts[6]) &&
                s.slot === parts[7]
              ),
          );
          if (previous === plan.slots.length) fail(404, 'Plan slot not found');
          return empty();
        }
      }
      if (path === '/api/admin/recalculate' && method === 'POST') {
        let updated = 0;
        for (const entry of state.entries) {
          const meters = equivalentMeters(
            entry.distance_m,
            entry.modality,
            entry.zone,
            settings.mode_factors,
            settings.zone_factors,
          );
          if (
            entry.mode_factor !== settings.mode_factors[entry.modality] ||
            entry.zone_factor !== settings.zone_factors[entry.zone] ||
            entry.equiv_m !== meters
          )
            updated++;
          entry.mode_factor = settings.mode_factors[entry.modality];
          entry.zone_factor = settings.zone_factors[entry.zone];
          entry.equiv_m = equivalentMeters(
            entry.distance_m,
            entry.modality,
            entry.zone,
            settings.mode_factors,
            settings.zone_factors,
          );
        }
        audit.unshift({
          id: id('audit'),
          actor_id: user.id,
          action: 'entries.recalculate',
          target: 'entries',
          detail_json: JSON.stringify({ before: null, after: { updated } }),
          created_at: stamp(),
        });
        return json({ updated });
      }
      if (path === '/api/admin/compliance' && method === 'GET') {
        const week = url.searchParams.get('week') || weekStart(today(now()));
        if (!dateValid(week) || weekStart(week) !== week) fail(400, 'Week must be a Monday');
        return json(
          leaderboard(week, 'percent', true).map((row) => ({
            ...row,
            last_log:
              state.entries
                .filter((e) => e.user_id === row.user.id)
                .sort((a, b) => b.date.localeCompare(a.date))[0]?.date || null,
          })),
        );
      }
      if (path === '/api/admin/export' && method === 'GET') {
        const start = url.searchParams.get('start');
        const end = url.searchParams.get('end');
        if (!dateValid(start) || !dateValid(end) || start > end)
          fail(400, 'Valid start and end dates required');
        return new Response(
          [
            'date,week_start,name,email,group,modality,zone,distance_m,duration_s,avg_split_s,stroke_rate,avg_hr,mode_factor,zone_factor,equiv_m,visibility,title,notes,created_at',
            ...state.entries
              .filter((e) => e.date >= start && e.date <= end)
              .sort(
                (a, b) =>
                  a.date.localeCompare(b.date) ||
                  a.created_at.localeCompare(b.created_at) ||
                  a.id.localeCompare(b.id),
              )
              .map((e) =>
                [
                  e.date,
                  e.week_start,
                  userById(e.user_id).name,
                  userById(e.user_id).email,
                  userById(e.user_id).group_key,
                  e.modality,
                  e.zone,
                  e.distance_m,
                  e.duration_s ?? '',
                  e.avg_split_s ?? '',
                  e.stroke_rate ?? '',
                  e.avg_hr ?? '',
                  e.mode_factor,
                  e.zone_factor,
                  e.equiv_m,
                  e.visibility,
                  e.title,
                  e.notes,
                  e.created_at,
                ]
                  .map(quoteCsv)
                  .join(','),
              ),
          ].join('\r\n') + '\r\n',
          { headers: { 'Content-Type': 'text/csv' } },
        );
      }
      if (path === '/api/admin/audit' && method === 'GET')
        return json(paginate(audit, url.searchParams.get('cursor')));
      fail(404, 'Endpoint not found');
    } catch (error) {
      if (error instanceof MockError)
        return json({ error: { code: error.code, message: error.message } }, error.status);
      throw error;
    }
  }
  return { handle, state, passkeyPolicy };
}
