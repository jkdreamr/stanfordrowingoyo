/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import type { EntryDetail, LeaderboardRow, User, WeekStats } from '../../shared/types';
import { today } from '../../shared/dates';
import type { Env } from './index';
import { leaderboard, uncachedLeaderboard } from './db/stats';
import { getSetting, setSetting } from './db/settings';
import { migrate } from './db/migrate';
import { insertRosterFixture } from './testFixtures';
import { byId } from './db/users';
import { route } from './router';

const bindings = env as unknown as Env;
const stub = () => bindings.TEAM.get(bindings.TEAM.idFromName('stanford'));
const INITIAL = '2026-08-30T18:00:00Z';
let now = INITIAL;
type Client = { cookie: string; user: User; roster: string };
function sql<T>(fn: (storage: DurableObjectStorage) => T) {
  return runInDurableObject(stub(), (_, state) => fn(state.storage));
}
function api(path: string, client?: Client, method = 'GET', body?: unknown) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-OYO-CSRF': '1',
      'X-OYO-Test-Now': now,
      ...(client ? { Cookie: client.cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function mutate(path: string, client: Client, method: string, body?: unknown) {
  const response = await api(path, client, method, body);
  expect(response.status, path + ' ' + (await response.clone().text())).toBeLessThan(300);
  return response;
}
async function signup(name: string, owner?: Client, roster?: string): Promise<Client> {
  roster ??= owner
    ? (
        await (
          await mutate('/admin/roster', owner, 'POST', { name, role: 'rower' })
        ).json<{ id: string }>()
      ).id
    : await sql((s) => insertRosterFixture(s, name, 'admin', name + '@example.com'));
  const response = await api('/auth/signup', undefined, 'POST', {
    roster_id: roster,
    email: name + '@example.com',
    password: 'password123',
    team_code: 'koo26',
    group_key: 'normal',
  });
  expect(response.status, await response.clone().text()).toBe(201);
  return {
    cookie: response.headers.get('Set-Cookie')!.split(';')[0],
    user: await response.json<User>(),
    roster,
  };
}
async function create(client: Client, distance = 12000) {
  return (
    await mutate('/entries', client, 'POST', {
      date: today(new Date(now)),
      modality: 'erg',
      zone: 'E',
      distance_m: distance,
      title: 'Training',
      notes: '',
    })
  ).json<EntryDetail>();
}
beforeEach(async () => {
  now = INITIAL;
  await api('/health');
  await sql((s) => {
    for (const table of ['roster', 'users', 'sessions', 'entries', 'weekly_targets', 'rate_limits'])
      s.sql.exec(`DELETE FROM ${table}`);
  });
});

it('matches uncached results after a seeded random sequence of real HTTP mutations and clock rollovers', async () => {
  const owner = await signup('Owner');
  const athlete = await signup('Athlete', owner);
  let subject = await signup('Subject', owner);
  let serial = 0;
  let seed = 0x1234abcd;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  let entry = await create(athlete);
  let prior: LeaderboardRow[] | undefined;
  async function equivalent(label: string) {
    for (const metric of ['percent', 'meters', 'season'] as const) {
      const path = '/leaderboard?metric=' + metric;
      const response = await api(path, owner);
      expect(response.status, label).toBe(200);
      const cached = await response.json<LeaderboardRow[]>();
      const expected = await sql((s) =>
        uncachedLeaderboard(s, today(new Date(now)), metric, new Date(now)),
      );
      expect(cached, label + ' ' + metric).toEqual(expected);
      expect(await (await api(path, owner)).json(), label + ' warm ' + metric).toEqual(expected);
      prior = cached;
    }
  }
  const actions: [string, () => Promise<unknown>][] = [
    [
      'entry create',
      async () => {
        entry = await create(athlete, 1000 + Math.floor(random() * 40000));
      },
    ],
    [
      'distance',
      () =>
        mutate('/entries/' + entry.id, athlete, 'PATCH', {
          distance_m: 1000 + Math.floor(random() * 60000),
        }),
    ],
    [
      'zone',
      () => mutate('/entries/' + entry.id, athlete, 'PATCH', { zone: random() < 0.5 ? 'D' : 'E' }),
    ],
    [
      'modality',
      () =>
        mutate('/entries/' + entry.id, athlete, 'PATCH', {
          modality: random() < 0.5 ? 'bike' : 'erg',
        }),
    ],
    [
      'week move',
      () =>
        mutate('/entries/' + entry.id, athlete, 'PATCH', {
          date: random() < 0.5 ? '2026-08-24' : today(new Date(now)),
        }),
    ],
    [
      'entry delete',
      async () => {
        await mutate('/entries/' + entry.id, athlete, 'DELETE');
        await equivalent('entry deleted');
        entry = await create(athlete);
      },
    ],
    [
      'staff delete',
      async () => {
        await mutate('/entries/' + entry.id, owner, 'DELETE');
        await equivalent('staff deleted entry');
        entry = await create(athlete);
      },
    ],
    [
      'personal target',
      () => mutate('/me/target', athlete, 'PUT', { target_m: 1000 + Math.floor(random() * 90000) }),
    ],
    [
      'group target',
      () =>
        mutate('/admin/settings', owner, 'PATCH', {
          group_targets: {
            frosh: 51000,
            normal: 60000 + Math.floor(random() * 40000),
            u23: 100000,
          },
        }),
    ],
    [
      'season start',
      () =>
        mutate('/admin/settings', owner, 'PATCH', {
          season_start: random() < 0.5 ? '09-01' : '08-01',
        }),
    ],
    [
      'factors and recalculate',
      async () => {
        await mutate('/entries/' + entry.id, athlete, 'PATCH', { modality: 'bike' });
        await equivalent('bike entry before factor change');
        const settings = await (
          await api('/admin/settings', owner)
        ).json<{
          mode_factors: { bike: number };
        }>();
        await mutate('/admin/settings', owner, 'PATCH', {
          mode_factors: { erg: 1, bike: settings.mode_factors.bike + 0.01, run: 1 },
        });
        await equivalent('changed factors before recalculate');
        const recalculated = await (
          await mutate('/admin/recalculate', owner, 'POST', {})
        ).json<{
          updated: number;
        }>();
        expect(recalculated.updated).toBeGreaterThan(0);
      },
    ],
    [
      'deactivate',
      () => mutate('/admin/users/' + subject.user.id, owner, 'PATCH', { active: random() < 0.5 }),
    ],
    [
      'on leaderboard',
      () =>
        mutate('/admin/users/' + subject.user.id, owner, 'PATCH', {
          on_leaderboard: random() < 0.5,
        }),
    ],
    ['rename', () => mutate('/me', athlete, 'PATCH', { name: 'Athlete ' + serial++ })],
    [
      'roster rename',
      () =>
        mutate('/admin/roster/' + subject.roster, owner, 'PATCH', { name: 'Subject ' + serial++ }),
    ],
    [
      'group',
      () => mutate('/me', athlete, 'PATCH', { group_key: random() < 0.5 ? 'frosh' : 'u23' }),
    ],
    [
      'public profile',
      () =>
        mutate('/me', athlete, 'PATCH', {
          bio: 'Bio ' + serial++,
          side: random() < 0.5 ? 'port' : 'starboard',
          class_year: 2027,
          best2k_split_s: 100,
        }),
    ],
    [
      'unlink and signup',
      async () => {
        await mutate('/admin/roster/' + subject.roster + '/unlink', owner, 'POST', {});
        await equivalent('unlinked');
        subject = await signup('Reclaim' + serial++, owner, subject.roster);
      },
    ],
    [
      'import',
      () =>
        mutate('/admin/roster/import', owner, 'POST', {
          csv: 'name,role,group,side,class_year\nImported ' + serial++ + ',rower,normal,,',
        }),
    ],
    [
      'role',
      () =>
        mutate('/admin/users/' + subject.user.id, owner, 'PATCH', {
          role: random() < 0.5 ? 'rower' : 'coxswain',
        }),
    ],
  ];
  await equivalent('initial');
  for (let cycle = 0; cycle < 6; cycle++) {
    const shuffled = [...actions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (const [label, action] of shuffled) {
      await action();
      await equivalent(label);
    }
    if (cycle === 2 || cycle === 3)
      await mutate('/admin/settings', owner, 'PATCH', { season_start: '09-01' });
    await equivalent('before clock advance');
    now = [
      '2026-08-31T06:59:59Z',
      '2026-08-31T07:00:00Z',
      '2026-09-01T06:59:59Z',
      '2026-09-01T07:00:00Z',
      '2026-09-07T06:59:59Z',
      '2026-09-07T07:00:00Z',
    ][cycle];
    await equivalent('clock ' + now);
  }
  expect(prior).toBeDefined();
}, 60000);

it('reads an entry write immediately in leaderboard totals, rank and own week stats', async () => {
  const owner = await signup('Owner');
  const first = await signup('First', owner);
  const second = await signup('Second', owner);
  await create(second, 10000);
  const before = await (await api('/leaderboard', first)).json<LeaderboardRow[]>();
  expect(before.find((row) => row.user.id === first.user.id)?.rank).toBe(2);
  await create(first, 20000);
  const after = await (await api('/leaderboard', first)).json<LeaderboardRow[]>();
  expect(after.find((row) => row.user.id === first.user.id)).toMatchObject({
    rank: 1,
    total_m: 20000,
    entry_count: 1,
  });
  expect(await (await api('/stats/week', first)).json<WeekStats>()).toMatchObject({
    total_m: 20000,
  });
});

it('uses indexed batched dirty-user aggregation and three queries on warm hits; isolates subjects and returned objects', async () => {
  const owner = await signup('Owner');
  const athlete = await signup('Athlete', owner);
  const other = await signup('Other', owner);
  const entry = await create(athlete);
  await create(other);
  await sql(async (s) => {
    const calls: { query: string; binds: unknown[] }[] = [];
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
    const date = today(new Date(now));
    const read = () => leaderboard(storage, date, 'percent', new Date(now));
    const cold = read();
    expect(calls.length).toBeLessThan(20);
    const aggregate = calls.find((call) => call.query.includes('SUM(equiv_m)'))!;
    const plan = s.sql
      .exec<{ detail: string }>(
        'EXPLAIN QUERY PLAN ' + aggregate.query,
        ...(aggregate.binds as string[]),
      )
      .toArray()
      .map((row) => row.detail)
      .join('\n');
    expect(plan).toContain('entries_user_week');
    expect(plan).not.toContain('SCAN entries');
    calls.length = 0;
    const warm = read();
    expect(warm).toEqual(cold);
    expect(calls).toHaveLength(3);
    expect(calls.some((call) => call.query.includes('FROM entries'))).toBe(false);
    warm[0].total_m = -1;
    warm[0].user.name = 'Mutated';
    expect(read()).toEqual(cold);
    const subjects = [byId(s, athlete.user.id)];
    expect(leaderboard(storage, date, 'percent', new Date(now), subjects)).toEqual(
      uncachedLeaderboard(s, date, 'percent', new Date(now), subjects),
    );
    expect(read()).toEqual(cold);
    s.sql.exec('UPDATE entries SET equiv_m=equiv_m+100 WHERE id=?', entry.id);
    calls.length = 0;
    expect(read()).toEqual(uncachedLeaderboard(s, date, 'percent', new Date(now)));
    const dirty = calls.filter((call) => call.query.includes('SUM(equiv_m)'));
    expect(dirty).toHaveLength(1);
    expect(dirty[0].binds).toEqual([athlete.user.id, expect.any(String), expect.any(String)]);
    s.sql.exec(
      'UPDATE users SET password_hash=?,updated_at=? WHERE id=?',
      'new hash',
      '2026-08-30T19:00:00Z',
      athlete.user.id,
    );
    calls.length = 0;
    expect(read()).toEqual(uncachedLeaderboard(s, date, 'percent', new Date(now)));
    expect(calls).toHaveLength(3);
    calls.length = 0;
    const response = await route({
      request: new Request('https://oyo.test/api/leaderboard', {
        headers: { Cookie: owner.cookie },
      }),
      storage,
      env: bindings,
      now: new Date(now),
      params: {},
    });
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(9);
  });
});

it('migrates existing v6-v8 data idempotently and invalidates old/new owners, target deletes, settings deletes and user deletes', async () => {
  const owner = await signup('Owner');
  const athlete = await signup('Athlete', owner);
  const other = await signup('Other', owner);
  const entry = await create(athlete);
  await sql((s) => {
    for (const trigger of s.sql
      .exec<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'stats_%'",
      )
      .toArray())
      s.sql.exec(`DROP TRIGGER ${trigger.name}`);
    s.sql.exec(
      'DROP TABLE stats_versions; DROP TABLE stats_counters; DROP INDEX entries_user_week;',
    );
    s.sql.exec("UPDATE settings SET value_json='6' WHERE key='schema_version'");
    migrate(s);
    migrate(s);
    expect(getSetting(s, 'schema_version')).toBe(16);
    for (const prior of [6, 7, 8]) {
      setSetting(s, 'schema_version', prior);
      migrate(s);
      expect(getSetting(s, 'schema_version')).toBe(16);
    }
    const read = () => leaderboard(s, '2026-08-30', 'season', new Date(now));
    const equivalent = () =>
      expect(read()).toEqual(uncachedLeaderboard(s, '2026-08-30', 'season', new Date(now)));
    read();
    for (const [query, binds] of [
      ['UPDATE entries SET user_id=? WHERE id=?', [other.user.id, entry.id]],
      ['INSERT INTO weekly_targets VALUES (?,?,?)', [athlete.user.id, '2026-08-24', 1000]],
      ['UPDATE weekly_targets SET user_id=? WHERE user_id=?', [other.user.id, athlete.user.id]],
      ['DELETE FROM weekly_targets WHERE user_id=?', [other.user.id]],
      ['DELETE FROM settings WHERE key=?', ['group_target_history']],
      ['UPDATE roster SET claimed_by_user_id=NULL WHERE claimed_by_user_id=?', [athlete.user.id]],
      ['DELETE FROM users WHERE id=?', [athlete.user.id]],
    ] as [string, (string | number)[]][]) {
      s.sql.exec(query, ...binds);
      equivalent();
    }
  });
});

it('migrates v6 without depending on a legacy entries visibility column', async () => {
  const owner = await signup('Owner');
  await create(owner);
  await sql((s) => {
    setSetting(s, 'schema_version', 6);
    s.sql.exec('DROP INDEX entries_feed; ALTER TABLE entries DROP COLUMN visibility');
    migrate(s);
    expect(getSetting(s, 'schema_version')).toBe(16);
    expect(leaderboard(s, today(new Date(now)), 'percent', new Date(now))).toEqual(
      uncachedLeaderboard(s, today(new Date(now)), 'percent', new Date(now)),
    );
  });
});
