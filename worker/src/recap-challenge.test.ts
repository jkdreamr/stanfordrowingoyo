/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import type { Env } from './index';
import type { ErgTest, TeamChallenge, User, Entry, WeeklyRecap } from '../../shared/types';
import type { Row } from './db/row';
import { migrateLegacyFixture as migrate } from './migrationFixture';
import { setSetting, getSetting } from './db/settings';
import { insertRosterFixture } from './testFixtures';
import { list as challengeList } from './routes/challenges';
import type { Context } from './context';
const bindings = env as unknown as Env;
const NOW = '2026-03-16T18:00:00Z';
type Client = { cookie: string; user: User };
async function sql<T>(callback: (storage: DurableObjectStorage) => T) {
  return runInDurableObject(
    bindings.TEAM.get(bindings.TEAM.idFromName('stanford')),
    (_instance, state) => callback(state.storage),
  );
}
function api(path: string, client?: Client, method = 'GET', body?: unknown, time = NOW) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method,
    headers: {
      'X-OYO-CSRF': '1',
      'X-OYO-Test-Now': time,
      ...(client ? { Cookie: client.cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function user(name: string, role = 'rower'): Promise<Client> {
  const email = name + '@example.com';
  const id = await sql((s) => insertRosterFixture(s, name, role, role === 'rower' ? null : email));
  const response = await api('/auth/signup', undefined, 'POST', {
    roster_id: id,
    email,
    password: 'password123',
    team_code: 'team-code',
  });
  expect(response.status).toBe(201);
  return {
    cookie: response.headers.get('Set-Cookie')!.split(';')[0],
    user: await response.json<User>(),
  };
}
beforeEach(async () => {
  await api('/health');
  await sql((s) => {
    for (const table of [
      'erg_tests',
      'challenges',
      'entries',
      'users',
      'sessions',
      'roster',
      'rate_limits',
      'weekly_targets',
      'audit_log',
      'game_results',
      'my_plans',
      'my_plan_sessions',
    ])
      s.sql.exec(`DELETE FROM ${table}`);
    setSetting(s, 'team_code', 'team-code');
  });
});
const challenge = {
  title: ' Team kilometers ',
  unit: 'km',
  goal_m: 10000,
  modality: null,
  start_date: '2026-03-09',
  end_date: '2026-03-22',
};
async function entry(client: Client, patch: Record<string, unknown> = {}) {
  const response = await api('/entries', client, 'POST', {
    date: '2026-03-09',
    modality: 'bike',
    zone: 'E',
    distance_m: 30000,
    title: 'Ride',
    notes: '',
    visibility: 'team',
    ...patch,
  });
  expect(response.status).toBe(201);
  return response.json<Entry>();
}
it('backfills v9 best splits on team-local date and is idempotent', async () => {
  const a = await user('legacy');
  await sql((s) => {
    s.sql.exec(
      'UPDATE users SET best2k_split_s=100,best6k_split_s=110,updated_at=? WHERE id=?',
      '2026-03-10T02:00:00Z',
      a.user.id,
    );
    setSetting(s, 'schema_version', 9);
    s.sql.exec('DROP TABLE erg_tests; DROP TABLE challenges; DROP INDEX entries_date');
    migrate(s);
    setSetting(s, 'schema_version', 9);
    migrate(s);
    migrate(s);
    expect(getSetting(s, 'schema_version')).toBe(20);
    const rows = s.sql.exec<Row<ErgTest>>('SELECT * FROM erg_tests ORDER BY kind').toArray();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ date: '2026-03-09', time_s: 400, split_s: 100 });
    expect(rows[1].time_s).toBe(1320);
  });
});
it('test CRUD derives minima and date-ordered PRs, compatibility, ownership and empty history', async () => {
  const a = await user('athlete'),
    b = await user('other');
  expect(await (await api('/users/' + a.user.id + '/tests', b)).json()).toEqual([]);
  const create = async (date: string, split_s: number) => {
    const r = await api('/me/tests', a, 'POST', { kind: '2k', date, split_s });
    expect(r.status).toBe(201);
    return r.json<ErgTest>();
  };
  const first = await create('2026-03-01', 105);
  const second = await create('2026-03-02', 100);
  await create('2026-03-03', 100);
  expect(
    (await (await api('/users/' + a.user.id + '/tests', b)).json<ErgTest[]>()).map((r) => r.is_pr),
  ).toEqual([false, true, true]);
  expect((await api('/me/tests/' + second.id, b, 'DELETE')).status).toBe(404);
  expect((await api('/me/tests/' + second.id, a, 'PATCH', { time_s: 440 })).status).toBe(200);
  expect((await (await api('/me', a)).json<User>()).best2k_split_s).toBe(100);
  await api('/me', a, 'PATCH', { best2k_split_s: 120, best6k_split_s: 115 });
  expect(
    (await (await api('/me', a, 'PATCH', { best2k_split_s: null })).json<User>()).best2k_split_s,
  ).toBe(100);
  const rows = await (await api('/users/' + a.user.id + '/tests', a)).json<ErgTest[]>();
  for (const row of rows) expect((await api('/me/tests/' + row.id, a, 'DELETE')).status).toBe(204);
  expect((await (await api('/me', a)).json<User>()).best2k_split_s).toBeNull();
  expect((await api('/me/tests/' + first.id, a, 'PATCH', {})).status).toBe(404);
});
it('validates test inputs and 200 row limit', async () => {
  const a = await user('validation');
  for (const body of [
    { kind: '2k', date: '2026-03-17', split_s: 100 },
    { kind: '2k', date: '1999-01-01', split_s: 100 },
    { kind: '2k', date: '2026-02-30', split_s: 100 },
    { kind: '2k', date: '2026-03-01', split_s: 59 },
    { kind: '2k', date: '2026-03-01', time_s: 400, split_s: 100 },
    { kind: '3k', date: '2026-03-01', split_s: 100 },
    { kind: '2k', date: '2026-03-01' },
  ])
    expect((await api('/me/tests', a, 'POST', body)).status).toBe(400);
  await sql((s) => {
    for (let i = 0; i < 200; i++)
      s.sql.exec(
        'INSERT INTO erg_tests VALUES (?,?,?,?,?,?,?,?)',
        String(i),
        a.user.id,
        '2k',
        '2026-03-01',
        400,
        100,
        NOW,
        NOW,
      );
  });
  expect(
    (await api('/me/tests', a, 'POST', { kind: '2k', date: '2026-03-01', split_s: 100 })).status,
  ).toBe(400);
});
it('recaps own completed week with team rank, ties, streak and defaults', async () => {
  const a = await user('recap'),
    b = await user('teammate');
  await sql((s) => {
    setSetting(s, 'group_targets', { frosh: 10000, normal: 10000, u23: 10000 });
    setSetting(s, 'group_target_history', [
      { week_start: '2000-01-01', targets: { frosh: 10000, normal: 10000, u23: 10000 } },
    ]);
  });
  const best = await entry(a);
  await entry(b, { distance_m: 60000 });
  await entry(a, { date: '2026-03-02' });
  const recap = await (await api('/stats/recap', a)).json<WeeklyRecap>();
  expect(recap).toMatchObject({
    week_start: '2026-03-09',
    total_m: 10000,
    target_m: 10000,
    percent: 100,
    hit_target: true,
    entry_count: 1,
    streak: 2,
    rank: 2,
    by_modality: { bike: 10000, erg: 0, run: 0 },
    team: { total_m: 30000, entry_count: 2, rowers: 2, rowers_hit_target: 2 },
    best_effort: { id: best.id },
  });
  expect(await (await api('/stats/recap?week=2026-03-12', a)).json()).toEqual(recap);
  for (const date of ['2026-03-16', '2026-03-23', 'bad', '2026-02-30'])
    expect((await api('/stats/recap?week=' + date, a)).status).toBe(400);
  await sql((s) => s.sql.exec('UPDATE users SET on_leaderboard=0 WHERE id=?', a.user.id));
  expect(await (await api('/stats/recap?week=2026-02-01', a)).json<WeeklyRecap>()).toMatchObject({
    total_m: 0,
    entry_count: 0,
    streak: 0,
    best_effort: null,
    rank: null,
  });
});
it('recaps the final race, My Fortnight week and games highlights in one response', async () => {
  const a = await user('recap'),
    b = await user('quiet');
  await sql((s) => {
    setSetting(s, 'group_targets', { frosh: 10000, normal: 10000, u23: 10000 });
    setSetting(s, 'group_target_history', [
      { week_start: '2000-01-01', targets: { frosh: 10000, normal: 10000, u23: 10000 } },
    ]);
    const game = (id: string, date: string, score: number, payload: unknown = {}) =>
      s.sql.exec(
        'INSERT INTO game_results VALUES (?,?,?,?,?,?,?)',
        id,
        date,
        a.user.id,
        score,
        JSON.stringify(payload),
        NOW,
        NOW,
      );
    game('perception', '2026-03-08', 300);
    game('dive', '2026-03-10', 40);
    game('dive', '2026-03-12', 70);
    game('wordguess', '2026-03-14', 4, { solved: true, tries: 3 });
    game('wordguess', '2026-03-15', 0, { solved: false, tries: 6 });
    game('perception', '2026-03-15', 410);
    game('connections', '2026-03-16', 8);
    s.sql.exec(
      'INSERT INTO game_results VALUES (?,?,?,?,?,?,?)',
      'dive',
      '2026-03-15',
      b.user.id,
      80,
      '{}',
      NOW,
      NOW,
    );
  });
  await entry(a);
  await entry(b, { distance_m: 15000 });
  const put = await api('/me/plan', a, 'PUT', {
    start_date: '2026-03-02',
    rest_days: [],
    sessions: [
      { week: 1, day: 0, slot: 'AM', modality: 'erg', zone: 'E', distance_m: 20000, note: '' },
      { week: 2, day: 1, slot: 'AM', modality: 'erg', zone: 'E', distance_m: 8000, note: '' },
    ],
  });
  expect(put.status).toBe(200);
  const recap = await (await api('/stats/recap', a)).json<WeeklyRecap>();
  expect(recap.race).toMatchObject({
    week_start: '2026-03-09',
    status: 'final',
    rowers: 2,
    stanford_m: 15000,
    target_m: 20000,
    berkeley_total_m: 18000,
    berkeley_m: 18000,
  });
  expect(recap.plan).toEqual({
    start_date: '2026-03-02',
    week: 2,
    planned_m: 8000,
    logged_m: 10000,
    complete: true,
  });
  expect(recap.games).toEqual({
    played: 3,
    days: 2,
    best_dive: null,
    word_guess_solves: 1,
    streak: 2,
  });
  const earlier = await (await api('/stats/recap?week=2026-03-02', a)).json<WeeklyRecap>();
  expect(earlier.plan).toMatchObject({ week: 1, planned_m: 20000, logged_m: 0, complete: false });
  expect(earlier.games).toEqual({
    played: 1,
    days: 1,
    best_dive: null,
    word_guess_solves: 0,
    streak: 1,
  });
  const quiet = await (await api('/stats/recap', b)).json<WeeklyRecap>();
  expect(
    await sql((s) => s.sql.exec("SELECT game_id FROM game_results WHERE game_id='dive'").toArray()),
  ).toHaveLength(3);
  expect(quiet.plan).toBeNull();
  expect(quiet.games).toEqual({
    played: 0,
    days: 0,
    best_dive: null,
    word_guess_solves: 0,
    streak: 0,
  });
  await sql((s) => s.sql.exec("UPDATE users SET role='coach'"));
  expect((await (await api('/stats/recap', a)).json<WeeklyRecap>()).race).toBeNull();
});
it('challenge staff CRUD, progress units/filter/bounds and invalidation', async () => {
  const a = await user('rower'),
    staff = await user('coach', 'coach');
  expect((await api('/challenges')).status).toBe(401);
  expect((await api('/admin/challenges', a, 'POST', challenge)).status).toBe(403);
  expect(await (await api('/challenges', a)).json()).toEqual([]);
  const response = await api('/admin/challenges', staff, 'POST', challenge);
  expect(response.status).toBe(201);
  const c = await response.json<TeamChallenge>();
  expect(c).toMatchObject({ title: 'Team kilometers', status: 'active', progress_m: 0 });
  const view = async () => (await (await api('/challenges', a)).json<TeamChallenge[]>())[0];
  const e = await entry(a);
  expect((await view()).progress_m).toBe(30000);
  expect((await view()).percent).toBe(300);
  await entry(a, { date: '2026-03-08' });
  expect((await view()).progress_m).toBe(30000);
  await api('/entries/' + e.id, a, 'PATCH', { distance_m: 60000 });
  expect((await view()).progress_m).toBe(60000);
  await api('/admin/challenges/' + c.id, staff, 'PATCH', { unit: 'emeters' });
  expect((await view()).progress_m).toBe(20000);
  await api('/admin/challenges/' + c.id, staff, 'PATCH', { modality: 'erg' });
  expect((await view()).progress_m).toBe(0);
  await api('/admin/challenges/' + c.id, staff, 'PATCH', { modality: null });
  await api('/entries/' + e.id, a, 'DELETE');
  expect((await view()).progress_m).toBe(0);
  expect(
    (
      await (
        await api('/challenges', a, 'GET', undefined, '2026-03-01T18:00:00Z')
      ).json<TeamChallenge[]>()
    )[0].status,
  ).toBe('upcoming');
  expect(
    await (await api('/challenges', a, 'GET', undefined, '2026-03-23T18:00:00Z')).json(),
  ).toEqual([]);
  expect(
    (
      await api(
        '/admin/challenges/' + c.id,
        staff,
        'PATCH',
        { title: 'no' },
        '2026-03-23T18:00:00Z',
      )
    ).status,
  ).toBe(409);
  const ended = await (
    await api('/admin/challenges/' + c.id + '/end', staff, 'POST')
  ).json<TeamChallenge>();
  expect(
    (await (await api('/admin/challenges/' + c.id + '/end', staff, 'POST')).json<TeamChallenge>())
      .ended_at,
  ).toBe(ended.ended_at);
  expect(await (await api('/challenges', a)).json()).toEqual([]);
  expect((await api('/admin/challenges/' + c.id, staff, 'DELETE')).status).toBe(204);
  expect((await api('/admin/challenges/' + c.id, staff, 'DELETE')).status).toBe(404);
  await sql((s) =>
    expect(
      s.sql.exec("SELECT * FROM audit_log WHERE action LIKE 'challenge.%'").toArray().length,
    ).toBeGreaterThanOrEqual(7),
  );
});
it('rejects invalid challenges', async () => {
  const staff = await user('validator', 'coach');
  for (const patch of [
    { title: ' ' },
    { title: 'a'.repeat(61) },
    { goal_m: 0 },
    { goal_m: 1.5 },
    { goal_m: 1000000001 },
    { unit: 'points' },
    { modality: 'swim' },
    { start_date: '2026-02-30' },
    { end_date: '2026-03-08' },
    { end_date: '2027-03-11' },
  ])
    expect((await api('/admin/challenges', staff, 'POST', { ...challenge, ...patch })).status).toBe(
      400,
    );
});
it('serves warm challenge progress with no entry scan and uses the date index on misses', async () => {
  const staff = await user('cache', 'coach');
  await api('/admin/challenges', staff, 'POST', challenge);
  await entry(staff);
  await sql(async (s) => {
    const calls: { query: string; binds: (string | number | null)[] }[] = [];
    const tracedSql = new Proxy(s.sql, {
      get(target, key) {
        if (key === 'exec')
          return (query: string, ...binds: (string | number | null)[]) => {
            calls.push({ query, binds });
            return target.exec(query, ...binds);
          };
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const storage = new Proxy(s, {
      get(target, key) {
        if (key === 'sql') return tracedSql;
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const tokenHash = s.sql
      .exec<{ token_hash: string }>(
        'SELECT token_hash FROM sessions WHERE user_id=?',
        staff.user.id,
      )
      .one().token_hash;
    const ctx: Context = {
      storage,
      env: bindings,
      request: new Request('https://oyo.test/api/challenges'),
      now: new Date(NOW),
      params: {},
      tokenHash,
    };
    expect((await challengeList(ctx).json<TeamChallenge[]>())[0].progress_m).toBe(30000);
    const scan = calls.find((call) => call.query.includes('SUM('))!;
    expect(
      s.sql
        .exec<{ detail: string }>('EXPLAIN QUERY PLAN ' + scan.query, ...scan.binds)
        .toArray()
        .map((row) => row.detail)
        .join(' '),
    ).toContain('entries_date');
    calls.length = 0;
    challengeList(ctx);
    expect(calls.some((call) => /FROM entries/i.test(call.query))).toBe(false);
    s.sql.exec('UPDATE entries SET distance_m=40000');
    expect((await challengeList(ctx).json<TeamChallenge[]>())[0].progress_m).toBe(40000);
    expect(calls.some((call) => /FROM entries/i.test(call.query))).toBe(true);
  });
});
