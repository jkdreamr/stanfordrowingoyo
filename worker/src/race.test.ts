/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TeamRace, User } from '../../shared/types';
import { GROUP_TARGETS } from '../../shared/seed';
import type { Env } from './index';
import { migrateLegacyFixture as migrate } from './migrationFixture';
import { setSetting } from './db/settings';
import { teamRace } from './db/stats';
import { insertRosterFixture } from './testFixtures';

const bindings = env as unknown as Env;
const START = '2026-11-09T08:00:00.000Z';
const MID = '2026-11-12T20:00:00.000Z';
const END = '2026-11-16T08:00:00.000Z';
type Client = { cookie: string; user: User };
function sql<T>(callback: (storage: DurableObjectStorage) => T): Promise<T> {
  return runInDurableObject(
    bindings.TEAM.get(bindings.TEAM.idFromName('stanford')),
    (_instance, state) => callback(state.storage),
  );
}
function api(path: string, client?: Client, method = 'GET', body?: unknown, time = MID) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-OYO-CSRF': '1',
      'X-OYO-Test-Now': time,
      ...(client ? { Cookie: client.cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function user(name: string, role = 'rower'): Promise<Client> {
  const id = await sql((storage) => insertRosterFixture(storage, name, role));
  const response = await api('/auth/signup', undefined, 'POST', {
    roster_id: id,
    email: name.toLowerCase() + '@example.com',
    password: 'password123',
    team_code: 'team-code',
    group_key: 'normal',
  });
  expect(response.status).toBe(201);
  return {
    cookie: response.headers.get('Set-Cookie')!.split(';')[0],
    user: await response.json<User>(),
  };
}
async function log(client: Client, distance: number, date: string, time = MID) {
  const response = await api(
    '/entries',
    client,
    'POST',
    {
      date,
      distance_m: distance,
      modality: 'erg',
      zone: 'E',
      title: 'Training',
      notes: '',
      visibility: 'team',
    },
    time,
  );
  expect(response.status).toBe(201);
}
async function race(client: Client, time: string, week?: string) {
  const response = await api(
    '/stats/race' + (week ? `?week=${week}` : ''),
    client,
    'GET',
    undefined,
    time,
  );
  expect(response.status).toBe(200);
  return response.json<TeamRace>();
}
beforeEach(async () => {
  await api('/health');
  await sql((storage) =>
    storage.transactionSync(() => {
      for (const table of [
        'roster',
        'users',
        'sessions',
        'settings',
        'weekly_targets',
        'rate_limits',
        'entries',
        'audit_log',
      ])
        storage.sql.exec(`DELETE FROM ${table}`);
      migrate(storage);
      setSetting(storage, 'team_code', 'team-code');
    }),
  );
});

describe('Stanford vs Berkeley race', () => {
  it('requires a signed-in user', async () => {
    expect((await api('/stats/race')).status).toBe(401);
  });
  it('races active rowers against 90% of their summed targets, linear through the week', async () => {
    const ada = await user('Ada');
    const ben = await user('Ben');
    const cox = await user('Cox', 'coxswain');
    const admin = await user('Admin', 'admin');
    await log(ada, 20000, '2026-11-10');
    await log(ben, 5000, '2026-11-12');
    await log(cox, 9000, '2026-11-12');
    await log(admin, 9000, '2026-11-12');
    await log(ada, 4000, '2026-11-03', '2026-11-04T20:00:00.000Z');
    const summed = GROUP_TARGETS.normal * 2;
    const total = Math.round(summed * 0.9);

    const start = await race(cox, START);
    expect(start.ratio).toBe(0.9);
    expect(start.week).toMatchObject({
      week_start: '2026-11-09',
      starts_at: START,
      ends_at: END,
      status: 'live',
      rowers: 2,
      stanford_m: 25000,
      target_m: summed,
      berkeley_total_m: total,
      berkeley_m: 0,
    });
    expect(start.previous).toMatchObject({
      week_start: '2026-11-02',
      status: 'final',
      stanford_m: 4000,
    });
    expect(start.previous.berkeley_m).toBe(start.previous.berkeley_total_m);

    const mid = await race(ada, MID);
    expect(mid.week.berkeley_m).toBe(Math.round(total / 2));
    expect(mid.as_of).toBe(MID);

    const end = await race(ada, END, '2026-11-09');
    expect(end.week).toMatchObject({ status: 'final', berkeley_m: total, stanford_m: 25000 });
    const next = await race(ada, END);
    expect(next.week).toMatchObject({ week_start: '2026-11-16', stanford_m: 0, berkeley_m: 0 });
    expect(next.previous).toEqual(end.week);

    const upcoming = await race(ada, MID, '2026-11-23');
    expect(upcoming.week).toMatchObject({ status: 'upcoming', berkeley_m: 0 });
  });
  it('keeps Berkeley at zero when no rowers have targets', async () => {
    const cox = await user('Cox', 'coxswain');
    await log(cox, 9000, '2026-11-12');
    const result = await race(cox, MID);
    expect(result.week).toMatchObject({
      rowers: 0,
      stanford_m: 0,
      target_m: 0,
      berkeley_total_m: 0,
      berkeley_m: 0,
    });
  });
  it('excludes inactive rowers and uses personal targets', async () => {
    const ada = await user('Ada');
    const ben = await user('Ben');
    expect((await api('/me/target', ada, 'PUT', { target_m: 50000 })).status).toBe(200);
    await log(ben, 7000, '2026-11-12');
    await sql((storage) =>
      storage.sql.exec('UPDATE users SET active = 0 WHERE id = ?', ben.user.id),
    );
    const result = await race(ada, MID);
    expect(result.week).toMatchObject({
      rowers: 1,
      stanford_m: 0,
      target_m: 50000,
      berkeley_total_m: 45000,
    });
  });
  it('lets staff adjust the pace percent within bounds', async () => {
    const admin = await user('Admin', 'admin');
    const ada = await user('Ada');
    expect((await api('/admin/settings', ada, 'PATCH', { berkeley_pace_percent: 80 })).status).toBe(
      403,
    );
    expect(
      (await api('/admin/settings', admin, 'PATCH', { berkeley_pace_percent: 49 })).status,
    ).toBe(400);
    expect(
      (await api('/admin/settings', admin, 'PATCH', { berkeley_pace_percent: 80.5 })).status,
    ).toBe(400);
    const patched = await api('/admin/settings', admin, 'PATCH', { berkeley_pace_percent: 80 });
    expect(patched.status).toBe(200);
    expect((await patched.json<{ berkeley_pace_percent: number }>()).berkeley_pace_percent).toBe(
      80,
    );
    const result = await race(ada, END);
    expect(result.ratio).toBe(0.8);
    expect(result.previous.berkeley_total_m).toBe(Math.round(result.previous.target_m * 0.8));
  });
  it('reads in a constant number of queries', async () => {
    for (const name of ['Ada', 'Ben', 'Cy']) await log(await user(name), 1000, '2026-11-10');
    const count = await sql((storage) => {
      let queries = 0;
      const exec = storage.sql.exec.bind(storage.sql);
      Object.defineProperty(storage.sql, 'exec', {
        configurable: true,
        value: (...args: Parameters<SqlStorage['exec']>) => {
          queries++;
          return exec(...args);
        },
      });
      try {
        teamRace(storage, '2026-11-12', new Date(MID));
      } finally {
        delete (storage.sql as unknown as Record<string, unknown>).exec;
      }
      return queries;
    });
    expect(count).toBeLessThanOrEqual(5);
  });
});
