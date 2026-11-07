/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  AccountDataExport,
  AuditLog,
  CommentWithAuthor,
  EntryDetail,
  LeaderboardRow,
  Page,
  RosterChoice,
  User,
} from '../../shared/types';
import type { Env } from './index';
import { migrate } from './db/migrate';
import { setSetting } from './db/settings';
import { insertRosterFixture } from './testFixtures';
import { REDACTED_AUDIT_DETAIL } from './db/account';

const bindings = env as unknown as Env;
const NOW = '2026-03-09T18:00:00Z';
type Client = { cookie: string; user: User; rosterId: string };
const stub = () => bindings.TEAM.get(bindings.TEAM.idFromName('stanford'));
function sql<T>(callback: (storage: DurableObjectStorage) => T): Promise<T> {
  return runInDurableObject(stub(), (_instance, state) => callback(state.storage));
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
async function ok(response: Response | Promise<Response>) {
  const result = await response;
  expect(result.status, await result.clone().text()).toBeLessThan(300);
  return result;
}
async function user(name: string, role = 'rower'): Promise<Client> {
  const email = name.toLowerCase().replaceAll(' ', '.') + '@example.com';
  const rosterId = await sql((storage) =>
    insertRosterFixture(storage, name, role, role === 'rower' ? null : email),
  );
  const response = await api('/auth/signup', undefined, 'POST', {
    roster_id: rosterId,
    email,
    password: 'password123',
    team_code: 'team-code',
  });
  expect(response.status, await response.clone().text()).toBe(201);
  return {
    cookie: response.headers.get('Set-Cookie')!.split(';')[0],
    user: await response.json<User>(),
    rosterId,
  };
}
async function workout(client: Client, extra: Record<string, unknown> = {}) {
  return (
    await ok(
      api('/entries', client, 'POST', {
        date: '2026-03-09',
        modality: 'erg',
        zone: 'E',
        distance_m: 10000,
        title: client.user.name + ' workout',
        notes: client.user.name + ' private notes',
        visibility: 'team',
        ...extra,
      }),
    )
  ).json<EntryDetail>();
}
async function image(client: Client) {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 2);
  view.setUint32(20, 3);
  const response = await ok(
    SELF.fetch('https://oyo.test/api/images', {
      method: 'POST',
      headers: { Cookie: client.cookie, 'Content-Type': 'image/png', 'X-OYO-Test-Now': NOW },
      body: bytes,
    }),
  );
  return (await response.json<{ id: string }>()).id;
}
async function comment(client: Client, entryId: string, body: string, mentionIds: string[] = []) {
  return (
    await ok(
      api('/entries/' + entryId + '/comments', client, 'POST', { body, mention_ids: mentionIds }),
    )
  ).json<CommentWithAuthor>();
}
function plan(start: string, note: string) {
  return {
    start_date: start,
    sessions: [
      { week: 1, day: 0, slot: 'AM', modality: 'erg', zone: 'E', distance_m: 10000, note },
    ],
    rest_days: [{ week: 2, day: 6 }],
  };
}
const remove = (client: Client, target: string, body: unknown) =>
  api('/admin/users/' + target + '/remove', client, 'POST', body);
