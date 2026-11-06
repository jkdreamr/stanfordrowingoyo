/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Env } from './index';
import worker from './index';
import { migrate } from './db/migrate';
import { getSetting, setSetting } from './db/settings';
import { insertRosterFixture } from './testFixtures';
import { hashPassword, verifyPassword } from './auth/crypto';
const bindings = env as unknown as Env;
const stub = () => bindings.TEAM.get(bindings.TEAM.idFromName('stanford'));
function sql<T>(fn: (storage: DurableObjectStorage) => T) {
  return runInDurableObject(stub(), (_, state) => fn(state.storage));
}
function request(path: string, body: unknown, cookie?: string, internal = false) {
  const init = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OYO-CSRF': '1',
      'X-OYO-Internal': '1',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  };
  return internal
    ? stub().fetch('https://oyo.test' + path, init)
    : SELF.fetch('https://oyo.test' + path, init);
}
beforeEach(async () => {
  await SELF.fetch('https://oyo.test/api/health');
  await sql((s) => {
    s.sql.exec('DELETE FROM sessions');
    s.sql.exec('DELETE FROM roster');
    s.sql.exec('DELETE FROM users');
    s.sql.exec('DELETE FROM rate_limits');
    setSetting(s, 'team_code', 'team-code');
  });
});
async function signup() {
  const id = await sql((s) => insertRosterFixture(s, 'Athlete'));
  const response = await request('/api/auth/signup', {
    roster_id: id,
    team_code: '  TEAM-CODE  ',
    email: 'athlete@example.com',
    password: 'password123',
    password_hash: 'attacker',
    password_salt: 'attacker',
  });
  expect(response.status).toBe(201);
  return {
    user: await response.json<{ id: string }>(),
    cookie: response.headers.get('Set-Cookie')!.split(';')[0],
  };
}
it('ignores supplied hashes, normalizes codes and preserves existing hash compatibility', async () => {
  expect((await request('/api/auth/roster', { team_code: 'wrong' })).status).toBe(403);
  expect((await request('/api/auth/roster', { team_code: '  TEAM-CODE  ' })).status).toBe(200);
  const id = await sql((s) => insertRosterFixture(s, 'Wrong code'));
  expect(
    (
      await request('/api/auth/signup', {
        roster_id: id,
        team_code: 'wrong',
        email: 'wrong@example.com',
        password: 'password123',
      })
    ).status,
  ).toBe(403);
  await signup();
  expect(
    (await request('/api/auth/login', { email: 'athlete@example.com', password: 'password123' }))
      .status,
  ).toBe(200);
  const { hash, salt } = await hashPassword('existing-password');
  expect(await verifyPassword('existing-password', hash, salt)).toBe(true);
  expect(await verifyPassword('wrong-password', hash, salt)).toBe(false);
});
it.each(['known', 'unknown'])(
  'counts failed %s logins and rejects the eleventh before PBKDF2',
  async (kind) => {
    if (kind === 'known') await signup();
    const spy = vi.spyOn(crypto.subtle, 'deriveBits');
    try {
      for (let n = 0; n < 10; n++)
        expect(
          (
            await request('/api/auth/login', {
              email: 'athlete@example.com',
              password: 'wrongpassword',
            })
          ).status,
        ).toBe(401);
      expect(spy).toHaveBeenCalledTimes(10);
      expect(
        (
          await request('/api/auth/login', {
            email: 'athlete@example.com',
            password: 'wrongpassword',
          })
        ).status,
      ).toBe(429);
      expect(spy).toHaveBeenCalledTimes(10);
    } finally {
      spy.mockRestore();
    }
  },
);
it('rejects stale expected credentials in internal session and password commits', async () => {
  const { user, cookie } = await signup();
  const credentials = { user_id: user.id, password_hash: 'stale', password_salt: 'stale' };
  for (const [path, body] of [
    ['/internal/auth/login/session', { ...credentials, email: 'athlete@example.com' }],
    [
      '/internal/me/password/commit',
      { ...credentials, new_password_hash: 'new', new_password_salt: 'new' },
    ],
  ] as const) {
    const response = await request(path, body, cookie, true);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: 'CREDENTIALS_CHANGED' } });
  }
  await sql((s) => expect(s.sql.exec('SELECT * FROM sessions').toArray()).toHaveLength(1));
});
it('keeps internal routes inaccessible to clients and rejects unmarked DO requests', async () => {
  const path = '/internal/auth/login/challenge';
  const external = await request(path, { email: 'attacker@example.com' });
  expect(external.headers.get('Content-Type') ?? '').not.toContain('application/json');
  expect(
    (
      await stub().fetch('https://oyo.test' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'attacker@example.com' }),
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await request(
        '/api/auth/login',
        { email: 'attacker@example.com', password: 'password123' },
        undefined,
        true,
      )
    ).status,
  ).toBe(404);
  await sql((s) => expect(s.sql.exec('SELECT * FROM rate_limits').toArray()).toHaveLength(0));
});
it('strips a client internal marker on forwarded API requests', async () => {
  let forwarded: Request | undefined;
  const fake = {
    ...bindings,
    TEAM: {
      idFromName: () => 'team',
      get: () => ({
        fetch: (request: Request) => {
          forwarded = request;
          return Response.json({ ok: true });
        },
      }),
    },
  } as unknown as Env;
  await worker.fetch(
    new Request('https://oyo.test/api/health', {
      headers: { 'X-OYO-Internal': '1', Cookie: 'unchanged' },
    }),
    fake,
  );
  expect(forwarded!.headers.has('X-OYO-Internal')).toBe(false);
  expect(forwarded!.headers.get('Cookie')).toBe('unchanged');
});
it('seeds TEAM_CODE only on first boot and uses generated codes for absent/blank values', async () => {
  const fresh = bindings.TEAM.get(bindings.TEAM.idFromName('team-code-seed-test'));
  await fresh.fetch('https://oyo.test/api/health');
  await runInDurableObject(fresh, (_, state) => {
    expect(getSetting(state.storage, 'team_code')).toBe('test-join-code');
    migrate(state.storage, 'replacement');
    expect(getSetting(state.storage, 'team_code')).toBe('test-join-code');
    for (const value of [undefined, '   ']) {
      state.storage.sql.exec("DELETE FROM settings WHERE key IN ('team_code','schema_version')");
      migrate(state.storage, value);
      expect(getSetting<string>(state.storage, 'team_code')).toMatch(/^[0-9a-f-]{36}$/);
    }
    state.storage.sql.exec("DELETE FROM settings WHERE key IN ('team_code','schema_version')");
    migrate(state.storage, '  trimmed-code  ');
    expect(getSetting(state.storage, 'team_code')).toBe('trimmed-code');
  });
});
