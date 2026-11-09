/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './index';
import type { EntryDetail, PushConfig, User } from '../../shared/types';
import { migrateLegacyFixture as migrate } from './migrationFixture';
import { getSetting, setSetting } from './db/settings';
import { insertRosterFixture } from './testFixtures';
import { notify } from './db/notifications';
import { deliverPush, pushPayload, PUSH_MAX_ATTEMPTS, type PushPayload } from './push/deliver';
import { MAX_PUSH_DEVICES } from './routes/push';
import { enqueueReminders, reminderEligible } from './push/reminders';
import { base64url, encryptPayload, fromBase64url, vapidConfig, vapidJwt } from './push/webpush';

const bindings = env as unknown as Env;
const NOW = '2026-03-09T18:00:00Z';
const encoder = new TextEncoder();
type Client = { cookie: string; user: User };
function sql<T>(callback: (storage: DurableObjectStorage) => T | Promise<T>): Promise<T> {
  return runInDurableObject(
    bindings.TEAM.get(bindings.TEAM.idFromName('stanford')),
    (_instance, state) => callback(state.storage),
  );
}
function api(path: string, client?: Client, method = 'GET', body?: unknown) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method,
    headers: {
      'X-OYO-CSRF': '1',
      'X-OYO-Test-Now': NOW,
      ...(client ? { Cookie: client.cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function user(name: string): Promise<Client> {
  const email = `${name.toLowerCase()}@example.com`;
  const id = await sql((storage) => insertRosterFixture(storage, name, 'rower', null));
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
async function entry(owner: Client, title = 'Morning 6k') {
  const response = await api('/entries', owner, 'POST', {
    date: '2026-03-09',
    modality: 'erg',
    zone: 'E',
    distance_m: 6000,
    title,
    notes: '',
  });
  expect(response.status).toBe(201);
  return response.json<EntryDetail>();
}
async function device(endpoint = `https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`) {
  const keys = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const p256dh = new Uint8Array(
    (await crypto.subtle.exportKey('raw', keys.publicKey)) as ArrayBuffer,
  );
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    keys,
    authBytes: auth,
    p256dhBytes: p256dh,
    input: { endpoint, keys: { p256dh: base64url(p256dh), auth: base64url(auth) } },
  };
}
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8),
  );
}
async function decrypt(
  body: Uint8Array,
  privateKey: CryptoKey,
  p256dh: Uint8Array,
  auth: Uint8Array,
) {
  const salt = body.slice(0, 16);
  expect(new DataView(body.buffer, body.byteOffset).getUint32(16)).toBe(4096);
  const idLength = body[20];
  const serverKey = body.slice(21, 21 + idLength);
  const remote = await crypto.subtle.importKey(
    'raw',
    serverKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: remote } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      privateKey,
      256,
    ),
  );
  const info = new Uint8Array([...encoder.encode('WebPush: info\0'), ...p256dh, ...serverKey]);
  const ikm = await hkdf(auth, shared, info, 32);
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, body.slice(21 + idLength)),
  );
  expect(plain.at(-1)).toBe(2);
  return new TextDecoder().decode(plain.slice(0, -1));
}
function stubFetch(status: number | (() => Promise<Response>)) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    calls.push({ url: String(input), init: init! });
    return typeof status === 'number' ? new Response(null, { status }) : status();
  });
  return calls;
}
const outbox = () =>
  sql((storage) =>
    storage.sql
      .exec<{
        id: number;
        endpoint: string;
        attempts: number;
        next_at: number;
      }>('SELECT * FROM push_outbox ORDER BY id')
      .toArray(),
  );
const subscriptions = () =>
  sql((storage) =>
    storage.sql
      .exec<{ endpoint: string; user_id: string }>('SELECT * FROM push_subscriptions')
      .toArray(),
  );

beforeEach(async () => {
  await api('/health');
  await sql(async (storage) => {
    await storage.deleteAlarm();
    storage.transactionSync(() => {
      for (const table of [
        'roster',
        'users',
        'sessions',
        'settings',
        'rate_limits',
        'entries',
        'kudos',
        'comments',
        'audit_log',
        'notifications',
        'announcements',
        'push_subscriptions',
        'push_outbox',
        'reminder_sends',
        'my_plans',
      ])
        storage.sql.exec(`DELETE FROM ${table}`);
      migrate(storage);
      setSetting(storage, 'team_code', 'team-code');
    });
  });
});
afterEach(() => vi.restoreAllMocks());

