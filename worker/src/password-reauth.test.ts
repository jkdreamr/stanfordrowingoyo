/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it, vi } from 'vitest';
import type { PasswordVerifyResponse, User } from '../../shared/types';
import type { Env } from './index';
import { hashPassword, sha256 } from './auth/crypto';
import { insertRosterFixture } from './testFixtures';
import { setSetting } from './db/settings';

const bindings = env as unknown as Env;
const NOW = '2026-03-09T18:00:00Z';
const PASSWORD = 'password123';
const NEXT = 'nextpassword123';
type Client = { cookie: string; user: User };
const sql = <T>(fn: (storage: DurableObjectStorage) => T) =>
  runInDurableObject(bindings.TEAM.get(bindings.TEAM.idFromName('stanford')), (_, state) =>
    fn(state.storage),
  );
function post(path: string, body: unknown, client?: Client, time = NOW, ip = '203.0.113.1') {
  return SELF.fetch('https://oyo.test/api' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OYO-Test-Now': time,
      'CF-Connecting-IP': ip,
      ...(client ? { Cookie: client.cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function client(response: Response): Promise<Client> {
  expect([200, 201]).toContain(response.status);
  return {
    cookie: response.headers.get('Set-Cookie')!.split(';')[0],
    user: await response.json<User>(),
  };
}
async function signup(name = 'athlete', role = 'rower') {
  const email = `${name}@example.com`;
  const roster_id = await sql((s) =>
    insertRosterFixture(s, name, role, role === 'rower' ? null : email),
  );
  return client(
    await post('/auth/signup', { email, roster_id, team_code: 'team-code', password: PASSWORD }),
  );
}
async function verify(user: Client) {
  const response = await post('/me/password/verify', { current_password: PASSWORD }, user);
  expect(response.status).toBe(200);
  return response.json<PasswordVerifyResponse>();
}
async function error(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({ error: { code } });
}
async function counted(
  label: string,
  operation: () => Promise<Response>,
  status: number,
  count = 1,
) {
  const spy = vi.spyOn(crypto.subtle, 'deriveBits');
  try {
    const response = await operation();
    expect(response.status).toBe(status);
    expect(spy).toHaveBeenCalledTimes(count);
    console.log(`DERIVATIONS ${label}: ${spy.mock.calls.length}`);
    return response;
  } finally {
    spy.mockRestore();
  }
}
beforeEach(async () => {
  await SELF.fetch('https://oyo.test/api/health');
  await sql((s) => {
    for (const table of ['reauth_grants', 'sessions', 'roster', 'users', 'rate_limits'])
      s.sql.exec(`DELETE FROM ${table}`);
    setSetting(s, 'team_code', 'team-code');
  });
});
it('verifies then changes, stores only a token digest, preserves this session and revokes others', async () => {
  const user = await signup();
  const other = await client(
    await post('/auth/login', { email: user.user.email, password: PASSWORD }),
  );
  const grant = await verify(user);
  expect(grant.reauth_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(grant.expires_at).toBe('2026-03-09T18:05:00.000Z');
  const digest = await sha256(grant.reauth_token);
  await sql((s) => {
    const row = s.sql
      .exec<{ token_hash: string; session_hash: string; credential_hash: string }>(
        'SELECT * FROM reauth_grants',
      )
      .one();
    expect(row.token_hash).toBe(digest);
    expect(row.session_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(row)).not.toContain(grant.reauth_token);
  });
  expect((await post('/me/password', { new_password: NEXT, ...grant }, user)).status).toBe(204);
  for (const [viewer, status] of [
    [user, 200],
    [other, 401],
  ] as const)
    expect(
      (
        await SELF.fetch('https://oyo.test/api/me', {
          headers: { Cookie: viewer.cookie, 'X-OYO-Test-Now': NOW },
        })
      ).status,
    ).toBe(status);
  await sql((s) => expect(s.sql.exec('SELECT * FROM reauth_grants').toArray()).toHaveLength(0));
  expect((await post('/auth/login', { email: user.user.email, password: PASSWORD })).status).toBe(
    401,
  );
  expect((await post('/auth/login', { email: user.user.email, password: NEXT })).status).toBe(200);
});
it('consumes a token once and rejects replay before deriving again', async () => {
  const user = await signup();
  const grant = await verify(user);
  expect((await post('/me/password', { new_password: NEXT, ...grant }, user)).status).toBe(204);
  await error(
    await counted(
      'used grant',
      () => post('/me/password', { new_password: 'anotherpassword', ...grant }, user),
      401,
      0,
    ),
    401,
    'REAUTH_REQUIRED',
  );
});
it('expires a grant at exactly five minutes', async () => {
  const user = await signup();
  const grant = await verify(user);
  await error(
    await post('/me/password', { new_password: NEXT, ...grant }, user, '2026-03-09T18:05:00Z'),
    401,
    'REAUTH_REQUIRED',
  );
});
it('binds a grant to one session, even for the same user, without consuming it on a mismatch', async () => {
  const user = await signup();
  const other = await client(
    await post('/auth/login', { email: user.user.email, password: PASSWORD }),
  );
  const grant = await verify(user);
  await error(
    await post('/me/password', { new_password: NEXT, ...grant }, other),
    401,
    'REAUTH_REQUIRED',
  );
  expect((await post('/me/password', { new_password: NEXT, ...grant }, user)).status).toBe(204);
});
it.each([undefined, null, '', 'bad', 'A'.repeat(43), 123])(
  'requires a valid grant for normal changes (%s)',
  async (reauth_token) => {
    const user = await signup();
    await error(
      await counted(
        'missing/invalid grant',
        () => post('/me/password', { new_password: NEXT, reauth_token }, user),
        401,
        0,
      ),
      401,
      'REAUTH_REQUIRED',
    );
  },
);
it('rejects the legacy current_password field without deriving or modifying credentials', async () => {
  const user = await signup();
  await error(
    await counted(
      'legacy change body',
      () => post('/me/password', { current_password: PASSWORD, new_password: NEXT }, user),
      400,
      0,
    ),
    400,
    'VALIDATION_ERROR',
  );
});
it('counts wrong verification passwords by user across IPs and blocks the eleventh before crypto', async () => {
  const user = await signup();
  const spy = vi.spyOn(crypto.subtle, 'deriveBits');
  try {
    for (let i = 0; i < 10; i++)
      await error(
        await post(
          '/me/password/verify',
          { current_password: 'wrongpassword' },
          user,
          NOW,
          `198.51.100.${i}`,
        ),
        401,
        'INVALID_CREDENTIALS',
      );
    const response = await post(
      '/me/password/verify',
      { current_password: PASSWORD },
      user,
      NOW,
      '198.51.100.100',
    );
    expect(response.headers.get('Retry-After')).toBe('900');
    await error(response, 429, 'RATE_LIMITED');
    expect(spy).toHaveBeenCalledTimes(10);
    await sql((s) => expect(s.sql.exec('SELECT * FROM reauth_grants').toArray()).toHaveLength(0));
  } finally {
    spy.mockRestore();
  }
});
it.each(['/me/password/verify', '/me/password'])(
  'requires authentication before deriving for %s',
  async (path) => {
    await error(
      await counted(
        'unauthenticated',
        () =>
          post(path, {
            current_password: path.endsWith('verify') ? PASSWORD : undefined,
            new_password: NEXT,
          }),
        401,
        0,
      ),
      401,
      'UNAUTHENTICATED',
    );
  },
);
it('invalidates a grant after admin reset revokes its session', async () => {
  const owner = await signup('owner', 'admin');
  const user = await signup();
  const grant = await verify(user);
  expect((await post(`/admin/users/${user.user.id}/reset-password`, {}, owner)).status).toBe(200);
  await error(
    await post('/me/password', { new_password: NEXT, ...grant }, user),
    401,
    'UNAUTHENTICATED',
  );
  await sql((s) =>
    expect(
      s.sql
        .exec<{ must_change_password: number }>(
          'SELECT must_change_password FROM users WHERE id=?',
          user.user.id,
        )
        .one().must_change_password,
    ).toBe(1),
  );
});
it('rejects a grant bound to credentials that changed even if its session survives', async () => {
  const user = await signup();
  const grant = await verify(user);
  const replacement = await hashPassword('replacement123', bindings.PASSWORD_PEPPER);
  await sql((s) =>
    s.sql.exec(
      'UPDATE users SET password_hash=?,password_salt=? WHERE id=?',
      replacement.hash,
      replacement.salt,
      user.user.id,
    ),
  );
  await error(
    await post('/me/password', { new_password: NEXT, ...grant }, user),
    401,
    'REAUTH_REQUIRED',
  );
});
it.each(['replace', 'deactivate', 'logout'])(
  'does not issue a grant if %s occurs during verification',
  async (race) => {
    const user = await signup();
    const replacement = await hashPassword('replacement123', bindings.PASSWORD_PEPPER);
    const original = crypto.subtle.deriveBits.bind(crypto.subtle);
    const spy = vi.spyOn(crypto.subtle, 'deriveBits').mockImplementation(async (...args) => {
      const result = await original(...args);
      await sql((s) => {
        if (race === 'replace')
          s.sql.exec(
            'UPDATE users SET password_hash=?,password_salt=? WHERE id=?',
            replacement.hash,
            replacement.salt,
            user.user.id,
          );
        else if (race === 'deactivate')
          s.sql.exec('UPDATE users SET active=0 WHERE id=?', user.user.id);
        else s.sql.exec('DELETE FROM sessions WHERE user_id=?', user.user.id);
      });
      return result;
    });
    try {
      await error(
        await post('/me/password/verify', { current_password: PASSWORD }, user),
        race === 'replace' ? 409 : 401,
        race === 'replace' ? 'CREDENTIALS_CHANGED' : 'UNAUTHENTICATED',
      );
      await sql((s) => expect(s.sql.exec('SELECT * FROM reauth_grants').toArray()).toHaveLength(0));
    } finally {
      spy.mockRestore();
    }
  },
);
it('allows only one concurrent change to consume a grant', async () => {
  const user = await signup();
  const grant = await verify(user);
  const original = crypto.subtle.deriveBits.bind(crypto.subtle);
  let count = 0;
  const spy = vi.spyOn(crypto.subtle, 'deriveBits').mockImplementation(async (...args) => {
    const index = ++count;
    const result = await original(...args);
    if (index === 1)
      expect(
        (await post('/me/password', { new_password: 'winningpassword', ...grant }, user)).status,
      ).toBe(204);
    return result;
  });
  try {
    await error(
      await post('/me/password', { new_password: NEXT, ...grant }, user),
      409,
      'CREDENTIALS_CHANGED',
    );
    expect(spy).toHaveBeenCalledTimes(2);
    await sql((s) => expect(s.sql.exec('SELECT * FROM reauth_grants').toArray()).toHaveLength(0));
  } finally {
    spy.mockRestore();
  }
});
it('performs at most one PBKDF2 per Worker password request, including forced change and unknown login', async () => {
  const owner = await signup('owner', 'admin');
  const roster_id = await sql((s) => insertRosterFixture(s, 'athlete'));
  const user = await client(
    await counted(
      'signup',
      () =>
        post('/auth/signup', {
          email: 'athlete@example.com',
          roster_id,
          team_code: 'team-code',
          password: PASSWORD,
        }),
      201,
    ),
  );
  await counted(
    'login',
    () => post('/auth/login', { email: user.user.email, password: PASSWORD }),
    200,
  );
  await counted(
    'wrong login',
    () => post('/auth/login', { email: user.user.email, password: 'wrongpassword' }),
    401,
  );
  await counted(
    'unknown login',
    () => post('/auth/login', { email: 'unknown@example.com', password: PASSWORD }),
    401,
  );
  const grant = await (
    await counted(
      'verify',
      () => post('/me/password/verify', { current_password: PASSWORD }, user),
      200,
    )
  ).json<PasswordVerifyResponse>();
  await counted(
    'wrong verify',
    () => post('/me/password/verify', { current_password: 'wrongpassword' }, user),
    401,
  );
  await counted('change', () => post('/me/password', { new_password: NEXT, ...grant }, user), 204);
  const reset = await (
    await counted(
      'admin reset',
      () => post(`/admin/users/${user.user.id}/reset-password`, {}, owner),
      200,
    )
  ).json<{ temporary_password: string }>();
  const forced = await client(
    await counted(
      'temporary login',
      () => post('/auth/login', { email: user.user.email, password: reset.temporary_password }),
      200,
    ),
  );
  expect(forced.user.must_change_password).toBe(true);
  await counted(
    'forced change without token',
    () => post('/me/password', { new_password: NEXT }, forced),
    204,
  );
  await sql((s) =>
    expect(
      s.sql
        .exec<{ must_change_password: number }>(
          'SELECT must_change_password FROM users WHERE id=?',
          user.user.id,
        )
        .one().must_change_password,
    ).toBe(0),
  );
});
it.each(['A'.repeat(43) + '=', 'unknown-format', ''])(
  'rejects legacy/unparseable hashes with a safe warning (%s)',
  async (hash) => {
    const user = await signup();
    await sql((s) => s.sql.exec('UPDATE users SET password_hash=? WHERE id=?', hash, user.user.id));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await error(
        await counted(
          'unsupported hash login',
          () => post('/auth/login', { email: user.user.email, password: PASSWORD }),
          401,
          0,
        ),
        401,
        'INVALID_CREDENTIALS',
      );
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        'Stored password hash format is unsupported or invalid.',
      );
    } finally {
      warn.mockRestore();
    }
  },
);
