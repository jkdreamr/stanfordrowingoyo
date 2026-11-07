/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it, vi } from 'vitest';
import worker, { type Env } from './index';
import {
  hashPassword,
  verifyPassword,
  PASSWORD_ITERATIONS,
  PASSWORD_PEPPER_VERSION,
} from './auth/crypto';
import { AUTH_EMAIL_LIMIT, AUTH_IP_LIMIT } from './db/rateLimit';
import { insertRosterFixture } from './testFixtures';
import { setSetting } from './db/settings';
const bindings = env as unknown as Env;
const pepper = bindings.PASSWORD_PEPPER!;
const stub = () => bindings.TEAM.get(bindings.TEAM.idFromName('stanford'));
const sql = <T>(fn: (s: DurableObjectStorage) => T) =>
  runInDurableObject(stub(), (_, state) => fn(state.storage));
function post(path: string, body: unknown, ip?: string) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OYO-CSRF': '1',
      ...(ip ? { 'CF-Connecting-IP': ip } : {}),
    },
    body: JSON.stringify(body),
  });
}
beforeEach(async () => {
  await SELF.fetch('https://oyo.test/api/health');
  await sql((s) => {
    for (const table of ['sessions', 'roster', 'users', 'rate_limits'])
      s.sql.exec(`DELETE FROM ${table}`);
    setSetting(s, 'team_code', 'team-code');
  });
});
async function register() {
  const roster_id = await sql((s) => insertRosterFixture(s, 'Athlete'));
  const response = await post('/auth/signup', {
    email: 'athlete@example.com',
    password: 'password123',
    team_code: 'team-code',
    roster_id,
  });
  expect(response.status).toBe(201);
  return response.json<{ id: string }>();
}
const encode = (value: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(value)));
async function stored(iterations: number, version?: number) {
  const salt = 'AAAAAAAAAAAAAAAAAAAAAA==';
  let input: Uint8Array = new TextEncoder().encode('password123');
  if (version !== undefined) {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(pepper),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    input = new Uint8Array(await crypto.subtle.sign('HMAC', key, input));
  }
  const key = await crypto.subtle.importKey('raw', input, 'PBKDF2', false, ['deriveBits']);
  const hash = encode(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(16), iterations },
      key,
      256,
    ),
  );
  return {
    salt,
    hash: version === undefined ? hash : `pbkdf2-sha256$${iterations}$${version}$${salt}$${hash}`,
  };
}
it('uses the documented HMAC input and self-describing salt rather than the compatibility column', async () => {
  const expected = await stored(PASSWORD_ITERATIONS, PASSWORD_PEPPER_VERSION);
  expect(await hashPassword('password123', pepper, expected.salt)).toEqual(expected);
  expect(await verifyPassword('password123', expected.hash, 'unused', pepper)).toBe(true);
  expect(await verifyPassword('wrong-password', expected.hash, expected.salt, pepper)).toBe(false);
  expect(
    await verifyPassword('password123', expected.hash, expected.salt, 'different-pepper'),
  ).toBe(false);
  for (const hash of ['', 'pbkdf2-sha256$0$1$bad$bad', expected.hash.replace('$1$', '$99$')])
    expect(await verifyPassword('password123', hash, expected.salt, pepper)).toBe(false);
});
it.each([undefined, '', '   '])(
  'fails closed without a pepper (%s), including every hashing endpoint',
  async (missing) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const derive = vi.spyOn(crypto.subtle, 'deriveBits');
    try {
      await expect(hashPassword('password123', missing)).rejects.toMatchObject({
        status: 500,
        code: 'INTERNAL',
      });
      await expect(verifyPassword('password123', '', '', missing)).rejects.toMatchObject({
        status: 500,
      });
      const config = { ...bindings, PASSWORD_PEPPER: missing };
      for (const path of [
        '/auth/signup',
        '/auth/login',
        '/me/password',
        '/me/password/verify',
        '/admin/users/example/reset-password',
      ]) {
        const response = await worker.fetch(
          new Request('https://oyo.test/api' + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          }),
          config,
        );
        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({ error: { code: 'INTERNAL' } });
      }
      expect((await worker.fetch(new Request('https://oyo.test/api/health'), config)).status).toBe(
        200,
      );
      expect(derive).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith('PASSWORD_PEPPER secret is not configured');
    } finally {
      log.mockRestore();
      derive.mockRestore();
    }
  },
);
it.each([
  [10000, 1],
  [20000, 0],
  [30000, 1],
] as const)(
  'logs in without rehashing versioned hashes (%s iterations, version %s)',
  async (iterations, version) => {
    const user = await register();
    const old = await stored(iterations, version);
    await sql((s) => {
      s.sql.exec(
        'UPDATE users SET password_hash=?,password_salt=? WHERE id=?',
        old.hash,
        old.salt,
        user.id,
      );
      s.sql.exec('DELETE FROM sessions');
    });
    expect(
      (await post('/auth/login', { email: 'athlete@example.com', password: 'wrongpassword' }))
        .status,
    ).toBe(401);
    await sql((s) =>
      expect(
        s.sql
          .exec<{ password_hash: string }>('SELECT password_hash FROM users WHERE id=?', user.id)
          .one().password_hash,
      ).toBe(old.hash),
    );
    const response = await post('/auth/login', {
      email: 'athlete@example.com',
      password: 'password123',
    });
    expect(response.status).toBe(200);
    const after = await sql((s) =>
      s.sql
        .exec<{ password_hash: string; password_salt: string }>(
          'SELECT password_hash,password_salt FROM users WHERE id=?',
          user.id,
        )
        .one(),
    );
    expect(after.password_hash).toBe(old.hash);
    expect(
      await verifyPassword('password123', after.password_hash, after.password_salt, pepper),
    ).toBe(true);
  },
);
it('rejects a reset during login verification without overwriting it or creating a session', async () => {
  const user = await register();
  const old = await stored(PASSWORD_ITERATIONS, PASSWORD_PEPPER_VERSION);
  const reset = await hashPassword('reset-password', pepper);
  await sql((s) => {
    s.sql.exec(
      'UPDATE users SET password_hash=?,password_salt=? WHERE id=?',
      old.hash,
      old.salt,
      user.id,
    );
    s.sql.exec('DELETE FROM sessions');
  });
  const original = crypto.subtle.deriveBits.bind(crypto.subtle);
  let count = 0;
  const spy = vi.spyOn(crypto.subtle, 'deriveBits').mockImplementation(async (...args) => {
    const result = await original(...args);
    if (++count === 1)
      await sql((s) =>
        s.sql.exec(
          'UPDATE users SET password_hash=?,password_salt=?,must_change_password=1 WHERE id=?',
          reset.hash,
          reset.salt,
          user.id,
        ),
      );
    return result;
  });
  try {
    expect(
      (await post('/auth/login', { email: 'athlete@example.com', password: 'password123' })).status,
    ).toBe(409);
    await sql((s) => {
      expect(
        s.sql
          .exec('SELECT password_hash,must_change_password FROM users WHERE id=?', user.id)
          .one(),
      ).toMatchObject({ password_hash: reset.hash, must_change_password: 1 });
      expect(s.sql.exec('SELECT * FROM sessions').toArray()).toHaveLength(0);
    });
  } finally {
    spy.mockRestore();
  }
});
it('uses the same current HMAC and PBKDF2 cost for known and unknown email logins', async () => {
  await register();
  for (const email of ['athlete@example.com', 'unknown@example.com']) {
    const derive = vi.spyOn(crypto.subtle, 'deriveBits');
    const sign = vi.spyOn(crypto.subtle, 'sign');
    try {
      expect((await post('/auth/login', { email, password: 'wrongpassword' })).status).toBe(401);
      expect(derive).toHaveBeenCalledTimes(1);
      expect(derive.mock.calls[0][0]).toMatchObject({ iterations: PASSWORD_ITERATIONS });
      expect(sign).toHaveBeenCalledTimes(1);
      expect(sign.mock.calls[0][0]).toBe('HMAC');
    } finally {
      derive.mockRestore();
      sign.mockRestore();
    }
  }
});
it.each(['login', 'signup'])(
  'limits %s by email across changing IPs before crypto',
  async (kind) => {
    for (let n = 0; n < AUTH_EMAIL_LIMIT; n++)
      expect(
        (
          await post(
            '/auth/' + kind,
            { email: 'limited@example.com', password: 'password123', team_code: 'wrong' },
            '203.0.113.' + n,
          )
        ).status,
      ).toBe(kind === 'login' ? 401 : 403);
    const derive = vi.spyOn(crypto.subtle, 'deriveBits');
    try {
      const response = await post(
        '/auth/' + kind,
        { email: 'LIMITED@example.com', password: 'password123', team_code: 'wrong' },
        '198.51.100.1',
      );
      expect(response.status).toBe(429);
      expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
      expect(derive).not.toHaveBeenCalled();
    } finally {
      derive.mockRestore();
    }
  },
);
it.each(['login', 'signup'])(
  'limits %s by IP across changing emails before crypto',
  async (kind) => {
    for (let n = 0; n < AUTH_IP_LIMIT; n++)
      expect(
        (
          await post(
            '/auth/' + kind,
            { email: `limited${n}@example.com`, password: 'password123', team_code: 'team-code' },
            '203.0.113.1',
          )
        ).status,
      ).toBe(kind === 'login' ? 401 : 400);
    const derive = vi.spyOn(crypto.subtle, 'deriveBits');
    try {
      expect(
        (
          await post(
            '/auth/' + kind,
            { email: 'another@example.com', password: 'password123', team_code: 'team-code' },
            '203.0.113.1',
          )
        ).status,
      ).toBe(429);
      expect(derive).not.toHaveBeenCalled();
      expect(
        (
          await post(
            '/auth/' + kind,
            { email: 'another@example.com', password: 'password123', team_code: 'team-code' },
            '203.0.113.2',
          )
        ).status,
      ).toBe(kind === 'login' ? 401 : 400);
    } finally {
      derive.mockRestore();
    }
  },
);
it('does not clear the aggregate IP budget after successful authentication', async () => {
  await register();
  await sql((s) =>
    s.sql.exec('UPDATE rate_limits SET attempts=? WHERE email=?', AUTH_IP_LIMIT - 1, 'auth-ip'),
  );
  expect(
    (await post('/auth/login', { email: 'athlete@example.com', password: 'password123' })).status,
  ).toBe(200);
  expect(
    (await post('/auth/login', { email: 'athlete@example.com', password: 'password123' })).status,
  ).toBe(429);
});