describe('web push encryption (RFC 8291 / RFC 8292)', () => {
  it('matches the RFC 8291 appendix A test vector', async () => {
    const asPublic = fromBase64url(
      'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
    );
    const asPrivate = await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'EC',
        crv: 'P-256',
        x: base64url(asPublic.slice(1, 33)),
        y: base64url(asPublic.slice(33)),
        d: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
      },
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    );
    const publicKey = await crypto.subtle.importKey(
      'raw',
      asPublic,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      [],
    );
    const body = await encryptPayload(
      fromBase64url('V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24'),
      fromBase64url(
        'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
      ),
      fromBase64url('BTBZMqHH6r4Tts7J_aSIgg'),
      {
        salt: fromBase64url('DGv6ra1nlYgDCS1FRnbzlw'),
        localKeys: { publicKey, privateKey: asPrivate },
      },
    );
    expect(base64url(body)).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    );
  });
  it('round-trips with a fresh salt and ephemeral key each time', async () => {
    const ua = await device();
    const first = await encryptPayload(encoder.encode('hello'), ua.p256dhBytes, ua.authBytes);
    const second = await encryptPayload(encoder.encode('hello'), ua.p256dhBytes, ua.authBytes);
    expect(base64url(first)).not.toBe(base64url(second));
    expect(await decrypt(first, ua.keys.privateKey, ua.p256dhBytes, ua.authBytes)).toBe('hello');
  });
  it('signs a verifiable ES256 VAPID JWT and rejects incomplete configuration', async () => {
    const vapid = (await vapidConfig(bindings))!;
    expect(vapid.publicKey).toBe(bindings.VAPID_PUBLIC_KEY);
    const now = Date.parse(NOW);
    const token = await vapidJwt(vapid, 'https://fcm.googleapis.com', now);
    expect(await vapidJwt(vapid, 'https://fcm.googleapis.com', now + 1000)).toBe(token);
    const [header, claims, signature] = token.split('.');
    expect(JSON.parse(new TextDecoder().decode(fromBase64url(claims)))).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: now / 1000 + 12 * 3600,
      sub: 'mailto:oyo-test@example.com',
    });
    const verify = await crypto.subtle.importKey(
      'raw',
      fromBase64url(vapid.publicKey),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    expect(
      await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        verify,
        fromBase64url(signature),
        encoder.encode(`${header}.${claims}`),
      ),
    ).toBe(true);
    expect(await vapidConfig({ ...bindings, VAPID_PRIVATE_KEY: undefined })).toBeNull();
    expect(await vapidConfig({ ...bindings, VAPID_SUBJECT: 'not-a-contact' })).toBeNull();
    expect(await vapidConfig({ ...bindings, VAPID_PRIVATE_KEY: 'AAAA' })).toBeNull();
  });
});

it('builds push copy and deep links for every notification kind', () => {
  const base = {
    id: 1,
    attempts: 0,
    owner: 'u',
    recipient: 'u',
    notification_id: 'n1',
    endpoint: 'https://fcm.googleapis.com/x',
    p256dh: '',
    auth: '',
    entry_id: 'e/1',
    created_at: NOW,
    read_at: null,
    actor_name: 'Avery Lee',
    entry_title: 'Morning 6k',
    announcement_title: null,
    reminder_date: null,
  };
  const cases = [
    ['kudos', 'Gave kudos to Morning 6k', '/entries/e%2F1', 'kudos:e/1'],
    ['comment', 'Commented on Morning 6k', '/entries/e%2F1#comments', 'n1'],
    ['mention', 'Mentioned you in Morning 6k', '/entries/e%2F1#comments', 'n1'],
    ['tag', 'Tagged you in Morning 6k', '/entries/e%2F1', 'n1'],
    ['report', 'Reported Morning 6k', '/admin/reports', 'n1'],
  ] as const;
  for (const [kind, body, url, tag] of cases)
    expect(pushPayload({ ...base, kind }, 120)).toEqual({
      title: 'Avery Lee',
      body,
      url,
      tag,
      badge: 99,
    });
  expect(
    pushPayload(
      { ...base, kind: 'announcement', entry_id: null, announcement_title: 'x'.repeat(200) },
      0,
    ),
  ).toMatchObject({
    url: '/announcements',
    badge: 0,
    body: expect.stringMatching(/^Announcement: x+…$/),
  });
  expect(pushPayload({ ...base, kind: 'tag', entry_title: ' ' }, 1).body).toBe(
    'Tagged you in your workout',
  );
});

