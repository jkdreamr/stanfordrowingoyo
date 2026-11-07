/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import type { Env } from './index';
import type {
  EntryDetail,
  MyPlan,
  MyPlanInput,
  MyPlanSessionInput,
  User,
} from '../../shared/types';
import { addDays } from '../../shared/dates';
import { equivalentMeters } from '../../shared/math';
import { migrate } from './db/migrate';
import { getSetting, setSetting } from './db/settings';
import { insertRosterFixture } from './testFixtures';
import { route } from './router';
import { allMyPlans } from './db/myPlan';

const bindings = env as unknown as Env;
const NOW = '2026-03-09T18:00:00Z';
const START = '2026-03-09';
type Client = { cookie: string; user: User };
function sql<T>(callback: (storage: DurableObjectStorage) => T): Promise<T> {
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
  const email = `${name.toLowerCase()}@example.com`;
  const id = await sql((storage) =>
    insertRosterFixture(storage, name, role, role === 'rower' ? null : email),
  );
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
function session(patch: Partial<MyPlanSessionInput> = {}): MyPlanSessionInput {
  return {
    week: 1,
    day: 0,
    slot: 'AM',
    modality: 'erg',
    zone: 'E',
    distance_m: 10000,
    note: ' Personal training ',
    ...patch,
  };
}
function plan(patch: Partial<MyPlanInput> = {}): MyPlanInput {
  return { start_date: START, sessions: [session()], rest_days: [], ...patch };
}
async function put(owner: Client, input = plan()) {
  const response = await api('/me/plan', owner, 'PUT', input);
  expect(response.status).toBe(200);
  return response.json<MyPlan>();
}
async function entry(
  owner: Client,
  date = START,
  modality = 'erg',
  time = date > START ? `${date}T18:00:00Z` : NOW,
  patch: Partial<Pick<EntryDetail, 'distance_m' | 'zone'>> = {},
) {
  const response = await api(
    '/entries',
    owner,
    'POST',
    {
      date,
      modality,
      zone: 'E',
      distance_m: 10000,
      title: 'Logged session',
      notes: '',
      ...patch,
    },
    time,
  );
  expect(response.status).toBe(201);
  return response.json<EntryDetail>();
}
beforeEach(async () => {
  await api('/health');
  await sql((storage) =>
    storage.transactionSync(() => {
      for (const table of [
        'my_plan_sessions',
        'my_plans',
        'roster',
        'users',
        'sessions',
        'settings',
        'weekly_targets',
        'rate_limits',
        'entries',
        'audit_log',
        'notifications',
        'push_subscriptions',
        'push_outbox',
      ])
        storage.sql.exec(`DELETE FROM ${table}`);
      migrate(storage);
      setSetting(storage, 'team_code', 'team-code');
    }),
  );
});

it('migrates v7 to v8 idempotently, retaining personal data on repeated migration', async () => {
  await sql((storage) => {
    storage.sql.exec('DROP TABLE my_plan_sessions; DROP TABLE my_plans;');
    setSetting(storage, 'schema_version', 7);
    migrate(storage);
    expect(getSetting(storage, 'schema_version')).toBe(15);
    storage.sql.exec('INSERT INTO my_plans VALUES (?,?,?,?)', 'owner', START, '[]', NOW);
    storage.sql.exec(
      'INSERT INTO my_plan_sessions VALUES (?,?,?,?,?,?,?,?,?)',
      'owner',
      START,
      1,
      0,
      'AM',
      'erg',
      'E',
      null,
      'Keep',
    );
    setSetting(storage, 'schema_version', 7);
    migrate(storage);
    migrate(storage);
    expect(storage.sql.exec('SELECT * FROM my_plans').toArray()).toHaveLength(1);
    expect(storage.sql.exec('SELECT note FROM my_plan_sessions').one().note).toBe('Keep');
    expect(
      storage.sql
        .exec(
          'EXPLAIN QUERY PLAN SELECT * FROM my_plans WHERE user_id = ? AND start_date BETWEEN ? AND ?',
          'owner',
          START,
          addDays(START, 13),
        )
        .toArray()
        .map((row) => row.detail)
        .join(' '),
    ).toContain('INDEX');
  });
});

it('isolates owner plans from teammates and staff with no alternate access route', async () => {
  const owner = await user('Owner');
  const teammate = await user('Teammate');
  const staff = await user('Staff', 'coach');
  await put(owner);
  for (const viewer of [teammate, staff]) {
    expect(await (await api('/me/plan', viewer)).json()).toBeNull();
    expect((await api(`/me/plan/${START}`, viewer, 'DELETE')).status).toBe(404);
    expect((await api(`/me/plan?user=${owner.user.id}`, viewer)).status).toBe(400);
    for (const path of [
      `/users/${owner.user.id}/plan`,
      `/admin/users/${owner.user.id}/plan`,
      '/admin/me/plan',
    ])
      expect((await api(path, viewer)).status).toBe(404);
    expect(await (await api(`/users/${owner.user.id}`, viewer)).text()).not.toContain(
      'Personal training',
    );
  }
  expect((await (await api('/me/plan', owner)).json<MyPlan>()).sessions).toHaveLength(1);
  await put(teammate, plan({ sessions: [session({ note: 'Teammate only' })] }));
  expect((await (await api('/me/plan', owner)).json<MyPlan>()).sessions[0].note).toBe(
    'Personal training',
  );
});

it('never exports personal plans or records their creation, replacement or deletion in audit', async () => {
  const owner = await user('Owner');
  const staff = await user('Staff', 'admin');
  const logged = await entry(owner);
  const auditBefore = await (await api('/admin/audit', staff)).text();
  const exportBefore = await (
    await api('/admin/export?start=2026-03-01&end=2026-03-31', staff)
  ).text();
  expect(exportBefore).toContain(logged.title);
  await put(owner);
  const secretPlan = plan({ sessions: [session({ note: 'SECRET PERSONAL PLAN' })] });
  await put(owner, secretPlan);
  await api('/me/plan', owner);
  const exportAfter = await api('/admin/export?start=2026-03-01&end=2026-03-31', staff);
  expect(exportAfter.status).toBe(200);
  expect(await exportAfter.text()).toBe(exportBefore);
  expect((await api(`/me/plan/${START}`, owner, 'DELETE')).status).toBe(204);
  expect(await (await api('/admin/audit', staff)).text()).toBe(auditBefore);
  expect(await (await api('/me/plan', owner)).json()).toBeNull();
  expect((await api(`/me/plan/${START}`, owner, 'DELETE')).status).toBe(404);
  expect(
    await sql((storage) => storage.sql.exec('SELECT * FROM my_plan_sessions').toArray().length),
  ).toBe(0);
});

it.each([
  { start_date: '2026-03-10' },
  { start_date: '2026-02-30' },
  { start_date: 'not-a-date' },
  { sessions: null },
  { rest_days: null },
  { sessions: Array(43).fill(session()) },
  { rest_days: Array(15).fill({ week: 1, day: 0 }) },
  { sessions: [session(), session()] },
  {
    rest_days: [
      { week: 1, day: 0 },
      { week: 1, day: 0 },
    ],
  },
  { rest_days: [{ week: 1, day: 0 }] },
  { rest_days: [{ week: 3, day: 0 }] },
  { rest_days: [{ week: 1, day: -1 }] },
  { rest_days: [null] },
])('rejects invalid plan structure with the standard error shape: %j', async (patch) => {
  const owner = await user('Owner');
  const response = await api('/me/plan', owner, 'PUT', { ...plan(), ...patch });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    error: { code: 'VALIDATION_ERROR', message: expect.any(String) },
  });
  expect(await (await api('/me/plan', owner)).json()).toBeNull();
});

