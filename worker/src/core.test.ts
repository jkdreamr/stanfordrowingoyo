/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './index';
import { migrate } from './db/migrate';
import { effectiveTarget } from './db/targets';
import { getSetting, setGroupTargets, setSetting } from './db/settings';
import { byEmail, toPublicUser } from './db/users';
import { findRoster } from './db/roster';
import { insertRosterFixture } from './testFixtures';
import { requireAdmin, requireStaff } from './auth/guards';
import { now } from './clock';
import { matchPath } from './router';
import { date } from './validate';
import type { Context } from './context';
import { errorResponse, readJson } from './http';
const bindings = env as unknown as Env;
const baseTime = '2026-03-08T08:00:00Z';
function request(
  path: string,
  method = 'GET',
  body?: unknown,
  cookie?: string,
  time = baseTime,
  headers: Record<string, string> = {},
) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method,
    headers: {
      'X-OYO-CSRF': '1',
      'X-OYO-Test-Now': time,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function sql<T>(callback: (storage: DurableObjectStorage) => T): Promise<T> {
  return runInDurableObject(
    bindings.TEAM.get(bindings.TEAM.idFromName('stanford')),
    (_instance, state) => callback(state.storage),
  );
}
async function signup(email = 'rower@example.com', extra = {}) {
  const rosterId = await sql(
    (storage) =>
      findRoster(storage, email.trim().toLowerCase())?.id ?? insertRosterFixture(storage, 'Rower'),
  );
  await request('/auth/roster', 'POST', { team_code: 'team-code' });
  const response = await request('/auth/signup', 'POST', {
    roster_id: rosterId,
    email,
    password: 'password123',
    team_code: 'team-code',
    ...extra,
  });
  expect(response.status).toBe(201);
  return {
    cookie: response.headers.get('Set-Cookie')!.split(';')[0],
    user: await response.json<Record<string, unknown>>(),
    response,
  };
}
beforeEach(async () => {
  await request('/health');
  await sql((storage) => {
    storage.transactionSync(() => {
      for (const table of [
        'reauth_grants',
        'roster',
        'users',
        'sessions',
        'settings',
        'weekly_targets',
        'rate_limits',
        'images',
      ])
        storage.sql.exec(`DELETE FROM ${table}`);
      migrate(storage);
      setSetting(storage, 'team_code', 'team-code');
    });
  });
});
describe('core worker integration', () => {
  it('migrates through v12 and preserves an existing v1 group default', async () => {
    expect(await (await request('/health')).json()).toEqual({ ok: true, schema_version: 12 });
    await sql((storage) => {
      setSetting(storage, 'schema_version', 1);
      setSetting(storage, 'group_targets', { frosh: 70000, normal: 90000, u23: 110000 });
      migrate(storage);
      expect(getSetting(storage, 'schema_version')).toBe(12);
      expect(getSetting(storage, 'group_target_history')).toEqual([
        { week_start: '2000-01-01', targets: { frosh: 70000, normal: 90000, u23: 110000 } },
      ]);
      migrate(storage);
      expect(getSetting<unknown[]>(storage, 'group_target_history')).toHaveLength(1);
    });
  });
  it('signs up with team code, normalizes email, gives secure cookie, and never leaks hashes', async () => {
    const { user, cookie, response } = await signup(' ROWer@Example.COM ');
    expect(user).toMatchObject({
      email: 'rower@example.com',
      name: 'Rower',
      role: 'rower',
      group_key: 'normal',
      active: true,
      on_leaderboard: true,
    });
    expect(response.headers.get('Set-Cookie')).toMatch(
      /^oyo_session=[A-Za-z0-9_-]{43}; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=5184000$/,
    );
    expect(JSON.stringify(user)).not.toMatch(/password_hash|password_salt/);
    const me = await request('/me', 'GET', undefined, cookie);
    expect(await me.json()).toEqual(user);
    await sql((storage) => {
      const session = storage.sql
        .exec<{ token_hash: string }>('SELECT token_hash FROM sessions')
        .one();
      expect(session.token_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(session.token_hash).not.toContain(cookie.slice(12));
      const publicUser = JSON.stringify(toPublicUser(byEmail(storage, 'rower@example.com')));
      expect(publicUser).not.toMatch(/password|email|rower@example.com/);
    });
    expect(
      (
        await request('/auth/signup', 'POST', {
          name: 'Dup',
          email: 'rower@example.com',
          password: 'password123',
          team_code: 'team-code',
        })
      ).status,
    ).toBe(409);
  });
  it('adopts roster attributes without a team code, including staff leaderboard defaults', async () => {
    await sql((storage) =>
      storage.sql
        .exec(
          'INSERT INTO roster VALUES (?,?,?,?,?,?,?,?,?,?)',
          crypto.randomUUID(),
          'Cox',
          'cox@example.com',
          'coxswain',
          'frosh',
          'cox',
          2028,
          null,
          null,
          baseTime,
        )
        .toArray(),
    );
    const { user } = await signup('cox@example.com', { team_code: undefined });
    expect(user).toMatchObject({
      role: 'coxswain',
      group_key: 'frosh',
      side: 'cox',
      class_year: 2028,
      on_leaderboard: false,
    });
    expect((await signup('joskoo@stanford.edu', { team_code: undefined })).user).toMatchObject({
      role: 'admin',
      on_leaderboard: false,
    });
  });
  it('rejects missing/invalid code and malformed signup bodies', async () => {
    for (const team_code of [undefined, 'wrong']) {
      const response = await request('/auth/signup', 'POST', {
        name: 'R',
        email: 'new@example.com',
        password: 'password123',
        team_code,
      });
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: { code: 'INVALID_TEAM_CODE' } });
    }
    for (const body of [{}, { name: 7 }, { name: ' ', email: 'nope', password: 'short' }])
      expect((await request('/auth/signup', 'POST', body)).status).toBe(400);
  });
  it('logs in, rejects wrong/unknown credentials, logs out idempotently', async () => {
    await signup();
    for (const email of ['rower@example.com', 'unknown@example.com'])
      expect((await request('/auth/login', 'POST', { email, password: 'incorrect' })).status).toBe(
        401,
      );
    const login = await request('/auth/login', 'POST', {
      email: 'ROWER@example.com',
      password: 'password123',
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.get('Set-Cookie')!.split(';')[0];
    const logout = await request('/auth/logout', 'POST', undefined, cookie);
    expect(logout.status).toBe(204);
    expect(logout.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect((await request('/me', 'GET', undefined, cookie)).status).toBe(401);
    expect((await request('/auth/logout', 'POST')).status).toBe(204);
  });
  it('slides only after a day, rejects expired and inactive sessions', async () => {
    const { cookie } = await signup();
    expect((await request('/me', 'GET', undefined, cookie)).headers.get('Set-Cookie')).toBeNull();
    const response = await request('/me', 'GET', undefined, cookie, '2026-03-10T08:00:00Z');
    expect(response.status).toBe(200);
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=5184000');
    expect((await request('/me', 'GET', undefined, cookie, '2026-06-10T08:00:00Z')).status).toBe(
      401,
    );
    await sql((storage) =>
      expect(storage.sql.exec('SELECT * FROM sessions').toArray()).toHaveLength(0),
    );
    const login = await request('/auth/login', 'POST', {
      email: 'rower@example.com',
      password: 'password123',
    });
    await sql((storage) =>
      storage.sql
        .exec('UPDATE users SET active = 0 WHERE email = ?', 'rower@example.com')
        .toArray(),
    );
    expect((await request('/me', 'GET', undefined, login.headers.get('Set-Cookie')!)).status).toBe(
      401,
    );
    expect(
      (
        await request('/auth/login', 'POST', {
          email: 'rower@example.com',
          password: 'password123',
        })
      ).status,
    ).toBe(403);
  });
  it('requires login and enforces staff/admin guards', async () => {
    for (const path of ['/me', '/me/target', '/config'])
      expect((await request(path)).status).toBe(401);
    await signup();
    await sql((storage) => {
      const user = byEmail(storage, 'rower@example.com')!;
      const tokenHash = storage.sql
        .exec<{ token_hash: string }>('SELECT token_hash FROM sessions WHERE user_id=?', user.id)
        .one().token_hash;
      const ctx = { storage, now: new Date('2026-03-08T08:00:00Z'), tokenHash } as Context;
      expect(() => requireStaff(ctx)).toThrow('Staff access');
      for (const role of ['coxswain', 'coach', 'admin'] as const) {
        storage.sql.exec('UPDATE users SET role=? WHERE id=?', role, user.id);
        expect(requireStaff(ctx).role).toBe(role);
        if (role !== 'admin') expect(() => requireAdmin(ctx)).toThrow('Admin access');
        else expect(requireAdmin(ctx).role).toBe('admin');
      }
    });
  });
  it('restricts forced password change, verifies current password, revokes other sessions', async () => {
    const { cookie } = await signup();
    const login = await request('/auth/login', 'POST', {
      email: 'rower@example.com',
      password: 'password123',
    });
    const other = login.headers.get('Set-Cookie')!;
    await sql((storage) => storage.sql.exec('UPDATE users SET must_change_password = 1').toArray());
    for (const path of ['/me', '/config'])
      expect((await request(path, 'GET', undefined, cookie)).status).toBe(200);
    const blocked = await request('/me/target', 'GET', undefined, cookie);
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({ error: { code: 'PASSWORD_CHANGE_REQUIRED' } });
    expect(
      (await request('/me/password/verify', 'POST', { current_password: 'incorrect' }, cookie))
        .status,
    ).toBe(401);
    expect(
      (
        await request(
          '/me/password',
          'POST',
          { current_password: 'password123', new_password: 'password123' },
          cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (await request('/me/password', 'POST', { new_password: 'newpassword' }, cookie)).status,
    ).toBe(204);
    expect((await request('/me/target', 'GET', undefined, cookie)).status).toBe(200);
    expect((await request('/me', 'GET', undefined, other)).status).toBe(401);
    expect(
      (
        await request('/auth/login', 'POST', {
          email: 'rower@example.com',
          password: 'password123',
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request('/auth/login', 'POST', {
          email: 'rower@example.com',
          password: 'newpassword',
        })
      ).status,
    ).toBe(200);
  });
  it('rejects CSRF before auth, permits same-origin JSON and explicitly marked bodyless requests', async () => {
    for (const headers of [
      { Origin: 'https://evil.test' },
      { 'Sec-Fetch-Site': 'cross-site' },
      { Origin: 'null' },
    ] as Record<string, string>[])
      expect(
        (await request('/auth/logout', 'POST', undefined, undefined, baseTime, headers)).status,
      ).toBe(403);
    expect((await SELF.fetch('https://oyo.test/api/auth/logout', { method: 'POST' })).status).toBe(
      403,
    );
    expect(
      (
        await request('/auth/logout', 'POST', undefined, undefined, baseTime, {
          Origin: 'https://oyo.test',
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await request('/auth/login', 'POST', {}, undefined, baseTime, {
          'X-OYO-CSRF': '',
          Origin: 'https://oyo.test',
        })
      ).status,
    ).toBe(400);
  });
  it('limits combined attempts to ten, resets after 15 minutes, and clears on successful login', async () => {
    for (let i = 0; i < 10; i++) {
      const response =
        i % 2
          ? await request('/auth/signup', 'POST', {
              name: 'R',
              email: 'limited@example.com',
              password: 'password123',
              team_code: 'wrong',
            })
          : await request('/auth/login', 'POST', {
              email: 'LIMITED@example.com',
              password: 'password123',
            });
      expect(response.status).toBe(i % 2 ? 403 : 401);
    }
    const blocked = await request('/auth/login', 'POST', {
      email: 'limited@example.com',
      password: 'password123',
    });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('900');
    expect(
      (
        await request(
          '/auth/login',
          'POST',
          { email: 'limited@example.com', password: 'password123' },
          undefined,
          '2026-03-08T08:15:00Z',
        )
      ).status,
    ).toBe(401);
    await signup();
    expect(
      (
        await request('/auth/login', 'POST', {
          email: 'rower@example.com',
          password: 'password123',
        })
      ).status,
    ).toBe(200);
    await sql((storage) =>
      expect(
        storage.sql
          .exec('SELECT * FROM rate_limits WHERE email = ?', 'auth-email:rower@example.com')
          .toArray(),
      ).toHaveLength(0),
    );
  });
  it('versions targets across DST Sunday 23:59:59 PT and Monday midnight, removing future overrides', async () => {
    const { cookie } = await signup();
    const sunday = '2026-03-09T06:59:59Z';
    const monday = '2026-03-09T07:00:00Z';
    const config = await (
      await request('/config', 'GET', undefined, cookie, sunday)
    ).json<Record<string, unknown>>();
    expect(config).toMatchObject({ today: '2026-03-08', current_week_start: '2026-03-02' });
    expect(config).not.toHaveProperty('team_code');
    expect(await (await request('/me/target', 'GET', undefined, cookie, sunday)).json()).toEqual({
      week_start: '2026-03-02',
      target_m: 80000,
      source: 'group',
    });
    await sql((storage) => {
      setGroupTargets(storage, '2026-03-09', { frosh: 50000, normal: 95000, u23: 120000 });
      const user = byEmail(storage, 'rower@example.com');
      expect(effectiveTarget(storage, user, '2026-03-02').target_m).toBe(80000);
      expect(effectiveTarget(storage, user, '2026-03-09').target_m).toBe(95000);
    });
    const put = await request('/me/target', 'PUT', { target_m: 70000 }, cookie, sunday);
    expect(put.status).toBe(200);
    expect(await put.json()).toMatchObject({ week_start: '2026-03-02', target_m: 70000 });
    expect(await (await request('/me/target', 'GET', undefined, cookie, monday)).json()).toEqual({
      week_start: '2026-03-09',
      target_m: 70000,
      source: 'personal',
    });
    await request('/me/target', 'PUT', { target_m: 90000 }, cookie, monday);
    await sql((storage) => {
      const user = byEmail(storage, 'rower@example.com');
      expect(effectiveTarget(storage, user, '2026-03-02').target_m).toBe(70000);
      expect(effectiveTarget(storage, user, '2026-03-09').target_m).toBe(90000);
    });
    await request('/me/target', 'PUT', { target_m: 75000 }, cookie, sunday);
    expect(
      await (await request('/me/target', 'GET', undefined, cookie, monday)).json(),
    ).toMatchObject({ target_m: 75000 });
    for (const target_m of [999, 1000001, 1.5, '80000', null])
      expect((await request('/me/target', 'PUT', { target_m }, cookie)).status).toBe(400);
  });
  it('validates profile fields and ignores unknown fields', async () => {
    const { cookie } = await signup();
    expect(
      await (
        await request(
          '/me',
          'PATCH',
          {
            name: ' New ',
            bio: 'Hello',
            side: null,
            class_year: 2028,
            best6k_split_s: 123.45,
            role: 'admin',
          },
          cookie,
        )
      ).json(),
    ).toMatchObject({
      name: 'New',
      bio: 'Hello',
      side: null,
      class_year: 2028,
      best6k_split_s: 123.5,
      role: 'rower',
    });
    expect((await request('/me', 'PATCH', {}, cookie)).status).toBe(200);
    for (const body of [
      { name: '' },
      { side: 'wrong' },
      { class_year: 1900 },
      { best2k_split_s: '90' },
      { avatar_image_id: 'missing' },
      { bio: 'x'.repeat(501) },
    ])
      expect((await request('/me', 'PATCH', body, cookie)).status).toBe(400);
  });
  it('maps errors, enforces body limits/media types, and matches parameter paths', async () => {
    expect((await request('/missing')).status).toBe(404);
    expect((await request('/health', 'POST')).status).toBe(405);
    expect(
      (
        await request('/auth/login', 'POST', {}, undefined, baseTime, {
          'Content-Type': 'text/plain',
        })
      ).status,
    ).toBe(415);
    expect(
      (
        await SELF.fetch('https://oyo.test/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{',
        })
      ).status,
    ).toBe(400);
    expect((await request('/auth/login', 'POST', { data: 'x'.repeat(65536) })).status).toBe(413);
    expect(matchPath('/api/users/:id', '/api/users/a%20b')).toEqual({ id: 'a b' });
    expect(matchPath('/api/users/:id', '/api/users')).toBeNull();
    expect(() => date('2026-02-30')).toThrow();
    expect(() => date('2026-99-01')).toThrow();
    expect(date('2024-02-29')).toBe('2024-02-29');
    expect(
      now(
        new Request('https://oyo.test', { headers: { 'X-OYO-Test-Now': '2000-01-01' } }),
        {} as Env,
      ).getUTCFullYear(),
    ).not.toBe(2000);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const internal = errorResponse(new Error('sensitive stack'));
    expect(internal.status).toBe(500);
    expect(await internal.json()).toEqual({
      error: { code: 'INTERNAL', message: 'An internal error occurred.' },
    });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
    await expect(
      readJson(
        new Request('https://oyo.test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
