/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it, vi } from 'vitest';
import type { User, PasswordVerifyResponse } from '../../shared/types';
import type { Env } from './index';
import { insertRosterFixture } from './testFixtures';
import { setSetting } from './db/settings';

const bindings = env as unknown as Env;
const CREATED = '2026-03-09T18:00:00Z';
const NOW = '2026-03-11T18:00:00Z';
const PASSWORD = 'password123';
type Client = { cookie: string; user: User };
const sql = <T>(fn: (storage: DurableObjectStorage) => T) =>
  runInDurableObject(bindings.TEAM.get(bindings.TEAM.idFromName('stanford')), (_, state) =>
    fn(state.storage),
  );
function post(path: string, body: unknown, client?: Client, time = NOW) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OYO-Test-Now': time,
      'CF-Connecting-IP': '203.0.113.1',
      ...(client ? { Cookie: client.cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function signup(name: string, role = 'rower'): Promise<Client> {
  const email = `${name}@example.com`;
  const roster_id = await sql((s) =>
    insertRosterFixture(s, name, role, role === 'rower' ? null : email),
  );
  const response = await post(
    '/auth/signup',
    { email, roster_id, team_code: 'team-code', password: PASSWORD },
    undefined,
    CREATED,
  );
  expect(response.status).toBe(201);
  return {
    cookie: response.headers.get('Set-Cookie')!.split(';')[0],
    user: await response.json<User>(),
  };
}
function snapshot() {
  return sql((s) =>
    Object.fromEntries(
      ['users', 'sessions', 'roster', 'reauth_grants', 'audit_log'].map((table) => [
        table,
        s.sql.exec(`SELECT * FROM ${table} ORDER BY 1`).toArray(),
      ]),
    ),
  );
}
beforeEach(async () => {
  await SELF.fetch('https://oyo.test/api/health');
  await sql((s) => {
    for (const table of [
      'reauth_grants',
      'sessions',
      'roster',
      'users',
      'rate_limits',
      'audit_log',
    ])
      s.sql.exec(`DELETE FROM ${table}`);
    setSetting(s, 'team_code', 'team-code');
  });
});
it.each(['expired', 'inactive'])(
  'does not delete an %s session during a password precheck',
  async (kind) => {
    const user = await signup('athlete');
    await sql((s) => {
      if (kind === 'expired') s.sql.exec('UPDATE sessions SET expires_at=?', NOW);
      else s.sql.exec('UPDATE users SET active=0 WHERE id=?', user.user.id);
    });
    const before = await snapshot();
    const spy = vi.spyOn(crypto.subtle, 'deriveBits');
    try {
      expect((await post('/me/password/verify', { current_password: PASSWORD }, user)).status).toBe(
        401,
      );
      expect(spy).not.toHaveBeenCalled();
      expect(await snapshot()).toEqual(before);
    } finally {
      spy.mockRestore();
    }
  },
);
for (const stage of ['sign', 'deriveBits'] as const) {
  it.each(['signup', 'login', 'unknown-login', 'verify', 'change', 'forced-change', 'reset'])(
    `leaves no auth state except attempts when ${stage} fails during %s; one retry is safe`,
    async (kind) => {
      const user = await signup('athlete');
      const owner = await signup('owner', 'admin');
      const roster_id = await sql((s) => insertRosterFixture(s, 'New athlete'));
      let reauth_token: string | undefined;
      if (kind === 'change') {
        const response = await post('/me/password/verify', { current_password: PASSWORD }, user);
        expect(response.status).toBe(200);
        reauth_token = (await response.json<PasswordVerifyResponse>()).reauth_token;
      }
      await sql((s) => {
        s.sql.exec('DELETE FROM rate_limits');
        s.sql.exec('UPDATE sessions SET expires_at=?', '2026-05-08T18:00:00.000Z');
        if (kind === 'forced-change')
          s.sql.exec('UPDATE users SET must_change_password=1 WHERE id=?', user.user.id);
      });
      const operation = () =>
        kind === 'signup'
          ? post(
              '/auth/signup',
              { roster_id, email: 'new@example.com', password: PASSWORD, team_code: 'team-code' },
              user,
            )
          : kind === 'login' || kind === 'unknown-login'
            ? post(
                '/auth/login',
                {
                  email: kind === 'login' ? user.user.email : 'unknown@example.com',
                  password: PASSWORD,
                },
                user,
              )
            : kind === 'verify'
              ? post('/me/password/verify', { current_password: PASSWORD }, user)
              : kind === 'reset'
                ? post(`/admin/users/${user.user.id}/reset-password`, {}, owner)
                : post('/me/password', { new_password: 'nextpassword123', reauth_token }, user);
      const before = await snapshot();
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const spy = vi
        .spyOn(crypto.subtle, stage)
        .mockRejectedValueOnce(new Error('simulated mid-hash interruption'));
      try {
        const response = await operation();
        expect(response.status).toBe(500);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(await snapshot()).toEqual(before);
        await sql((s) => {
          const counters = s.sql
            .exec<{ email: string; attempts: number }>('SELECT email,attempts FROM rate_limits')
            .toArray();
          expect(counters).toHaveLength(kind === 'reset' ? 0 : 2);
          for (const row of counters) {
            expect(row.attempts).toBe(1);
            expect(row.email).toMatch(/^auth-(email:|ip$)/);
          }
        });
      } finally {
        spy.mockRestore();
        log.mockRestore();
      }
      const retried = await operation();
      expect(retried.status).toBe(
        kind === 'signup'
          ? 201
          : kind === 'change' || kind === 'forced-change'
            ? 204
            : kind === 'unknown-login'
              ? 401
              : 200,
      );
      await sql((s) => {
        expect(
          s.sql.exec('SELECT * FROM users WHERE email=?', 'new@example.com').toArray(),
        ).toHaveLength(kind === 'signup' ? 1 : 0);
        expect(s.sql.exec('SELECT * FROM reauth_grants').toArray()).toHaveLength(
          kind === 'verify' ? 1 : 0,
        );
        if (kind === 'signup')
          expect(
            s.sql
              .exec<{ claimed_by_user_id: string | null }>(
                'SELECT claimed_by_user_id FROM roster WHERE id=?',
                roster_id,
              )
              .one().claimed_by_user_id,
          ).not.toBeNull();
      });
    },
  );
}