it.each([
  { week: 0 },
  { week: 3 },
  { week: 1.5 },
  { day: -1 },
  { day: 7 },
  { day: 0.5 },
  { slot: 'PM3' },
  { modality: 'swim' },
  { zone: 'F' },
  { distance_m: 0 },
  { distance_m: 200001 },
  { distance_m: 1.1 },
  { distance_m: '1000' },
  { note: null },
  { note: 'x'.repeat(201) },
])('rejects invalid session fields: %j', async (patch) => {
  const owner = await user('Owner');
  const response = await api('/me/plan', owner, 'PUT', {
    ...plan(),
    sessions: [{ ...session(), ...patch }],
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
});

it('accepts empty plans, all rest days, nullable distances, boundaries and trimmed notes', async () => {
  const owner = await user('Owner');
  const rest_days = [1, 2].flatMap((week) =>
    Array.from({ length: 7 }, (_, day) => ({ week: week as 1 | 2, day })),
  );
  expect(await put(owner, plan({ sessions: [], rest_days }))).toMatchObject({
    sessions: [],
    rest_days,
    planned_m: [0, 0],
  });
  const result = await put(
    owner,
    plan({
      sessions: [
        session({ distance_m: null }),
        session({ slot: 'PM1', distance_m: 1 }),
        session({ slot: 'PM2', distance_m: 200000, note: ` ${'x'.repeat(200)} ` }),
      ],
    }),
  );
  expect(result.sessions.map((row) => row.equiv_m)).toEqual([null, 1, 200000]);
  expect(result.sessions[0].note).toBe('Personal training');
  expect(result.sessions[2].note).toHaveLength(200);
  expect(result.planned_m).toEqual([200001, 0]);
});

it('rejects overlap in both directions, permits same-start replacement and ±14-day neighbours', async () => {
  const owner = await user('Owner');
  await put(owner);
  for (const offset of [-7, 7])
    expect(
      (await api('/me/plan', owner, 'PUT', plan({ start_date: addDays(START, offset) }))).status,
    ).toBe(409);
  const replacement = await put(owner, plan({ sessions: [], rest_days: [{ week: 2, day: 6 }] }));
  expect(replacement.sessions).toEqual([]);
  expect(replacement.rest_days).toEqual([{ week: 2, day: 6 }]);
  for (const offset of [-14, 14]) await put(owner, plan({ start_date: addDays(START, offset) }));
  expect(await sql((storage) => storage.sql.exec('SELECT * FROM my_plans').toArray().length)).toBe(
    3,
  );
  expect((await (await api('/me/plan', owner)).json<MyPlan>()).sessions).toEqual([]);
});

it('uses inclusive 14-day workout windows and Los Angeles today, rejecting malformed dates', async () => {
  const owner = await user('Owner');
  await put(owner);
  for (const date of [START, addDays(START, 13)])
    expect((await (await api(`/me/plan?date=${date}`, owner)).json<MyPlan>()).start_date).toBe(
      START,
    );
  for (const date of [addDays(START, -1), addDays(START, 14)])
    expect(await (await api(`/me/plan?date=${date}`, owner)).json()).toBeNull();
  expect(
    await (await api('/me/plan', owner, 'GET', undefined, '2026-03-09T01:00:00Z')).json(),
  ).toBeNull();
  expect((await (await api('/me/plan', owner)).json<MyPlan>()).start_date).toBe(START);
  for (const date of ['', '2026-02-30', '2026-3-9', 'invalid'])
    expect((await api(`/me/plan?date=${date}`, owner)).status).toBe(400);
  expect((await api('/me/plan/2026-03-10', owner, 'DELETE')).status).toBe(400);
});

it.each([
  { distance: 100, zone: 'R' as const, planned: 9000, plannedZone: 'D' as const, complete: false },
  { distance: 8000, zone: 'E' as const, planned: 10000, plannedZone: 'E' as const, complete: true },
  {
    distance: 7900,
    zone: 'E' as const,
    planned: 10000,
    plannedZone: 'E' as const,
    complete: false,
  },
  { distance: 100, zone: 'R' as const, planned: null, plannedZone: 'D' as const, complete: true },
])(
  'requires qualifying E-meters: $distance $zone against $planned $plannedZone',
  async ({ distance, zone, planned, plannedZone, complete }) => {
    const owner = await user('Owner');
    const workout = await entry(owner, START, 'erg', NOW, { distance_m: distance, zone });
    await put(owner, plan({ sessions: [session({ distance_m: planned, zone: plannedZone })] }));
    const result = await (await api('/me/plan', owner)).json<MyPlan>();
    expect(result.sessions[0].completed_entry_id).toBe(complete ? workout.id : null);
    expect(
      await sql((storage) => allMyPlans(storage, owner.user.id)[0].sessions[0].completed_entry_id),
    ).toBe(complete ? workout.id : null);
  },
);

it('skips small entries without consuming them so later smaller sessions can match', async () => {
  const owner = await user('Owner');
  const small = await entry(owner, START, 'erg', '2026-03-09T17:00:00Z', { distance_m: 1000 });
  const big = await entry(owner, START, 'erg', NOW, { distance_m: 8000 });
  await put(owner, plan({ sessions: [session({ slot: 'PM1', distance_m: 1000 }), session()] }));
  let result = await (await api('/me/plan', owner)).json<MyPlan>();
  expect(result.sessions.map((row) => row.completed_entry_id)).toEqual([big.id, small.id]);
  expect((await api(`/entries/${big.id}`, owner, 'DELETE')).status).toBe(204);
  result = await (await api('/me/plan', owner)).json<MyPlan>();
  expect(result.sessions.map((row) => row.completed_entry_id)).toEqual([null, small.id]);
});

it('does not reserve an older big entry for a later session when AM qualifies for it', async () => {
  const owner = await user('Owner');
  const big = await entry(owner, START, 'erg', '2026-03-09T17:00:00Z', { distance_m: 8000 });
  await entry(owner, START, 'erg', NOW, { distance_m: 1000 });
  await put(owner, plan({ sessions: [session({ slot: 'PM1' }), session({ distance_m: 1000 })] }));
  const result = await (await api('/me/plan', owner)).json<MyPlan>();
  expect(result.sessions.map((row) => row.completed_entry_id)).toEqual([big.id, null]);
});

it('greedily matches owner workouts by workout date and modality in slot and creation/id order', async () => {
  const owner = await user('Owner');
  const other = await user('Other');
  const last = await entry(owner, addDays(START, 13));
  await entry(other);
  await entry(owner, addDays(START, -1));
  await entry(owner, addDays(START, 14));
  const run = await entry(owner, START, 'run');
  const first = await entry(owner);
  await sql((storage) =>
    storage.sql.exec(
      'UPDATE entries SET created_at = ? WHERE id = ?',
      '2026-03-01T00:00:00Z',
      first.id,
    ),
  );
  await put(
    owner,
    plan({
      sessions: [
        session({ slot: 'PM1' }),
        session({ slot: 'PM2', modality: 'bike' }),
        session(),
        session({ day: 1 }),
        session({ week: 2, day: 6 }),
      ],
    }),
  );
  let result = await (await api('/me/plan', owner)).json<MyPlan>();
  expect(result.sessions.map((row) => row.completed_entry_id)).toEqual([
    first.id,
    null,
    null,
    null,
    last.id,
  ]);
  const second = await entry(owner);
  const third = await entry(owner);
  await sql((storage) =>
    storage.sql.exec(
      'UPDATE entries SET created_at = ? WHERE id IN (?,?)',
      NOW,
      second.id,
      third.id,
    ),
  );
  result = await (await api('/me/plan', owner)).json<MyPlan>();
  expect(result.sessions.slice(0, 3).map((row) => row.completed_entry_id)).toEqual([
    first.id,
    [second.id, third.id].sort()[0],
    null,
  ]);
  expect(result.sessions.some((row) => row.completed_entry_id === run.id)).toBe(false);
  expect((await api(`/entries/${first.id}`, owner, 'DELETE')).status).toBe(204);
  result = await (await api('/me/plan', owner)).json<MyPlan>();
  expect(result.sessions[0].completed_entry_id).toBe([second.id, third.id].sort()[0]);
  expect(result.sessions.some((row) => row.completed_entry_id === first.id)).toBe(false);
});

it('recomputes equivalents and per-week sums from current settings without recalculating entries', async () => {
  const owner = await user('Owner');
  const staff = await user('Staff', 'admin');
  const result = await put(
    owner,
    plan({
      sessions: [
        session({ modality: 'bike', zone: 'D', distance_m: 10001 }),
        session({ week: 2, distance_m: null }),
        session({ week: 2, slot: 'PM1', modality: 'run', distance_m: 1234 }),
      ],
    }),
  );
  expect(result.planned_m).toEqual([
    equivalentMeters(10001, 'bike', 'D'),
    equivalentMeters(1234, 'run', 'E'),
  ]);
  const response = await api('/admin/settings', staff, 'PATCH', {
    mode_factors: { erg: 1, bike: 0.5, run: 2 },
    zone_factors: {
      R: 0.8,
      'R/E': 0.9,
      E: 1,
      'E/D': 1.15,
      D: 2,
      'D/C': 1.6,
      C: 2.1,
      'C/B': 3,
      B: 5,
      A: 9,
    },
  });
  expect(response.status).toBe(200);
  const updated = await (await api('/me/plan', owner)).json<MyPlan>();
  expect(updated.planned_m).toEqual([10001, 2468]);
  expect(updated.sessions[1].equiv_m).toBeNull();
  expect(updated.updated_at).toBe(result.updated_at);
});

it('uses the same total GET SQL count for 1 session/0 entries and 42 sessions/30 entries', async () => {
  const owner = await user('Owner');
  await put(owner);
  async function count() {
    return sql(async (storage) => {
      const queries: string[] = [];
      const tracedSql = new Proxy(storage.sql, {
        get(target, key) {
          if (key === 'exec')
            return (...args: Parameters<SqlStorage['exec']>) => {
              queries.push(args[0]);
              return target.exec(...args);
            };
          const value = Reflect.get(target, key, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      const traced = new Proxy(storage, {
        get(target, key) {
          if (key === 'sql') return tracedSql;
          const value = Reflect.get(target, key, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      const response = await route({
        request: new Request('https://oyo.test/api/me/plan', { headers: { Cookie: owner.cookie } }),
        storage: traced,
        env: bindings,
        now: new Date(NOW),
        params: {},
      });
      expect(response.status).toBe(200);
      return { queries, sessions: (await response.json<MyPlan>()).sessions.length };
    });
  }
  const small = await count();
  const sessions = ([1, 2] as const)
    .flatMap((week) =>
      Array.from({ length: 7 }, (_, day) =>
        (['AM', 'PM1', 'PM2'] as const).map((slot) => session({ week, day, slot })),
      ),
    )
    .flat();
  await put(owner, plan({ sessions }));
  for (let i = 0; i < 30; i++) await entry(owner, addDays(START, i % 14));
  const large = await count();
  expect(small.sessions).toBe(1);
  expect(large.sessions).toBe(42);
  expect(large.queries).toHaveLength(small.queries.length);
  expect(large.queries.length).toBeLessThan(20);
  expect(large.queries.filter((query) => query.includes('FROM entries'))).toHaveLength(1);
});

it('uses the same unauthenticated and deactivated-user protections as other /me routes', async () => {
  const owner = await user('Owner');
  await put(owner);
  await sql((storage) =>
    storage.sql.exec('UPDATE users SET active = 0 WHERE id = ?', owner.user.id),
  );
  for (const client of [undefined, owner])
    for (const [method, path, body] of [
      ['GET', '/me/plan', undefined],
      ['PUT', '/me/plan', plan()],
      ['DELETE', `/me/plan/${START}`, undefined],
    ] as const) {
      const response = await api(path, client, method, body);
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    }
  expect((await api('/me', owner)).status).toBe(401);
});