describe('push subscription routes', () => {
  it('exposes only the public key and requires sign-in', async () => {
    expect((await api('/me/push')).status).toBe(401);
    const a = await user('Avery');
    const response = await api('/me/push', a);
    expect(response.status).toBe(200);
    expect(await response.json<PushConfig>()).toEqual({ public_key: bindings.VAPID_PUBLIC_KEY });
  });
  it('validates, upserts, reassigns, caps and removes device subscriptions', async () => {
    const a = await user('Avery');
    const b = await user('Blake');
    const ua = await device();
    for (const bad of [
      { ...ua.input, endpoint: 'https://evil.example.com/push' },
      { ...ua.input, endpoint: 'http://fcm.googleapis.com/fcm/send/x' },
      { ...ua.input, keys: { ...ua.input.keys, p256dh: 'AAAA' } },
      { ...ua.input, keys: { ...ua.input.keys, auth: '***' } },
      { endpoint: ua.input.endpoint },
    ])
      expect((await api('/me/push', a, 'PUT', bad)).status).toBe(400);
    expect((await api('/me/push', a, 'PUT', ua.input)).status).toBe(204);
    expect((await api('/me/push', a, 'PUT', ua.input)).status).toBe(204);
    expect(await subscriptions()).toEqual([
      expect.objectContaining({ endpoint: ua.input.endpoint, user_id: a.user.id }),
    ]);
    expect((await api('/me/push', b, 'PUT', ua.input)).status).toBe(204);
    expect((await subscriptions())[0].user_id).toBe(b.user.id);
    expect((await api('/me/push', a, 'DELETE', { endpoint: ua.input.endpoint })).status).toBe(204);
    expect(await subscriptions()).toHaveLength(1);
    expect((await api('/me/push', b, 'DELETE', { endpoint: ua.input.endpoint })).status).toBe(204);
    expect(await subscriptions()).toEqual([]);
    for (let i = 0; i <= MAX_PUSH_DEVICES; i++)
      expect(
        (
          await api('/me/push', a, 'PUT', {
            ...ua.input,
            endpoint: `https://web.push.apple.com/device-${i}`,
          })
        ).status,
      ).toBe(204);
    expect(await subscriptions()).toHaveLength(MAX_PUSH_DEVICES);
  });
  it('accepts major push services', async () => {
    const a = await user('Avery');
    const ua = await device();
    for (const endpoint of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/QGx',
      'https://wns2-by3p.notify.windows.com/w/?token=abc',
    ])
      expect((await api('/me/push', a, 'PUT', { ...ua.input, endpoint })).status).toBe(204);
  });
});

