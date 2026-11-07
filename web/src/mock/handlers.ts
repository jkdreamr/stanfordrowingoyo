import type {
  AnnouncementInput,
  AuditLog,
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
} from '../../../shared/types';
import { addDays, seasonRange, today, weekStart, yearRange } from '../../../shared/dates';
import { equivalentMeters, MODE_FACTORS, ZONE_FACTORS, ZONES } from '../../../shared/math';
import { GROUP_TARGETS, PLAN_SLOTS, PLAN_TOTALS, PRESETS } from '../../../shared/seed';
import { createFixtures, publicUser } from './fixtures';
import { mentionIds } from '../lib/social';
import { generatedImage } from './images';
import { previewRoster } from '../pages/admin/roster';
import { factorError, seasonError, targetError } from '../pages/admin/operations';
import { personalPlan, covers } from '../lib/myPlan';
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
  let currentId = session;
  let sequence = 100000;
  let settings: Settings = {
    team_code: 'cardinal-oyo',
    mode_factors: { ...MODE_FACTORS },
    zone_factors: { ...ZONE_FACTORS },
    group_targets: { ...GROUP_TARGETS },
    season_start: '09-01',
  };
  let presets = structuredClone(PRESETS);
  let plan: Plan = { slots: structuredClone(PLAN_SLOTS), totals: structuredClone(PLAN_TOTALS) };
  const roster: RosterRow[] = state.roster;
  const audit: AuditLog[] = [];
  const groupHistory = [{ week: '0000-01-01', targets: { ...settings.group_targets } }];
  const uploads = new Map<string, { blob: Blob; owner: string }>();
  const passwords = new Map(state.users.map((u) => [u.id, 'password']));
  const credentialVersions = new Map<string, number>();
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
  function notify(userId: string, kind: Notification['kind'], entry: Entry | null) {
    if (userId === me().id || !userById(userId).active) return;
    state.notifications.unshift({
      id: id('notification'),
      user_id: userId,
      actor_id: me().id,
      actor: publicUser(me()),
      kind,
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
      if (path === '/api/health' && method === 'GET') return json({ ok: true, schema_version: 9 });
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
      if (
        user.must_change_password &&
        !['/api/me/password', '/api/me/password/verify', '/api/me'].includes(path)
      )
        fail(403, 'Change your temporary password first');
      if (path.startsWith('/api/admin/')) requireStaff();
      if (
        method !== 'GET' &&
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
          for (const key of [
            'name',
            'bio',
            'side',
            'class_year',
            'group_key',
            'best6k_split_s',
            'best2k_split_s',
            'avatar_image_id',
          ])
            if (key in body) Object.assign(user, { [key]: body[key] });
          user.updated_at = stamp();
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
      if (parts[2] === 'comments' && method === 'DELETE') {
        const comment =
          state.comments.find((c) => c.id === resourceId) || fail(404, 'Comment not found');
        own(comment.user_id);
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
          for (const u of state.users) notify(u.id, 'announcement', null);
          return json(announcement, 201);
        }
        const announcement =
          state.announcements.find((a) => a.id === resourceId) ||
          fail(404, 'Announcement not found');
        if (method === 'DELETE') {
          recordAudit('announcement.delete', announcement.id, announcement, null);
          state.announcements.splice(state.announcements.indexOf(announcement), 1);
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
            .filter((n) => n.user_id === user.id)
            .sort((a, b) => b.created_at.localeCompare(a.created_at)),
        );
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
        const quote = (value: unknown) => {
          let text = value == null ? '' : String(value);
          if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
          return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
        };
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
                  .map(quote)
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
  return { handle, state };
}