const USER_TABLES: [string, string][] = [
  ['users', 'id'],
  ['sessions', 'user_id'],
  ['reauth_grants', 'user_id'],
  ['entries', 'user_id'],
  ['images', 'owner_id'],
  ['entry_tags', 'user_id'],
  ['kudos', 'user_id'],
  ['comments', 'user_id'],
  ['comment_mentions', 'user_id'],
  ['notifications', 'user_id'],
  ['notifications', 'actor_id'],
  ['announcements', 'author_id'],
  ['my_plans', 'user_id'],
  ['my_plan_sessions', 'user_id'],
  ['weekly_targets', 'user_id'],
  ['stats_versions', 'user_id'],
  ['roster', 'claimed_by_user_id'],
  ['roster', 'added_by'],
];
function references(storage: DurableObjectStorage, id: string) {
  return Object.fromEntries(
    USER_TABLES.map(([table, column]) => [
      `${table}.${column}`,
      storage.sql
        .exec<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = ?`, id)
        .one().count,
    ]),
  );
}

beforeEach(async () => {
  await api('/health');
  await sql((storage) =>
    storage.transactionSync(() => {
      storage.sql.exec('DROP TRIGGER IF EXISTS fail_user_delete');
      for (const table of [
        'roster',
        'users',
        'sessions',
        'reauth_grants',
        'weekly_targets',
        'rate_limits',
        'entries',
        'images',
        'entry_images',
        'entry_tags',
        'kudos',
        'comments',
        'comment_mentions',
        'notifications',
        'announcements',
        'audit_log',
        'my_plans',
        'my_plan_sessions',
        'stats_versions',
      ])
        storage.sql.exec(`DELETE FROM ${table}`);
      storage.sql.exec('DROP TABLE IF EXISTS user_intro');
      migrate(storage);
      setSetting(storage, 'team_code', 'team-code');
    }),
  );
});

describe('GET /api/me/export', () => {
  it('returns only the caller’s own data as a private, non-cacheable attachment', async () => {
    const avery = await user('Avery Export');
    const blake = await user('Blake Other');
    const photo = await image(avery);
    const avatar = await image(avery);
    await ok(api('/me', avery, 'PATCH', { avatar_image_id: avatar, bio: 'Avery bio' }));
    await ok(api('/me/target', avery, 'PUT', { target_m: 90000 }));
    const own = await workout(avery, { image_ids: [photo], tagged_user_ids: [blake.user.id] });
    const blakeEntry = await workout(blake, { tagged_user_ids: [avery.user.id] });
    const mine = await comment(avery, blakeEntry.id, 'Nice one @Blake Other', [blake.user.id]);
    await comment(blake, own.id, 'Blake secret comment text');
    const blakeMention = await comment(blake, blakeEntry.id, 'Thanks @Avery Export', [
      avery.user.id,
    ]);
    await ok(api('/entries/' + blakeEntry.id + '/kudos', avery, 'POST'));
    await ok(api('/entries/' + own.id + '/kudos', blake, 'POST'));
    await ok(api('/me/plan', avery, 'PUT', plan('2026-03-09', 'Avery plan A')));
    await ok(api('/me/plan', avery, 'PUT', plan('2026-02-09', 'Avery plan B')));
    await ok(api('/me/plan', blake, 'PUT', plan('2026-03-09', 'Blake private plan')));
    const verify = await ok(
      api('/me/password/verify', avery, 'POST', { current_password: 'password123' }),
    );
    const { reauth_token } = await verify.json<{ reauth_token: string }>();

    expect((await api('/me/export')).status).toBe(401);
    const response = await ok(api('/me/export', avery));
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="oyo-my-data-2026-03-09.json"',
    );
    const text = await response.text();
    const data = JSON.parse(text) as AccountDataExport;
    expect(Object.keys(data).sort()).toEqual(
      [
        'comments',
        'exported_at',
        'format_version',
        'images',
        'kudos_given',
        'mentioned_in',
        'plans',
        'profile',
        'roster',
        'tagged_in',
        'weekly_targets',
        'workouts',
      ].sort(),
    );
    expect(data.format_version).toBe(1);
    expect(data.exported_at).toBe('2026-03-09T18:00:00.000Z');
    expect(data.profile).toMatchObject({
      id: avery.user.id,
      email: 'avery.export@example.com',
      bio: 'Avery bio',
      avatar_image_id: avatar,
    });
    expect(data.roster).toMatchObject({ id: avery.rosterId, claimed_by_user_id: avery.user.id });
    expect(data.weekly_targets).toEqual([
      { user_id: avery.user.id, week_start: '2026-03-09', target_m: 90000 },
    ]);
    expect(data.workouts).toHaveLength(1);
    expect(data.workouts[0]).toMatchObject({
      id: own.id,
      notes: 'Avery Export private notes',
      tagged: [{ id: blake.user.id, name: 'Blake Other' }],
      kudos_count: 1,
      comment_count: 1,
    });
    expect(data.workouts[0].images.map((row) => row.id)).toEqual([photo]);
    expect(data.images.map((row) => row.id).sort()).toEqual([photo, avatar].sort());
    expect(data.comments).toEqual([
      expect.objectContaining({
        id: mine.id,
        body: 'Nice one @Blake Other',
        mentions: [{ id: blake.user.id, name: 'Blake Other' }],
      }),
    ]);
    expect(data.kudos_given).toEqual([
      { entry_id: blakeEntry.id, user_id: avery.user.id, created_at: '2026-03-09T18:00:00.000Z' },
    ]);
    expect(data.plans.map((row) => row.start_date)).toEqual(['2026-02-09', '2026-03-09']);
    expect(data.plans[1].sessions[0]).toMatchObject({
      note: 'Avery plan A',
      equiv_m: 10000,
      completed_entry_id: own.id,
    });
    expect(data.tagged_in).toEqual([
      {
        entry_id: blakeEntry.id,
        entry_owner_id: blake.user.id,
        tagged_at: '2026-03-09T18:00:00.000Z',
      },
    ]);
    expect(data.mentioned_in).toEqual([
      {
        comment_id: blakeMention.id,
        entry_id: blakeEntry.id,
        author_id: blake.user.id,
        created_at: '2026-03-09T18:00:00.000Z',
      },
    ]);
    for (const secret of [
      'password_hash',
      'password_salt',
      'pbkdf2',
      'token_hash',
      reauth_token,
      'blake.other@example.com',
      'Blake private plan',
      'Blake secret comment text',
      'Thanks @Avery Export',
      'Blake Other private notes',
      'bytes',
    ])
      expect(text).not.toContain(secret);
    const blakeData = await (await ok(api('/me/export', blake))).json<AccountDataExport>();
    expect(blakeData.profile.id).toBe(blake.user.id);
    expect(JSON.stringify(blakeData)).not.toContain('Avery plan');
  });
  it('exports the caller’s workouts as CSV with formula guards', async () => {
    const avery = await user('Avery Csv');
    const blake = await user('Blake Csv');
    await workout(avery, { title: '=SUM(A1)', notes: 'line one\nline two' });
    await workout(blake);
    const response = await ok(api('/me/export/workouts', avery));
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="oyo-my-workouts-2026-03-09.csv"',
    );
    const lines = (await response.text()).split('\r\n');
    expect(lines[0]).toBe(
      'id,date,week_start,modality,zone,distance_m,duration_s,avg_split_s,stroke_rate,avg_hr,mode_factor,zone_factor,equiv_m,title,notes,created_at,updated_at',
    );
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain(',\'=SUM(A1),"line one\nline two",');
    expect(lines.join('')).not.toContain('Blake Csv');
    expect((await api('/me/export/workouts')).status).toBe(401);
  });
});

describe('POST /api/admin/users/:id/remove', () => {
  it('is admin-only, refuses self/staff, and requires the exact target email', async () => {
    const admin = await user('Admin Person', 'admin');
    const cox = await user('Cox Person', 'coxswain');
    const rower = await user('Rower Person');
    const other = await user('Other Rower');
    const body = { confirmation_email: rower.user.email };
    expect((await remove(other, rower.user.id, body)).status).toBe(403);
    expect((await remove(cox, rower.user.id, body)).status).toBe(403);
    expect((await remove(rower, rower.user.id, body)).status).toBe(403);
    expect(
      (await api('/admin/users/' + rower.user.id + '/remove', undefined, 'POST', body)).status,
    ).toBe(401);
    const noCsrf = await SELF.fetch(
      'https://oyo.test/api/admin/users/' + rower.user.id + '/remove',
      { method: 'POST', headers: { Cookie: admin.cookie, 'X-OYO-Test-Now': NOW } },
    );
    expect(noCsrf.status).toBe(403);
    const self = await remove(admin, admin.user.id, { confirmation_email: admin.user.email });
    expect(self.status).toBe(409);
    expect((await remove(admin, cox.user.id, { confirmation_email: cox.user.email })).status).toBe(
      409,
    );
    expect((await remove(admin, 'missing', body)).status).toBe(404);
    expect((await remove(admin, rower.user.id, {})).status).toBe(400);
    const mismatch = await remove(admin, rower.user.id, {
      confirmation_email: other.user.email,
    });
    expect(mismatch.status).toBe(400);
    expect((await mismatch.json<{ error: { code: string } }>()).error.code).toBe(
      'CONFIRMATION_MISMATCH',
    );
    expect((await api('/me', rower)).status).toBe(200);
    const removed = await remove(admin, rower.user.id, {
      confirmation_email: '  ROWER.Person@Example.com ',
    });
    expect(removed.status).toBe(204);
    expect((await remove(admin, rower.user.id, body)).status).toBe(404);
    // A rower demoted from staff can be removed once their role is rower.
    await ok(api('/admin/users/' + cox.user.id, admin, 'PATCH', { role: 'rower' }));
    expect((await remove(admin, cox.user.id, { confirmation_email: cox.user.email })).status).toBe(
      204,
    );
  });

  it('removes the account, credentials, content and structured references atomically', async () => {
    const admin = await user('Admin Person', 'admin');
    const cox = await user('Cox Person', 'coxswain');
    const avery = await user('Avery Removed');
    const blake = await user('Blake Kept');
    const casey = await user('Casey Kept');
    await sql((storage) =>
      storage.sql.exec(
        'CREATE TABLE user_intro (user_id TEXT PRIMARY KEY, completed_at TEXT NOT NULL)',
      ),
    );
    await sql((storage) => {
      for (const id of [avery.user.id, blake.user.id])
        storage.sql.exec('INSERT INTO user_intro VALUES (?,?)', id, NOW);
    });
    const photo = await image(avery);
    const avatar = await image(avery);
    await image(avery); // unattached upload
    await ok(api('/me', avery, 'PATCH', { avatar_image_id: avatar }));
    await ok(api('/me/target', avery, 'PUT', { target_m: 90000 }));
    await ok(api('/me/plan', avery, 'PUT', plan('2026-03-09', 'Avery plan')));
    const averyEntry = await workout(avery, {
      image_ids: [photo],
      tagged_user_ids: [blake.user.id],
      distance_m: 60000,
    });
    const blakeEntry = await workout(blake, {
      tagged_user_ids: [avery.user.id, casey.user.id],
    });
    await comment(blake, averyEntry.id, 'Blake on Avery entry');
    await comment(avery, blakeEntry.id, 'Avery secret comment @Blake Kept', [blake.user.id]);
    const kept = await comment(blake, blakeEntry.id, 'Thanks @Avery Removed and @Casey Kept', [
      avery.user.id,
      casey.user.id,
    ]);
    await ok(api('/entries/' + blakeEntry.id + '/kudos', avery, 'POST'));
    await ok(api('/entries/' + blakeEntry.id + '/kudos', casey, 'POST'));
    await ok(api('/entries/' + averyEntry.id + '/kudos', blake, 'POST'));
    await ok(api('/me/password/verify', avery, 'POST', { current_password: 'password123' }));
    await api('/auth/login', undefined, 'POST', {
      email: avery.user.email,
      password: 'wrong-pass',
    });
    // Audit history that snapshots Avery's PII and workout content.
    await ok(api('/admin/users/' + avery.user.id, cox, 'PATCH', { group_key: 'u23' }));
    await ok(api('/entries/' + averyEntry.id, cox, 'PATCH', { notes: 'Avery edited notes' }));
    await ok(
      api('/admin/presets', cox, 'POST', {
        name: 'Kept preset',
        modality: 'erg',
        zone: 'E',
        distance_m: 1000,
        sort: 1,
        active: true,
      }),
    );
    const before = await (
      await ok(api('/leaderboard?metric=meters', admin))
    ).json<LeaderboardRow[]>();
    expect(before[0].user.id).toBe(avery.user.id);
    const blakeBefore = await sql((storage) => references(storage, blake.user.id));

    const response = await remove(admin, avery.user.id, {
      confirmation_email: avery.user.email,
    });
    expect(response.status).toBe(204);

    const roster = await (
      await ok(api('/auth/roster', undefined, 'POST', { team_code: 'team-code' }))
    ).json<RosterChoice[]>();
    expect(roster.some((row) => row.name === 'Avery Removed')).toBe(false);

    const state = await sql((storage) => ({
      refs: references(storage, avery.user.id),
      blake: references(storage, blake.user.id),
      roster: storage.sql.exec('SELECT * FROM roster WHERE id = ?', avery.rosterId).toArray(),
      entryRefs: [
        'entry_images',
        'entry_tags',
        'kudos',
        'comments',
        'comment_mentions',
        'notifications',
      ].map(
        (table) =>
          storage.sql
            .exec<{ count: number }>(
              `SELECT COUNT(*) AS count FROM ${table} WHERE entry_id = ?`,
              averyEntry.id,
            )
            .one().count,
      ),
      images: storage.sql.exec<{ count: number }>('SELECT COUNT(*) AS count FROM images').one()
        .count,
      rateLimits: storage.sql
        .exec<{ email: string }>('SELECT email FROM rate_limits')
        .toArray()
        .map((row) => row.email),
      intro: storage.sql.exec<{ user_id: string }>('SELECT user_id FROM user_intro').toArray(),
      audit: storage.sql
        .exec<{ [K in keyof AuditLog]: AuditLog[K] }>(
          'SELECT * FROM audit_log ORDER BY created_at,id',
        )
        .toArray(),
      dump: JSON.stringify(
        ['users', 'roster', 'entries', 'comments', 'notifications', 'audit_log', 'rate_limits'].map(
          (table) => storage.sql.exec(`SELECT * FROM ${table}`).toArray(),
        ),
      ),
    }));
    expect(
      Object.values(state.refs).every((count) => count === 0),
      JSON.stringify(state.refs),
    ).toBe(true);
    expect(state.roster).toEqual([]);
    expect(state.entryRefs).toEqual([0, 0, 0, 0, 0, 0]);
    expect(state.images).toBe(0);
    expect(state.rateLimits).not.toContain('auth-email:' + avery.user.email);
    expect(state.intro).toEqual([{ user_id: blake.user.id }]);
    for (const secret of [
      avery.user.email,
      'Avery Removed',
      'Avery Export',
      'Avery secret comment',
      'Avery edited notes',
      'Avery Removed private notes',
      'Avery plan',
    ])
      // Other users' free text (Blake's '@Avery Removed' comment) is intentionally kept.
      expect(state.dump.replaceAll(kept.body, ''), secret).not.toContain(secret);
    // Blake loses only what hung off Avery: his comment and kudos on Avery's deleted workout, his
    // tag on that workout, Avery's mention of him, and notifications Avery caused. Casey's kudos
    // notification and Blake's own tag/mention notifications to Casey remain.
    expect(state.blake).toMatchObject({
      ...blakeBefore,
      'kudos.user_id': blakeBefore['kudos.user_id'] - 1,
      'comments.user_id': blakeBefore['comments.user_id'] - 1,
      'entry_tags.user_id': 0,
      'comment_mentions.user_id': 0,
      'notifications.user_id': 1,
      'notifications.actor_id': 2,
      'stats_versions.user_id': 1,
    });
    // Checked after the snapshot: a failed login for any email records a rate-limit attempt.
    expect((await api('/me', avery)).status).toBe(401);
    expect(
      (
        await api('/auth/login', undefined, 'POST', {
          email: avery.user.email,
          password: 'password123',
        })
      ).status,
    ).toBe(401);
    const entry = await (await ok(api('/entries/' + blakeEntry.id, blake))).json<EntryDetail>();
    expect(entry.tagged.map((row) => row.id)).toEqual([casey.user.id]);
    expect(entry.kudos_count).toBe(1);
    expect(entry.comment_count).toBe(1);
    const comments = await (
      await ok(api('/entries/' + blakeEntry.id + '/comments', blake))
    ).json<CommentWithAuthor[]>();
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ id: kept.id, body: kept.body });
    expect(comments[0].mentions.map((row) => row.id)).toEqual([casey.user.id]);
    expect((await api('/entries/' + averyEntry.id, blake)).status).toBe(404);
    const feed = await (await ok(api('/entries?scope=feed', blake))).json<Page<EntryDetail>>();
    expect(feed.items.map((row) => row.id)).toEqual([blakeEntry.id]);
    const after = await (
      await ok(api('/leaderboard?metric=meters', admin))
    ).json<LeaderboardRow[]>();
    expect(after.map((row) => row.user.id)).not.toContain(avery.user.id);
    const users = await (await ok(api('/users', blake))).json<User[]>();
    expect(users.map((row) => row.id)).not.toContain(avery.user.id);

    const redacted = state.audit.filter((row) => row.detail_json === REDACTED_AUDIT_DETAIL);
    expect(redacted.map((row) => row.action).sort()).toEqual(['entry.update', 'user.update']);
    expect(state.audit.find((row) => row.action === 'preset.create')!.detail_json).toContain(
      'Kept preset',
    );
    const event = state.audit.find((row) => row.action === 'user.remove')!;
    expect(event).toMatchObject({ actor_id: admin.user.id, target: avery.user.id });
    expect(JSON.parse(event.detail_json)).toEqual({
      before: { role: 'rower', active: true },
      after: {
        removed: { workouts: 1, comments: 1, kudos: 1, images: 3, plans: 1, weekly_targets: 1 },
      },
    });
    // The removed name and email are free for a new roster row and signup.
    const fresh = await user('Avery Removed');
    expect(fresh.user.email).toBe(avery.user.email);
    expect(fresh.user.id).not.toBe(avery.user.id);
  });

  it('rolls back every deletion when removal fails part-way', async () => {
    const admin = await user('Admin Person', 'admin');
    const avery = await user('Avery Rollback');
    await workout(avery);
    await sql((storage) =>
      storage.sql.exec(
        "CREATE TRIGGER fail_user_delete BEFORE DELETE ON users BEGIN SELECT RAISE(ABORT, 'boom'); END",
      ),
    );
    const before = await sql((storage) => references(storage, avery.user.id));
    const response = await remove(admin, avery.user.id, { confirmation_email: avery.user.email });
    expect(response.status).toBe(500);
    expect(await sql((storage) => references(storage, avery.user.id))).toEqual(before);
    expect((await api('/me', avery)).status).toBe(200);
    expect(
      await sql((storage) =>
        storage.sql.exec("SELECT * FROM audit_log WHERE action = 'user.remove'").toArray(),
      ),
    ).toEqual([]);
  });

  it('removes inactive and unlinked rower accounts too', async () => {
    const admin = await user('Admin Person', 'admin');
    const avery = await user('Avery Unlinked');
    await workout(avery);
    await ok(api('/admin/roster/' + avery.rosterId + '/unlink', admin, 'POST'));
    expect(
      (await remove(admin, avery.user.id, { confirmation_email: avery.user.email })).status,
    ).toBe(204);
    const state = await sql((storage) => ({
      refs: references(storage, avery.user.id),
      roster: storage.sql
        .exec<{ name: string }>('SELECT name FROM roster WHERE id = ?', avery.rosterId)
        .toArray(),
      unlinkAudit: storage.sql
        .exec<{ [K in keyof AuditLog]: AuditLog[K] }>(
          "SELECT * FROM audit_log WHERE action = 'roster.unlink'",
        )
        .toArray(),
    }));
    expect(Object.values(state.refs).every((count) => count === 0)).toBe(true);
    // An already-unlinked roster row is no longer this account's, so it is kept.
    expect(state.roster).toEqual([{ name: 'Avery Unlinked' }]);
    expect(state.unlinkAudit[0].detail_json).toBe(REDACTED_AUDIT_DETAIL);
  });
});