describe('push delivery', () => {
  it('selects only opted-in active locked rowers with devices, once per team-local day', async () => {
    const people = await Promise.all(
      ['Eligible', 'Staff', 'Inactive', 'Logged', 'Rest', 'NoDevice', 'Off'].map(user),
    );
    for (const person of people.filter((p) => p.user.name !== 'NoDevice')) {
      const target = await device();
      expect((await api('/me/push', person, 'PUT', target.input)).status).toBe(204);
    }
    await entry(people[3]);
    await sql((storage) => {
      storage.sql.exec("UPDATE users SET role='coach' WHERE id=?", people[1].user.id);
      storage.sql.exec('UPDATE users SET active=0 WHERE id=?', people[2].user.id);
    });
    expect((await api('/me', people[6], 'PATCH', { evening_reminder: false })).status).toBe(200);
    expect((await api('/me', people[6], 'PATCH', { evening_reminder: 'false' })).status).toBe(400);
    await sql(async (storage) => {
      storage.sql.exec(
        `INSERT INTO my_plans (user_id,start_date,rest_days_json,updated_at)
        VALUES (?,?,?,?)`,
        people[4].user.id,
        '2026-03-09',
        '[{"week":1,"day":0}]',
        NOW,
      );
      await enqueueReminders(storage, new Date('2026-03-10T01:30:00Z'));
      expect(storage.sql.exec('SELECT * FROM push_outbox').toArray()).toHaveLength(0);
      await enqueueReminders(storage, new Date('2026-03-10T02:30:00Z'));
      await enqueueReminders(storage, new Date('2026-03-10T02:30:00Z'));
      await enqueueReminders(storage, new Date('2026-03-10T03:30:00Z'));
      expect(storage.sql.exec('SELECT user_id,date FROM reminder_sends').toArray()).toEqual([
        { user_id: people[0].user.id, date: '2026-03-09' },
      ]);
      expect(storage.sql.exec('SELECT * FROM push_outbox').toArray()).toHaveLength(1);
    });
    const calls = stubFetch(201);
    await sql((storage) => deliverPush(storage, bindings, Date.parse('2026-03-10T02:31:00Z')));
    expect(calls).toHaveLength(1);
    expect(await outbox()).toHaveLength(0);
  });

  it('covers standard time and drops reminders when a workout is logged before delivery', async () => {
    const person = await user('LateLogger');
    const target = await device();
    await api('/me/push', person, 'PUT', target.input);
    await sql(async (storage) => {
      await enqueueReminders(storage, new Date('2026-01-10T02:30:00Z'));
      expect(storage.sql.exec('SELECT * FROM push_outbox').toArray()).toHaveLength(0);
      await enqueueReminders(storage, new Date('2026-01-10T03:30:00Z'));
      expect(storage.sql.exec('SELECT * FROM push_outbox').toArray()).toHaveLength(1);
      expect(reminderEligible(storage, person.user.id, '2026-01-09')).toBe(true);
      storage.sql.exec('UPDATE users SET evening_reminder=0 WHERE id=?', person.user.id);
      expect(reminderEligible(storage, person.user.id, '2026-01-09')).toBe(false);
      storage.sql.exec('UPDATE users SET evening_reminder=1 WHERE id=?', person.user.id);
    });
    await entry(person);
    await sql((storage) =>
      storage.sql.exec("UPDATE entries SET date='2026-01-09' WHERE user_id=?", person.user.id),
    );
    const calls = stubFetch(201);
    await sql((storage) => deliverPush(storage, bindings, Date.parse('2026-01-10T03:31:00Z')));
    expect(calls).toHaveLength(0);
    expect(await outbox()).toHaveLength(0);
  });
  it('delivers reports only to current active staff and skips empty queues', async () => {
    const staff = await user('Staff');
    const reporter = await user('Reporter');
    const row = await entry(reporter);
    const ua = await device();
    await api('/me/push', staff, 'PUT', ua.input);
    await sql((storage) =>
      storage.sql.exec("UPDATE users SET role='coach' WHERE id=?", staff.user.id),
    );
    const calls = stubFetch(201);
    await sql((storage) => deliverPush(storage, bindings, Date.now() + 1000));
    expect(calls).toEqual([]);
    await api('/reports', reporter, 'POST', { target_type: 'entry', target_id: row.id });
    expect(await outbox()).toHaveLength(1);
    await sql((storage) => deliverPush(storage, bindings, Date.now() + 1000));
    expect(calls).toHaveLength(1);
    expect(
      JSON.parse(
        await decrypt(
          new Uint8Array(calls[0].init.body as Uint8Array),
          ua.keys.privateKey,
          ua.p256dhBytes,
          ua.authBytes,
        ),
      ),
    ).toMatchObject({ url: '/admin/reports', body: 'Reported Morning 6k' });
    const next = await entry(reporter, 'Evening');
    await api('/reports', reporter, 'POST', { target_type: 'entry', target_id: next.id });
    expect(await outbox()).toHaveLength(1);
    await sql((storage) =>
      storage.sql.exec("UPDATE users SET role='rower' WHERE id=?", staff.user.id),
    );
    await sql((storage) => deliverPush(storage, bindings, Date.now() + 1000));
    expect(calls).toHaveLength(1);
    expect(await outbox()).toEqual([]);
  });
  async function kudosSetup() {
    const author = await user('Avery');
    const fan = await user('Blake');
    const ua = await device();
    expect((await api('/me/push', author, 'PUT', ua.input)).status).toBe(204);
    const row = await entry(author);
    return { author, fan, ua, row };
  }
  it('deletes only the referenced announcement notifications and queued pushes across recipients', async () => {
    const { author, fan, ua, row } = await kudosSetup();
    const other = await user('Casey');
    const ub = await device();
    expect((await api('/me/push', other, 'PUT', ub.input)).status).toBe(204);
    await sql((storage) =>
      storage.sql.exec("UPDATE users SET role='coach' WHERE id=?", fan.user.id),
    );
    const created = await api('/announcements', fan, 'POST', {
      title: 'Cancelled notice',
      body: 'Body',
      pinned: false,
    });
    expect(created.status).toBe(201);
    const { id } = await created.json<{ id: string }>();
    expect(await outbox()).toHaveLength(2);
    const kept = await api('/announcements', fan, 'POST', {
      title: 'Keep this notice',
      body: 'Body',
      pinned: false,
    });
    expect(kept.status).toBe(201);
    const keptAnnouncement = await kept.json<{ created_at: string }>();
    expect(
      (await api(`/entries/${row.id}/comments`, fan, 'POST', { body: 'Keep this comment' })).status,
    ).toBe(201);
    await sql((storage) =>
      notify(
        storage,
        other.user.id,
        fan.user.id,
        'announcement',
        null,
        keptAnnouncement.created_at,
      ),
    );
    const remaining = await sql((storage) => {
      const notifications = storage.sql.exec('SELECT * FROM notifications ORDER BY id').toArray();
      const deletedIds = notifications
        .filter((note) => note.kind === 'announcement' && note.entry_id === id)
        .map((note) => note.id);
      return {
        notifications: notifications.filter((note) => !deletedIds.includes(note.id)),
        outbox: storage.sql
          .exec('SELECT * FROM push_outbox ORDER BY id')
          .toArray()
          .filter((push) => !deletedIds.includes(push.notification_id)),
      };
    });
    expect((await api(`/announcements/${id}`, fan, 'DELETE')).status).toBe(204);
    await sql((storage) => {
      expect(storage.sql.exec('SELECT * FROM notifications ORDER BY id').toArray()).toEqual(
        remaining.notifications,
      );
      expect(storage.sql.exec('SELECT * FROM push_outbox ORDER BY id').toArray()).toEqual(
        remaining.outbox,
      );
    });
    for (const recipient of [author, other])
      expect(await (await api('/notifications', recipient)).json()).toHaveLength(2);
    expect((await api(`/announcements/${id}`, author)).status).toBe(404);
    const calls = stubFetch(201);
    await sql((storage) => deliverPush(storage, bindings, Date.now() + 1000));
    expect(calls).toHaveLength(4);
    for (const call of calls) {
      const device = call.url === ua.input.endpoint ? ua : ub;
      const payload = JSON.parse(
        await decrypt(
          new Uint8Array(call.init.body as Uint8Array),
          device.keys.privateKey,
          device.p256dhBytes,
          device.authBytes,
        ),
      ) as PushPayload;
      expect(payload.badge).toBe(2);
      expect(payload.body).not.toContain('Cancelled notice');
    }
  });
  it.each([undefined, 'missing-id'])(
    'drops an unresolved announcement push reference %s without sending',
    async (id) => {
      const { author, fan } = await kudosSetup();
      await sql((storage) =>
        notify(storage, author.user.id, fan.user.id, 'announcement', null, NOW, id),
      );
      expect(await outbox()).toHaveLength(1);
      const calls = stubFetch(201);
      await sql((storage) => deliverPush(storage, bindings, Date.now() + 1000));
      expect(calls).toHaveLength(0);
      expect(await outbox()).toEqual([]);
    },
  );
  it('queues kudos pushes and schedules the alarm without sending in the request', async () => {
    const calls = stubFetch(201);
    const { fan, row } = await kudosSetup();
    expect((await api(`/entries/${row.id}/kudos`, fan, 'POST')).status).toBeLessThan(300);
    expect(calls).toEqual([]);
    expect(await outbox()).toHaveLength(1);
    expect(await sql((storage) => storage.getAlarm())).not.toBeNull();
  });
  it('sends an encrypted, VAPID-signed payload and clears the outbox', async () => {
    const { fan, ua, row } = await kudosSetup();
    await api(`/entries/${row.id}/kudos`, fan, 'POST');
    const calls = stubFetch(201);
    await sql((storage) => deliverPush(storage, bindings, Date.now() + 1000));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(ua.input.endpoint);
    const headers = new Headers(calls[0].init.headers);
    expect(headers.get('Content-Encoding')).toBe('aes128gcm');
    expect(headers.get('TTL')).toBe('86400');
    expect(headers.get('Authorization')).toMatch(
      new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${bindings.VAPID_PUBLIC_KEY}$`),
    );
    const payload = JSON.parse(
      await decrypt(
        new Uint8Array(calls[0].init.body as Uint8Array),
        ua.keys.privateKey,
        ua.p256dhBytes,
        ua.authBytes,
      ),
    ) as PushPayload;
    expect(payload).toEqual({
      title: fan.user.name,
      body: 'Gave kudos to Morning 6k',
      url: `/entries/${row.id}`,
      tag: `kudos:${row.id}`,
      badge: 1,
    });
    expect(await outbox()).toEqual([]);
    expect(await sql((storage) => storage.getAlarm())).toBeNull();
  });
  it('covers comments, mentions, tags and announcements with deep links', async () => {
    const { author, fan, ua, row } = await kudosSetup();
    await api(`/entries/${row.id}/comments`, fan, 'POST', { body: 'Nice split' });
    const staffRoster = await sql((storage) =>
      insertRosterFixture(storage, 'Coach', 'coach', 'coach@example.com'),
    );
    const signup = await api('/auth/signup', undefined, 'POST', {
      roster_id: staffRoster,
      email: 'coach@example.com',
      password: 'password123',
      team_code: 'team-code',
    });
    const coach = { cookie: signup.headers.get('Set-Cookie')!.split(';')[0] } as Client;
    const announcement = await api('/announcements', coach, 'POST', {
      title: 'Lake closed',
      body: 'Erg today',
      pinned: false,
    });
    expect(announcement.status).toBe(201);
    const { id: announcementId } = await announcement.json<{ id: string }>();
    const calls = stubFetch(201);
    await sql((storage) => deliverPush(storage, bindings, Date.now() + 1000));
    const payloads = await Promise.all(
      calls.map(
        async (call) =>
          JSON.parse(
            await decrypt(
              new Uint8Array(call.init.body as Uint8Array),
              ua.keys.privateKey,
              ua.p256dhBytes,
              ua.authBytes,
            ),
          ) as PushPayload,
      ),
    );
    expect(
      payloads.map(({ body, url }) => ({ body, url })).sort((x, y) => x.url.localeCompare(y.url)),
    ).toEqual([
      { body: 'Announcement: Lake closed', url: `/announcements?announcement=${announcementId}` },
      { body: 'Commented on Morning 6k', url: `/entries/${row.id}#comments` },
    ]);
    expect(Math.max(...payloads.map((payload) => payload.badge))).toBe(2);
    expect(author.user.id).toBeTruthy();
  });
  it('drops gone subscriptions, retries transient failures, and skips read notifications', async () => {
    const { author, fan, row } = await kudosSetup();
    await api(`/entries/${row.id}/kudos`, fan, 'POST');
    stubFetch(503);
    const start = Date.now() + 1000;
    await sql((storage) => deliverPush(storage, bindings, start));
    const [retry] = await outbox();
    expect(retry.attempts).toBe(1);
    expect(retry.next_at).toBe(start + 30_000);
    await sql((storage) => {
      storage.sql.exec('UPDATE push_outbox SET attempts = ?', PUSH_MAX_ATTEMPTS - 1);
    });
    await sql((storage) => deliverPush(storage, bindings, retry.next_at));
    expect(await outbox()).toEqual([]);

    await api(`/entries/${row.id}/kudos`, fan, 'DELETE');
    await api(`/entries/${row.id}/kudos`, fan, 'POST');
    await api('/notifications/read', author, 'POST', { ids: [] });
    const skipped = stubFetch(201);
    await sql((storage) => deliverPush(storage, bindings, Date.now() + 1000));
    expect(skipped).toEqual([]);

    await api(`/entries/${row.id}/comments`, fan, 'POST', { body: 'Again' });
    stubFetch(410);
    await sql((storage) => deliverPush(storage, bindings, Date.now() + 1000));
    expect(await subscriptions()).toEqual([]);
    expect(await outbox()).toEqual([]);
  });
  it('discards the queue when VAPID is not configured', async () => {
    const { fan, row } = await kudosSetup();
    await api(`/entries/${row.id}/kudos`, fan, 'POST');
    const calls = stubFetch(201);
    await sql((storage) =>
      deliverPush(storage, { ...bindings, VAPID_PRIVATE_KEY: undefined }, Date.now() + 1000),
    );
    expect(calls).toEqual([]);
    expect(await outbox()).toEqual([]);
  });
});

it('migrates to v15 idempotently, with or without intermediate versions', async () => {
  await sql((storage) => {
    storage.sql.exec('DROP TABLE push_outbox; DROP TABLE push_subscriptions;');
    setSetting(storage, 'schema_version', 9);
    migrate(storage);
    migrate(storage);
    expect(getSetting(storage, 'schema_version')).toBe(21);
    expect(storage.sql.exec('SELECT * FROM push_subscriptions').toArray()).toEqual([]);
    expect(storage.sql.exec('SELECT * FROM push_outbox').toArray()).toEqual([]);
  });
});
