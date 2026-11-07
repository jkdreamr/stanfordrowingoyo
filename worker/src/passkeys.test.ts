/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from './index';
import type { PasskeyLoginOptions, PasskeyRegistrationOptions, User } from '../../shared/types';
import { setSetting, getSetting } from './db/settings';
import { migrate } from './db/migrate';
import { insertRosterFixture } from './testFixtures';
import {
  decodeCbor,
  derToRaw,
  fromBase64Url,
  parseAuthenticatorData,
  toBase64Url,
} from './auth/webauthn';
import { checkOrigin, deviceName } from './routes/passkeys';

const bindings = env as unknown as Env;
const stub = () => bindings.TEAM.get(bindings.TEAM.idFromName('stanford'));
const ORIGIN = 'https://oyo.test';
const sql = <T>(fn: (storage: DurableObjectStorage) => T) =>
  runInDurableObject(stub(), (_, state) => fn(state.storage));
async function api(
  path: string,
  {
    method = 'POST',
    body,
    cookie,
    now,
    ip,
  }: {
    method?: string;
    body?: unknown;
    cookie?: string;
    now?: Date;
    ip?: string;
  } = {},
) {
  return SELF.fetch(ORIGIN + '/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-OYO-CSRF': '1',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(now ? { 'X-OYO-Test-Now': now.toISOString() } : {}),
      ...(ip ? { 'CF-Connecting-IP': ip } : {}),
    },
    body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(body ?? {}),
  });
}

const enc = new TextEncoder();
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) out.set(part, (offset += part.length) - part.length);
  return out;
};
const head = (major: number, n: number) =>
  n < 24
    ? Uint8Array.of((major << 5) | n)
    : n < 256
      ? Uint8Array.of((major << 5) | 24, n)
      : Uint8Array.of((major << 5) | 25, n >> 8, n & 255);
type CborIn = number | string | Uint8Array | Map<CborIn, CborIn>;
function cbor(value: CborIn): Uint8Array {
  if (typeof value === 'number') return value < 0 ? head(1, -1 - value) : head(0, value);
  if (typeof value === 'string')
    return concat(head(3, enc.encode(value).length), enc.encode(value));
  if (value instanceof Uint8Array) return concat(head(2, value.length), value);
  return concat(head(5, value.size), ...[...value].flatMap(([k, v]) => [cbor(k), cbor(v)]));
}
const sha = async (data: Uint8Array | string) =>
  new Uint8Array(
    await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data),
  );
function rawToDer(raw: Uint8Array) {
  const int = (bytes: Uint8Array) => {
    let i = 0;
    while (i < bytes.length - 1 && bytes[i] === 0) i++;
    let out = bytes.slice(i);
    if (out[0] & 0x80) out = concat(Uint8Array.of(0), out);
    return concat(Uint8Array.of(2, out.length), out);
  };
  const body = concat(int(raw.slice(0, 32)), int(raw.slice(32)));
  return concat(Uint8Array.of(0x30, body.length), body);
}

