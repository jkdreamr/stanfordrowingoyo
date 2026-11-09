/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import type { Env } from './index';
import { insertRosterFixture } from './testFixtures';
import { migrate } from './db/migrate';
import { getSetting, setSetting } from './db/settings';

const bindings = env as unknown as Env;
const now = '2026-03-08T08:00:00.000Z';
function sql<T>(callback: (storage: DurableObjectStorage) => T) {
  return runInDurableObject(bindings.TEAM.get(bindings.TEAM.idFromName('stanford')), (_, state) =>
    callback(state.storage),
  );
}
function request(path: string, method = 'GET', cookie?: string, body?: unknown) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method,
    headers: {
      'X-OYO-CSRF': '1',
      'X-OYO-Test-Now': now,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function signup() {
  await request('/health');
  const email = `${crypto.randomUUID()}@example.com`;
  await sql((storage) => insertRosterFixture(storage, 'Intro Rower', 'rower', email));
  const response = await request('/auth/signup', 'POST', undefined, {
    email,
    password: 'password123',
  });
  expect(response.status).toBe(201);
  const user = await response.json<{ id: string }>();
  return { user, email, cookie: response.headers.get('Set-Cookie')!.split(';')[0] };
}

it('requires authentication for intro reads and completion', async () => {
  expect((await request('/me/intro')).status).toBe(401);
  expect((await request('/me/intro', 'POST')).status).toBe(401);
});

it('persists completion across sessions, once, without affecting another account', async () => {
  const first = await signup();
  const second = await signup();
  expect(await (await request('/me/intro', 'GET', first.cookie)).json()).toEqual({
    completed_at: null,
  });
  expect(await (await request('/me/intro', 'POST', first.cookie)).json()).toEqual({
    completed_at: now,
  });
  const login = await request('/auth/login', 'POST', undefined, {
    email: first.email,
    password: 'password123',
  });
  expect(login.status).toBe(200);
  const newCookie = login.headers.get('Set-Cookie')!.split(';')[0];
  expect(await (await request('/me/intro', 'GET', newCookie)).json()).toEqual({
    completed_at: now,
  });
  expect(await (await request('/me/intro', 'POST', newCookie)).json()).toEqual({
    completed_at: now,
  });
  expect(await (await request('/me/intro', 'GET', second.cookie)).json()).toEqual({
    completed_at: null,
  });
});

it.each([9, 10, 11])(
  'migrates v%i to v15 idempotently and backfills only existing users',
  async (version) => {
    const first = await signup();
    await sql((storage) => {
      storage.sql.exec('DROP TABLE user_intro');
      setSetting(storage, 'schema_version', version);
      migrate(storage);
      expect(getSetting(storage, 'schema_version')).toBe(19);
      const before = storage.sql
        .exec<{ completed_at: string }>(
          'SELECT completed_at FROM user_intro WHERE user_id = ?',
          first.user.id,
        )
        .one();
      migrate(storage);
      expect(
        storage.sql
          .exec('SELECT completed_at FROM user_intro WHERE user_id = ?', first.user.id)
          .one(),
      ).toEqual(before);
    });
    const next = await signup();
    expect(await (await request('/me/intro', 'GET', next.cookie)).json()).toEqual({
      completed_at: null,
    });
  },
);

it('rejects revoked sessions and cross-site completion', async () => {
  const first = await signup();
  const crossSite = await SELF.fetch('https://oyo.test/api/me/intro', {
    method: 'POST',
    headers: { Cookie: first.cookie, Origin: 'https://other.test', 'X-OYO-CSRF': '1' },
  });
  expect(crossSite.status).toBe(403);
  await request('/auth/logout', 'POST', first.cookie);
  expect((await request('/me/intro', 'POST', first.cookie)).status).toBe(401);
});