/** A software authenticator producing real ES256/RS256 WebAuthn payloads. */
class Authenticator {
  id = crypto.getRandomValues(new Uint8Array(16));
  counter = 0;
  keys!: CryptoKeyPair;
  constructor(
    public alg: -7 | -257,
    public options: { rpId?: string; origin?: string; uv?: boolean; counter?: boolean } = {},
  ) {}
  async init() {
    this.keys = (await crypto.subtle.generateKey(
      this.alg === -7
        ? { name: 'ECDSA', namedCurve: 'P-256' }
        : {
            name: 'RSASSA-PKCS1-v1_5',
            modulusLength: 2048,
            publicExponent: Uint8Array.of(1, 0, 1),
            hash: 'SHA-256',
          },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    return this;
  }
  get credentialId() {
    return toBase64Url(this.id);
  }
  async authData(attested: boolean) {
    const flags =
      0x01 | (this.options.uv === false ? 0 : 0x04) | 0x08 | 0x10 | (attested ? 0x40 : 0);
    if (this.options.counter !== false) this.counter++;
    const count = Uint8Array.of(
      this.counter >>> 24,
      (this.counter >>> 16) & 255,
      (this.counter >>> 8) & 255,
      this.counter & 255,
    );
    const base = concat(await sha(this.options.rpId ?? 'oyo.test'), Uint8Array.of(flags), count);
    if (!attested) return base;
    const jwk = (await crypto.subtle.exportKey('jwk', this.keys.publicKey)) as JsonWebKey;
    const cose =
      this.alg === -7
        ? new Map<CborIn, CborIn>([
            [1, 2],
            [3, -7],
            [-1, 1],
            [-2, fromBase64Url(jwk.x)],
            [-3, fromBase64Url(jwk.y)],
          ])
        : new Map<CborIn, CborIn>([
            [1, 3],
            [3, -257],
            [-1, fromBase64Url(jwk.n)],
            [-2, fromBase64Url(jwk.e)],
          ]);
    return concat(base, new Uint8Array(16), Uint8Array.of(0, this.id.length), this.id, cbor(cose));
  }
  clientData(type: string, challenge: string) {
    return enc.encode(
      JSON.stringify({
        type,
        challenge,
        origin: this.options.origin ?? ORIGIN,
        crossOrigin: false,
      }),
    );
  }
  async create(options: PasskeyRegistrationOptions) {
    const authData = await this.authData(true);
    const attestation = cbor(
      new Map<CborIn, CborIn>([
        ['fmt', 'none'],
        ['attStmt', new Map()],
        ['authData', authData],
      ]),
    );
    return {
      id: this.credentialId,
      raw_id: this.credentialId,
      client_data_json: toBase64Url(this.clientData('webauthn.create', options.challenge)),
      attestation_object: toBase64Url(attestation),
      transports: ['internal', 'hybrid', 'bogus'],
    };
  }
  async get(options: PasskeyLoginOptions, userHandle: string | null) {
    const authData = await this.authData(false);
    const clientData = this.clientData('webauthn.get', options.challenge);
    const signed = concat(authData, await sha(clientData));
    const signature = new Uint8Array(
      await crypto.subtle.sign(
        this.alg === -7 ? { name: 'ECDSA', hash: 'SHA-256' } : 'RSASSA-PKCS1-v1_5',
        this.keys.privateKey,
        signed,
      ),
    );
    return {
      id: this.credentialId,
      raw_id: this.credentialId,
      client_data_json: toBase64Url(clientData),
      authenticator_data: toBase64Url(authData),
      signature: toBase64Url(this.alg === -7 ? rawToDer(signature) : signature),
      user_handle: userHandle === null ? null : toBase64Url(enc.encode(userHandle)),
    };
  }
}

beforeEach(async () => {
  await SELF.fetch(ORIGIN + '/api/health');
  await sql((s) => {
    for (const table of [
      'sessions',
      'roster',
      'users',
      'rate_limits',
      'passkeys',
      'webauthn_challenges',
      'audit_log',
      'reauth_grants',
    ])
      s.sql.exec(`DELETE FROM ${table}`);
    setSetting(s, 'team_code', 'team-code');
  });
});
async function signup(email = 'rower@example.com', name = 'Rower') {
  const id = await sql((s) => insertRosterFixture(s, name));
  const response = await api('/auth/signup', {
    body: { roster_id: id, team_code: 'team-code', email, password: 'password123' },
  });
  expect(response.status).toBe(201);
  return {
    user: await response.json<User>(),
    cookie: response.headers.get('Set-Cookie')!.split(';')[0],
  };
}
async function enroll(cookie: string, authenticator: Authenticator, body: unknown = {}) {
  const options = await api('/me/passkeys/options', { cookie, body });
  expect(options.status).toBe(200);
  const json = await options.json<PasskeyRegistrationOptions>();
  return api('/me/passkeys', { cookie, body: await authenticator.create(json) });
}
async function loginOptions(now?: Date) {
  const response = await api('/auth/passkey/options', { now });
  expect(response.status).toBe(200);
  return response.json<PasskeyLoginOptions>();
}
async function passkeyLogin(authenticator: Authenticator, userId: string | null) {
  return api('/auth/passkey/login', {
    body: await authenticator.get(await loginOptions(), userId),
  });
}

describe('passkey registration', () => {
  it('returns options bound to the request host and the signed-in user', async () => {
    const { user, cookie } = await signup();
    const response = await api('/me/passkeys/options', { cookie });
    const options = await response.json<PasskeyRegistrationOptions>();
    expect(options).toMatchObject({
      rp_id: 'oyo.test',
      rp_name: 'Stanford Rowing OYO',
      timeout_ms: 300000,
      user: { name: 'rower@example.com', display_name: 'Rower' },
      exclude_credentials: [],
    });
    expect(new TextDecoder().decode(fromBase64Url(options.user.id))).toBe(user.id);
    expect(options.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await api('/me/passkeys/options', {})).status).toBe(401);
  });

  it.each([
    [-7, 'ES256'],
    [-257, 'RS256'],
  ] as const)('registers and signs in with %s (%s)', async (alg, _name) => {
    const { user, cookie } = await signup();
    const authenticator = await new Authenticator(alg).init();
    const created = await enroll(cookie, authenticator);
    expect(created.status).toBe(201);
    const passkey = await created.json<{ id: string; name: string; backed_up: boolean }>();
    expect(passkey).toMatchObject({
      id: authenticator.credentialId,
      name: 'iPhone',
      backed_up: true,
    });
    const listed = await (await api('/me/passkeys', { method: 'GET', cookie })).json<unknown[]>();
    expect(listed).toEqual([passkey]);
    expect(JSON.stringify(listed)).not.toMatch(/public_key|sign_count|user_id/);
    const stored = await sql(
      (s) => s.sql.exec('SELECT alg,transports,sign_count FROM passkeys').toArray()[0],
    );
    expect(stored).toEqual({ alg, transports: '["internal","hybrid"]', sign_count: 1 });
    const audit = await sql((s) =>
      s.sql.exec('SELECT actor_id,action,target FROM audit_log').toArray(),
    );
    expect(audit).toEqual([{ actor_id: user.id, action: 'passkey.add', target: user.id }]);

    const login = await passkeyLogin(authenticator, user.id);
    expect(login.status).toBe(200);
    expect(await login.json<User>()).toMatchObject({ id: user.id, email: 'rower@example.com' });
    const setCookie = login.headers.get('Set-Cookie')!;
    expect(setCookie).toMatch(
      /^oyo_session=[A-Za-z0-9_-]{43}; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=5184000$/,
    );
    const me = await api('/me', { method: 'GET', cookie: setCookie.split(';')[0] });
    expect((await me.json<User>()).id).toBe(user.id);
    const used = await sql(
      (s) => s.sql.exec('SELECT sign_count,last_used_at FROM passkeys').toArray()[0],
    );
    expect(used.sign_count).toBe(2);
    expect(used.last_used_at).toEqual(expect.any(String));
  });

  it('names known authenticators and devices', () => {
    expect(deviceName('ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4', null)).toBe(
      'Google Password Manager',
    );
    expect(deviceName('00000000-0000-0000-0000-000000000000', 'Mozilla (Linux; Android 15)')).toBe(
      'Android',
    );
    expect(deviceName('00000000-0000-0000-0000-000000000000', 'Mozilla (Macintosh)')).toBe('Mac');
    expect(deviceName('00000000-0000-0000-0000-000000000000', null)).toBe('Passkey');
  });

  it('excludes existing credentials, rejects duplicates and caps passkeys per user', async () => {
    const { cookie } = await signup();
    const authenticator = await new Authenticator(-7).init();
    expect((await enroll(cookie, authenticator)).status).toBe(201);
    const options = await (
      await api('/me/passkeys/options', { cookie })
    ).json<PasskeyRegistrationOptions>();
    expect(options.exclude_credentials).toEqual([
      { id: authenticator.credentialId, transports: ['internal', 'hybrid'] },
    ]);
    const duplicate = await api('/me/passkeys', {
      cookie,
      body: await authenticator.create(options),
    });
    expect(duplicate.status).toBe(409);
    for (let i = 1; i < 10; i++)
      expect((await enroll(cookie, await new Authenticator(-7).init())).status).toBe(201);
    const full = await api('/me/passkeys/options', { cookie });
    expect(full.status).toBe(409);
    expect((await full.json<{ error: { code: string } }>()).error.code).toBe('PASSKEY_LIMIT');
  });

  it('requires a recent login or password re-auth to add a passkey', async () => {
    const { cookie } = await signup();
    const later = new Date(Date.now() + 11 * 60 * 1000);
    const stale = await api('/me/passkeys/options', { cookie, now: later });
    expect(stale.status).toBe(401);
    expect((await stale.json<{ error: { code: string } }>()).error.code).toBe('REAUTH_REQUIRED');
    const verify = await api('/me/password/verify', {
      cookie,
      now: later,
      body: { current_password: 'password123' },
    });
    const { reauth_token } = await verify.json<{ reauth_token: string }>();
    const fresh = await api('/me/passkeys/options', { cookie, now: later, body: { reauth_token } });
    expect(fresh.status).toBe(200);
    const wrong = await api('/me/passkeys/options', {
      cookie,
      now: later,
      body: { reauth_token: 'x'.repeat(43) },
    });
    expect(wrong.status).toBe(401);
  });

  it('rejects invalid registrations without storing a passkey', async () => {
    const { cookie } = await signup();
    const other = await signup('other@example.com', 'Other');
    const cases: [Authenticator, string | undefined][] = [
      [await new Authenticator(-7, { origin: 'https://evil.test' }).init(), 'PASSKEY_INVALID'],
      [await new Authenticator(-7, { origin: 'http://oyo.test' }).init(), 'PASSKEY_INVALID'],
      [await new Authenticator(-7, { rpId: 'evil.test' }).init(), 'PASSKEY_INVALID'],
      [await new Authenticator(-7, { uv: false }).init(), 'PASSKEY_INVALID'],
    ];
    for (const [authenticator, code] of cases) {
      const response = await enroll(cookie, authenticator);
      expect(response.status).toBe(400);
      expect((await response.json<{ error: { code: string } }>()).error.code).toBe(code);
    }
    const options = await (
      await api('/me/passkeys/options', { cookie })
    ).json<PasskeyRegistrationOptions>();
    const payload = await (await new Authenticator(-7).init()).create(options);
    const stolen = await api('/me/passkeys', { cookie: other.cookie, body: payload });
    expect((await stolen.json<{ error: { code: string } }>()).error.code).toBe(
      'PASSKEY_CHALLENGE_EXPIRED',
    );
    const replay = await api('/me/passkeys', { cookie, body: payload });
    expect(replay.status).toBe(400);
    expect(await sql((s) => s.sql.exec('SELECT COUNT(*) AS n FROM passkeys').one().n)).toBe(0);
  });
});

describe('passkey login', () => {
  it('uses each challenge once and expires it after five minutes', async () => {
    const { user, cookie } = await signup();
    const authenticator = await new Authenticator(-7).init();
    await enroll(cookie, authenticator);
    const options = await loginOptions();
    const assertion = await authenticator.get(options, user.id);
    expect((await api('/auth/passkey/login', { body: assertion })).status).toBe(200);
    const replay = await api('/auth/passkey/login', { body: assertion });
    expect((await replay.json<{ error: { code: string } }>()).error.code).toBe(
      'PASSKEY_CHALLENGE_EXPIRED',
    );
    const old = await authenticator.get(await loginOptions(), user.id);
    const late = await api('/auth/passkey/login', {
      body: old,
      now: new Date(Date.now() + 5 * 60 * 1000 + 1000),
    });
    expect(late.status).toBe(400);
    const forged = await authenticator.get({ ...options, challenge: 'A'.repeat(43) }, user.id);
    expect((await api('/auth/passkey/login', { body: forged })).status).toBe(400);
  });

  it('rejects bad signatures, wrong users, unknown and removed passkeys', async () => {
    const { user, cookie } = await signup();
    const other = await signup('other@example.com', 'Other');
    const authenticator = await new Authenticator(-7).init();
    await enroll(cookie, authenticator);
    const tampered = await authenticator.get(await loginOptions(), user.id);
    tampered.signature = toBase64Url(rawToDer(new Uint8Array(64).fill(7)));
    expect((await api('/auth/passkey/login', { body: tampered })).status).toBe(401);
    expect((await passkeyLogin(authenticator, other.user.id)).status).toBe(401);
    expect((await passkeyLogin(await new Authenticator(-7).init(), user.id)).status).toBe(401);
    const wrongOrigin = new Authenticator(-7, { origin: 'https://evil.test' });
    Object.assign(wrongOrigin, { id: authenticator.id, keys: authenticator.keys, counter: 9 });
    expect((await passkeyLogin(wrongOrigin, user.id)).status).toBe(400);
    expect(
      (
        await api(`/me/passkeys/${authenticator.credentialId}`, {
          method: 'DELETE',
          cookie: other.cookie,
        })
      ).status,
    ).toBe(404);
    expect(
      (await api(`/me/passkeys/${authenticator.credentialId}`, { method: 'DELETE', cookie }))
        .status,
    ).toBe(204);
    const removed = await passkeyLogin(authenticator, user.id);
    expect((await removed.json<{ error: { code: string } }>()).error.code).toBe('PASSKEY_UNKNOWN');
    const actions = await sql((s) =>
      s.sql
        .exec('SELECT action FROM audit_log ORDER BY created_at')
        .toArray()
        .map((r) => r.action),
    );
    expect(actions).toEqual(['passkey.add', 'passkey.remove']);
  });

  it('accepts authenticators without counters and rejects counter regressions', async () => {
    const { user, cookie } = await signup();
    const zero = await new Authenticator(-7, { counter: false }).init();
    await enroll(cookie, zero);
    expect((await passkeyLogin(zero, user.id)).status).toBe(200);
    expect((await passkeyLogin(zero, null)).status).toBe(200);
    const cloned = await new Authenticator(-257).init();
    await enroll(cookie, cloned);
    expect((await passkeyLogin(cloned, user.id)).status).toBe(200);
    cloned.counter = 0;
    const regression = await passkeyLogin(cloned, user.id);
    expect(regression.status).toBe(401);
    expect(regression.headers.get('Set-Cookie')).toBeNull();
    expect((await regression.json<{ error: { code: string } }>()).error.code).toBe(
      'PASSKEY_CLONED',
    );
    const audit = await sql((s) =>
      s.sql
        .exec("SELECT actor_id FROM audit_log WHERE action='passkey.counter-regression'")
        .toArray(),
    );
    expect(audit).toEqual([{ actor_id: user.id }]);
  });

  it('rejects deactivated users and keeps passkeys through staff password resets', async () => {
    const { user, cookie } = await signup();
    const authenticator = await new Authenticator(-7).init();
    await enroll(cookie, authenticator);
    const admin = await signup('coach@example.com', 'Coach');
    await sql((s) => s.sql.exec("UPDATE users SET role='admin' WHERE id=?", admin.user.id));
    const reset = await api(`/admin/users/${user.id}/reset-password`, { cookie: admin.cookie });
    expect(reset.status).toBe(200);
    expect((await api('/me', { method: 'GET', cookie })).status).toBe(401);
    const login = await passkeyLogin(authenticator, user.id);
    expect(login.status).toBe(200);
    expect((await login.json<User>()).must_change_password).toBe(true);
    const session = login.headers.get('Set-Cookie')!.split(';')[0];
    expect((await api('/me/passkeys', { method: 'GET', cookie: session })).status).toBe(403);
    await sql((s) => s.sql.exec('UPDATE users SET active=0 WHERE id=?', user.id));
    const inactive = await passkeyLogin(authenticator, user.id);
    expect(inactive.status).toBe(403);
    expect((await inactive.json<{ error: { code: string } }>()).error.code).toBe(
      'ACCOUNT_INACTIVE',
    );
  });

  it('deletes passkeys when an inactive account is re-claimed by signup', async () => {
    const { user, cookie } = await signup();
    await enroll(cookie, await new Authenticator(-7).init());
    await sql((s) => {
      s.sql.exec('UPDATE users SET active=0 WHERE id=?', user.id);
      s.sql.exec('UPDATE roster SET claimed_by_user_id=NULL');
    });
    const id = await sql((s) => insertRosterFixture(s, 'New Owner'));
    const again = await api('/auth/signup', {
      body: {
        roster_id: id,
        team_code: 'team-code',
        email: 'rower@example.com',
        password: 'password123',
      },
    });
    expect(again.status).toBe(201);
    expect(await sql((s) => s.sql.exec('SELECT COUNT(*) AS n FROM passkeys').one().n)).toBe(0);
  });

  it('shares login rate limits per account and per IP', async () => {
    const { user, cookie } = await signup();
    const authenticator = await new Authenticator(-7).init();
    await enroll(cookie, authenticator);
    for (let i = 0; i < 10; i++) {
      const bad = await authenticator.get(await loginOptions(), user.id);
      bad.signature = toBase64Url(rawToDer(new Uint8Array(64).fill(1)));
      expect((await api('/auth/passkey/login', { body: bad })).status).toBe(401);
    }
    const limited = await passkeyLogin(authenticator, user.id);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toMatch(/^\d+$/);
    const password = await api('/auth/login', {
      body: { email: 'rower@example.com', password: 'password123' },
    });
    expect(password.status).toBe(429);
    await sql((s) => s.sql.exec('DELETE FROM rate_limits'));
    await sql((s) =>
      s.sql.exec(
        "INSERT INTO rate_limits VALUES ('auth-ip','203.0.113.9',?,150)",
        new Date().toISOString(),
      ),
    );
    const assertion = await authenticator.get(await loginOptions(), user.id);
    const blocked = await api('/auth/passkey/login', { body: assertion, ip: '203.0.113.9' });
    expect(blocked.status).toBe(429);
  });

  it('rate-limits login options per IP and caps stored challenges', async () => {
    await sql((s) =>
      s.sql.exec(
        "INSERT INTO rate_limits VALUES ('passkey-options','198.51.100.1',?,300)",
        new Date().toISOString(),
      ),
    );
    expect((await api('/auth/passkey/options', { ip: '198.51.100.1' })).status).toBe(429);
    expect((await api('/auth/passkey/options', { ip: '198.51.100.2' })).status).toBe(200);
    await sql((s) => {
      const at = new Date(Date.now() + 60000).toISOString();
      for (let i = 0; i < 2100; i++)
        s.sql.exec(
          "INSERT INTO webauthn_challenges VALUES (?, 'login', NULL, NULL, ?, ?)",
          'c' + i,
          at,
          at,
        );
    });
    await api('/auth/passkey/options', { ip: '198.51.100.3' });
    expect(
      await sql((s) => s.sql.exec('SELECT COUNT(*) AS n FROM webauthn_challenges').one().n),
    ).toBe(2000);
  });
});

describe('webauthn parsing', () => {
  it('converts DER ECDSA signatures and rejects malformed input', () => {
    const raw = new Uint8Array(64).map((_, i) => (i === 0 || i === 32 ? 0x80 : i));
    expect(derToRaw(rawToDer(raw))).toEqual(raw);
    const short = new Uint8Array(64);
    short[31] = 5;
    short[63] = 9;
    expect(derToRaw(rawToDer(short))).toEqual(short);
    expect(() => derToRaw(Uint8Array.of(0x30, 2, 2, 0))).toThrow();
    expect(() => derToRaw(Uint8Array.of(0x31, 0))).toThrow();
  });
  it('decodes CBOR and rejects truncated or unsupported keys', () => {
    expect(
      decodeCbor(
        cbor(
          new Map<CborIn, CborIn>([
            [1, -7],
            ['a', Uint8Array.of(1)],
          ]),
        ),
      ).value,
    ).toEqual(
      new Map<unknown, unknown>([
        [1, -7],
        ['a', Uint8Array.of(1)],
      ]),
    );
    expect(() => decodeCbor(Uint8Array.of(0x5a, 0xff, 0xff, 0xff, 0xff))).toThrow();
    const base = new Uint8Array(37);
    base[32] = 0x45;
    const eddsa = cbor(
      new Map<CborIn, CborIn>([
        [1, 1],
        [3, -8],
        [-1, 6],
        [-2, new Uint8Array(32)],
      ]),
    );
    const data = concat(base, new Uint8Array(16), Uint8Array.of(0, 1, 9), eddsa);
    expect(() => parseAuthenticatorData(data)).toThrow('not supported');
    expect(() => parseAuthenticatorData(concat(base, Uint8Array.of(1)))).toThrow();
    expect(() => fromBase64Url('a+b')).toThrow();
  });
  it('accepts only same-host origins, allowing http only for localhost', () => {
    const request = (url: string) => new Request(url);
    expect(() => checkOrigin('https://oyo.test', request('https://oyo.test/api'))).not.toThrow();
    expect(() =>
      checkOrigin('http://localhost:5173', request('http://localhost:8787/api')),
    ).not.toThrow();
    expect(() => checkOrigin('https://oyo.test.evil', request('https://oyo.test/api'))).toThrow();
    expect(() => checkOrigin('http://oyo.test', request('https://oyo.test/api'))).toThrow();
    expect(() =>
      checkOrigin('https://staging.oyo.test', request('https://oyo.test/api')),
    ).toThrow();
  });
});

it('migrates v9 databases and reruns idempotently', async () => {
  await sql((s) => {
    s.sql.exec('DROP TABLE passkeys; DROP TABLE webauthn_challenges;');
    setSetting(s, 'schema_version', 9);
    migrate(s);
    migrate(s);
    expect(getSetting(s, 'schema_version')).toBe(16);
    expect(
      s.sql
        .exec(
          "SELECT name FROM sqlite_master WHERE name IN ('passkeys','webauthn_challenges') ORDER BY name",
        )
        .toArray(),
    ).toEqual([{ name: 'passkeys' }, { name: 'webauthn_challenges' }]);
    setSetting(s, 'schema_version', 12);
    migrate(s);
    expect(getSetting(s, 'schema_version')).toBe(16);
  });
});
