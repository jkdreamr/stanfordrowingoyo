/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from './index';
import type {
  CommentWithAuthor,
  EntryDetail,
  EntryInput,
  LeaderboardRow,
  Notification,
  Page,
  PublicUser,
  SeasonStats,
  User,
  WeekStats,
} from '../../shared/types';
import { migrate } from './db/migrate';
import { setSetting } from './db/settings';
import { insertRosterFixture } from './testFixtures';
import { kudosUsers } from './db/social';
const bindings = env as unknown as Env;
const NOW = '2026-03-09T18:00:00Z';
type Client = { cookie: string; user: User };
async function sql<T>(callback: (storage: DurableObjectStorage) => T): Promise<T> {
  return runInDurableObject(
    bindings.TEAM.get(bindings.TEAM.idFromName('stanford')),
    (_instance, state) => callback(state.storage),
  );
}
function api(path: string, client?: Client, method = 'GET', body?: unknown, time = NOW) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method,
    headers: {
      'X-OYO-CSRF': '1',
      'X-OYO-Test-Now': time,
      ...(client ? { Cookie: client.cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function user(name: string, role = 'rower'): Promise<Client> {
  const email = name.toLowerCase().replaceAll(' ', '') + '@example.com';
  const id = await sql((storage) =>
    insertRosterFixture(storage, name, role, role === 'rower' ? null : email),
  );
  const choices = await (
    await api('/auth/roster', undefined, 'POST', { team_code: 'team-code' })
  ).json<{ id: string }[]>();
  if (role === 'rower') expect(choices.some((row) => row.id === id)).toBe(true);
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
const input: EntryInput = {
  date: '2026-03-09',
  modality: 'erg',
  zone: 'E',
  distance_m: 10000,
  title: ' Workout ',
  notes: '',
  visibility: 'team',
};
async function entry(client: Client, patch: Partial<EntryInput> = {}, time = NOW) {
  const response = await api('/entries', client, 'POST', { ...input, ...patch }, time);
  expect(response.status).toBe(201);
  return response.json<EntryDetail>();
}
function png(width = 2, height = 3) {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}
function upload(
  client: Client,
  bytes: Uint8Array = png(),
  mime = 'image/png',
  headers: Record<string, string> = {},
) {
  return SELF.fetch('https://oyo.test/api/images', {
    method: 'POST',
    headers: {
      Cookie: client.cookie,
      'Content-Type': mime,
      'X-OYO-CSRF': '1',
      'X-OYO-Test-Now': NOW,
      ...headers,
    },
    body: bytes,
  });
}
async function image(client: Client) {
  const response = await upload(client);
  expect(response.status).toBe(201);
  return (await response.json<{ id: string }>()).id;
}
async function target(client: Client, meters: number, time = NOW) {
  expect((await api('/me/target', client, 'PUT', { target_m: meters }, time)).status).toBe(200);
}
beforeEach(async () => {
  await api('/health');
  await sql((storage) =>
    storage.transactionSync(() => {
      for (const table of [
        'entry_tags',
        'comment_mentions',
        'roster',
        'users',
        'sessions',
        'settings',
        'weekly_targets',
        'rate_limits',
        'entries',
        'images',
        'entry_images',
        'kudos',
        'comments',
        'notifications',
        'push_subscriptions',
        'push_outbox',
      ])
        storage.sql.exec(`DELETE FROM ${table}`);
      migrate(storage);
      setSetting(storage, 'team_code', 'team-code');
    }),
  );
});
describe('entries and images', () => {
  it('upgrades v6 databases with idempotent tag and mention tables', async () => {
    await sql((storage) => {
      storage.sql.exec('DROP TABLE entry_tags');
      storage.sql.exec('DROP TABLE comment_mentions');
      setSetting(storage, 'schema_version', 6);
      migrate(storage);
      migrate(storage);
      expect(storage.sql.exec('SELECT * FROM entry_tags').toArray()).toEqual([]);
      expect(storage.sql.exec('SELECT * FROM comment_mentions').toArray()).toEqual([]);
      expect(storage.sql.exec('SELECT * FROM my_plans').toArray()).toEqual([]);
      expect(storage.sql.exec('SELECT * FROM my_plan_sessions').toArray()).toEqual([]);
      expect(
        storage.sql.exec("SELECT value_json FROM settings WHERE key='schema_version'").one()
          .value_json,
      ).toBe('12');
    });
  });
  it('creates, reads, updates and deletes entries with public authors and factor snapshots', async () => {
    const owner = await user('Owner');
    const created = await entry(owner, {
      modality: 'bike',
      distance_m: 60000,
      duration_s: 3600,
      avg_split_s: 120.1,
      stroke_rate: 20,
      avg_hr: 150,
    });
    expect(created).toMatchObject({
      title: 'Workout',
      week_start: '2026-03-09',
      equiv_m: 20000,
      mode_factor: 1 / 3,
      zone_factor: 1,
      duration_s: 3600,
      images: [],
      kudos_count: 0,
      has_kudos: false,
      comment_count: 0,
    });
    expect(JSON.stringify(created)).not.toMatch(/password|email|owner@example.com/);
    expect(await (await api('/entries/' + created.id, owner)).json()).toEqual(created);
    await sql((storage) => setSetting(storage, 'mode_factors', { erg: 2, bike: 0.5, run: 1.25 }));
    const edit = await (
      await api('/entries/' + created.id, owner, 'PATCH', { title: 'Changed', duration_s: null })
    ).json<EntryDetail>();
    expect(edit).toMatchObject({
      title: 'Changed',
      duration_s: null,
      equiv_m: 20000,
      mode_factor: 1 / 3,
    });
    const same = await (
      await api('/entries/' + created.id, owner, 'PATCH', { distance_m: 60000 })
    ).json<EntryDetail>();
    expect(same.equiv_m).toBe(20000);
    const changed = await (
      await api('/entries/' + created.id, owner, 'PATCH', { distance_m: 60001 })
    ).json<EntryDetail>();
    expect(changed).toMatchObject({ equiv_m: 30001, mode_factor: 0.5 });
    expect((await api('/entries/' + created.id, owner, 'DELETE')).status).toBe(204);
    expect((await api('/entries/' + created.id, owner)).status).toBe(404);
    expect((await api('/entries/' + created.id, owner, 'DELETE')).status).toBe(404);
  });
  it('reproduces every architecture math check through the API', async () => {
    const owner = await user('Owner');
    const cases: [EntryInput['modality'], EntryInput['zone'], number, number][] = [
      ['bike', 'E', 60000, 20000],
      ['erg', 'D', 20000, 27000],
      ['run', 'E', 6240, 7800],
      ['run', 'D', 6240, 10530],
      ['bike', 'R', 60000, 16000],
      ['erg', 'D', 12000, 16200],
    ];
    for (const [modality, zone, distance_m, equiv_m] of cases)
      expect((await entry(owner, { modality, zone, distance_m })).equiv_m).toBe(equiv_m);
  });
  it('validates required, optional, enum, date and bounded fields for create and patch', async () => {
    const owner = await user('Owner');
    const created = await entry(owner);
    const invalid = [
      { date: '2026-02-30' },
      { date: '2019-12-31' },
      { date: '2026-03-11' },
      { modality: 'swim' },
      { zone: 'Z' },
      { distance_m: 0 },
      { distance_m: 200001 },
      { distance_m: 1.5 },
      { distance_m: '10000' },
      { duration_s: 0 },
      { duration_s: 86401 },
      { avg_split_s: 59 },
      { avg_split_s: 601 },
      { stroke_rate: 61 },
      { avg_hr: 29 },
      { title: 'x'.repeat(121) },
      { notes: 'x'.repeat(2001) },
      { preset_id: 'missing' },
      { image_ids: 'bad' },
      { image_ids: ['same', 'same'] },
    ];
    for (const patch of invalid) {
      expect(
        (await api('/entries', owner, 'POST', { ...input, ...patch })).status,
        JSON.stringify(patch),
      ).toBe(400);
      expect(
        (await api('/entries/' + created.id, owner, 'PATCH', patch)).status,
        JSON.stringify(patch),
      ).toBe(400);
    }
    expect((await api('/entries', owner, 'POST', {})).status).toBe(400);
    expect((await api('/entries/' + created.id, owner, 'PATCH', {})).status).toBe(200);
    expect(
      (await entry(owner, { date: '2026-03-10', duration_s: null, preset_id: null })).date,
    ).toBe('2026-03-10');
    expect(
      (await api('/entries/' + created.id, owner, 'PATCH', { user_id: 'other', equiv_m: 1 }))
        .status,
    ).toBe(200);
    expect((await (await api('/entries/' + created.id, owner)).json<EntryDetail>()).user_id).toBe(
      owner.user.id,
    );
  });
  it.each(['POST', 'PATCH'])(
    'normalizes legacy visibility on %s and shares workouts with team members',
    async (method) => {
      const owner = await user('Owner');
      const other = await user('Other');
      const staff = await user('Staff', 'coach');
      const id = await image(owner);
      const created =
        method === 'POST'
          ? await entry(owner, { visibility: 'private', image_ids: [id] })
          : await (
              await api(
                '/entries/' + (await entry(owner, { image_ids: [id] })).id,
                owner,
                'PATCH',
                { visibility: 'private' },
              )
            ).json<EntryDetail>();
      expect(created.visibility).toBe('team');
      await sql((storage) =>
        expect(
          storage.sql
            .exec<{ visibility: string }>('SELECT visibility FROM entries WHERE id=?', created.id)
            .one().visibility,
        ).toBe('team'),
      );
      for (const viewer of [other, staff]) {
        for (const path of [
          '/entries/' + created.id,
          '/entries/' + created.id + '/comments',
          '/images/' + id,
        ])
          expect((await api(path, viewer)).status).toBe(200);
        for (const scope of ['feed', 'user:' + owner.user.id]) {
          const page = await (
            await api('/entries?scope=' + scope, viewer)
          ).json<Page<EntryDetail>>();
          expect(page.items.map((row) => row.id)).toContain(created.id);
        }
        const week = await (
          await api('/stats/week?user=' + owner.user.id, viewer)
        ).json<WeekStats>();
        expect(week.total_m).toBe(created.equiv_m);
        const profile = await (
          await api('/users/' + owner.user.id, viewer)
        ).json<{ stats: SeasonStats }>();
        expect(profile.stats.total_m).toBe(created.equiv_m);
        const leaders = await (await api('/leaderboard', viewer)).json<LeaderboardRow[]>();
        expect(leaders.find((row) => row.user.id === owner.user.id)?.total_m).toBe(created.equiv_m);
      }
      expect((await api('/entries/' + created.id + '/kudos', other, 'POST')).status).toBe(204);
      expect(
        (
          await api('/entries/' + created.id + '/comments', other, 'POST', {
            body: 'Great session',
          })
        ).status,
      ).toBe(201);
      expect((await api('/entries/' + created.id, other, 'PATCH', { title: 'No' })).status).toBe(
        403,
      );
      expect((await api('/entries/' + created.id, other, 'DELETE')).status).toBe(403);
      expect((await api('/images/' + id)).status).toBe(401);
      const inactive = await user('Inactive');
      await sql((storage) =>
        storage.sql.exec('UPDATE users SET active=0 WHERE id=?', inactive.user.id),
      );
      expect((await api('/images/' + id, inactive)).status).toBe(401);
      expect(
        (await api('/entries/' + created.id, staff, 'PATCH', { title: 'Staff edit' })).status,
      ).toBe(200);
      expect((await api('/entries/' + created.id, staff, 'DELETE')).status).toBe(204);
    },
  );
  it('migrates legacy entries to team visibility once without changing their content', async () => {
    const owner = await user('Owner');
    const created = await entry(owner);
    await entry(owner, { title: 'Already shared' });
    await sql((storage) => {
      const before = storage.sql.exec('SELECT * FROM entries ORDER BY id').toArray();
      storage.sql.exec("UPDATE entries SET visibility='private' WHERE id=?", created.id);
      setSetting(storage, 'schema_version', 5);
      migrate(storage);
      const rows = storage.sql.exec('SELECT * FROM entries ORDER BY id').toArray();
      expect(rows).toEqual(before);
      expect(
        storage.sql
          .exec<{ value_json: string }>(
            "SELECT value_json FROM settings WHERE key='schema_version'",
          )
          .one().value_json,
      ).toBe('12');
      migrate(storage);
      expect(storage.sql.exec('SELECT * FROM entries ORDER BY id').toArray()).toEqual(rows);
    });
  });
  it('paginates feed with a deterministic opaque cursor and filters mine/user scopes', async () => {
    const owner = await user('Owner');
    const other = await user('Other');
    expect(await (await api('/entries', owner)).json()).toEqual({ items: [], next_cursor: null });
    const ids: string[] = [];
    for (let i = 0; i < 23; i++) ids.push((await entry(owner, { title: 'Entry ' + i })).id);
    await entry(owner, { visibility: 'private' });
    await entry(other);
    const first = await (await api('/entries', owner)).json<Page<EntryDetail>>();
    expect(first.items).toHaveLength(20);
    expect(first.next_cursor).toBeTruthy();
    const second = await (
      await api('/entries?cursor=' + first.next_cursor, owner)
    ).json<Page<EntryDetail>>();
    expect(second.items).toHaveLength(5);
    expect(second.next_cursor).toBeNull();
    const all = [...first.items, ...second.items];
    expect(new Set(all.map((row) => row.id)).size).toBe(25);
    expect(all.every((row) => row.visibility === 'team')).toBe(true);
    expect(all.map((row) => row.id)).toEqual(
      all
        .map((row) => row.id)
        .sort()
        .reverse(),
    );
    expect(
      (await (await api('/entries?scope=mine', other)).json<Page<EntryDetail>>()).items,
    ).toHaveLength(1);
    for (const query of ['cursor=bad', 'cursor=', 'scope=bad'])
      expect((await api('/entries?' + query, owner)).status).toBe(400);
    expect(ids).toHaveLength(23);
  });
  it('uploads PNG/JPEG/WebP headers, serves immutable private caching, supports ETag 304', async () => {
    const owner = await user('Owner');
    const id = await image(owner);
    const response = await api('/images/' + id, owner);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png());
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=31536000, immutable');
    expect(response.headers.get('Content-Disposition')).toBe('inline');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const cached = await SELF.fetch('https://oyo.test/api/images/' + id, {
      headers: { Cookie: owner.cookie, 'X-OYO-Test-Now': NOW, 'If-None-Match': `"${id}"` },
    });
    expect(cached.status).toBe(304);
    expect(await cached.text()).toBe('');
    const jpeg = new Uint8Array([255, 216, 255, 192, 0, 11, 8, 0, 3, 0, 2, 1, 1, 17, 0]);
    expect((await upload(owner, jpeg, 'image/jpeg')).status).toBe(201);
    for (const kind of ['VP8X', 'VP8L', 'VP8 ']) {
      const bytes = new Uint8Array(30);
      bytes.set(new TextEncoder().encode('RIFF'));
      bytes.set(new TextEncoder().encode('WEBP' + kind), 8);
      new DataView(bytes.buffer).setUint32(16, 10, true);
      if (kind === 'VP8X') {
        bytes[24] = 1;
        bytes[27] = 2;
      }
      if (kind === 'VP8L') {
        bytes[20] = 47;
        new DataView(bytes.buffer).setUint32(21, 1 + (2 << 14), true);
      }
      if (kind === 'VP8 ') bytes.set([157, 1, 42, 2, 0, 3, 0], 23);
      const uploaded = await upload(owner, bytes, 'image/webp');
      expect(uploaded.status).toBe(201);
      const webpId = (await uploaded.json<{ id: string }>()).id;
      await sql((storage) =>
        expect(
          storage.sql.exec('SELECT width,height FROM images WHERE id = ?', webpId).one(),
        ).toMatchObject({ width: 2, height: 3 }),
      );
    }
  });
  it('rejects unsupported/mismatched magic, empty/corrupt/oversized images and unauthenticated access', async () => {
    const owner = await user('Owner');
    expect((await upload(owner, png(), 'image/jpeg')).status).toBe(415);
    expect((await upload(owner, png(), 'image/gif')).status).toBe(415);
    expect((await upload(owner, new Uint8Array([1, 2, 3]))).status).toBe(415);
    expect((await upload(owner, new Uint8Array())).status).toBe(400);
    expect((await upload(owner, png().slice(0, 8))).status).toBe(400);
    expect((await upload(owner, png(0, 0))).status).toBe(400);
    expect((await upload(owner, new Uint8Array(1572865))).status).toBe(413);
    expect((await upload(owner, png(), 'image/png', { 'Content-Length': '1572865' })).status).toBe(
      413,
    );
    expect((await api('/images/missing', owner)).status).toBe(404);
    expect((await api('/images/missing')).status).toBe(401);
  });
  it('checks attachment ownership/max four, conflicts, replacement, staff acting for owner, and cascades', async () => {
    const owner = await user('Owner');
    const other = await user('Other');
    const staff = await user('Staff', 'coxswain');
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push(await image(owner));
    const otherId = await image(other);
    const staffId = await image(staff);
    expect((await api('/entries', owner, 'POST', { ...input, image_ids: ids })).status).toBe(400);
    expect((await api('/entries', owner, 'POST', { ...input, image_ids: [otherId] })).status).toBe(
      400,
    );
    const created = await entry(owner, { image_ids: ids.slice(0, 4) });
    expect(created.images.map((row) => row.id)).toEqual(ids.slice(0, 4));
    expect((await api('/entries', owner, 'POST', { ...input, image_ids: [ids[0]] })).status).toBe(
      409,
    );
    expect(
      (await api('/entries/' + created.id, staff, 'PATCH', { image_ids: [staffId] })).status,
    ).toBe(400);
    expect(
      (await api('/entries/' + created.id, staff, 'PATCH', { image_ids: [ids[4]] })).status,
    ).toBe(200);
    for (const id of ids.slice(0, 4)) expect((await api('/images/' + id, owner)).status).toBe(404);
    expect((await api('/entries', owner, 'POST', { ...input, image_ids: [ids[0]] })).status).toBe(
      400,
    );
    expect((await entry(owner, { image_ids: [await image(owner)] })).images).toHaveLength(1);
    await api('/me', owner, 'PATCH', { avatar_image_id: ids[4] });
    await api('/entries/' + created.id, owner, 'DELETE');
    expect((await api('/images/' + ids[4], owner)).status).toBe(200);
    const doomedId = await image(owner);
    const doomed = await entry(owner, { image_ids: [doomedId] });
    await api('/entries/' + doomed.id + '/kudos', other, 'POST');
    await api('/entries/' + doomed.id + '/comments', other, 'POST', { body: 'Good' });
    await api('/entries/' + doomed.id, owner, 'DELETE');
    expect((await api('/images/' + doomedId, owner)).status).toBe(404);
    await sql((storage) => {
      for (const table of ['entry_images', 'kudos', 'comments', 'notifications'])
        expect(
          storage.sql.exec(`SELECT * FROM ${table} WHERE entry_id = ?`, doomed.id).toArray(),
        ).toHaveLength(0);
    });
    expect((await api('/entries/' + created.id, owner, 'PATCH', { image_ids: [] })).status).toBe(
      404,
    );
  });
});
describe('social and notifications', () => {
  it('lists public kudos users with one query, newest first then user id, subject to entry visibility', async () => {
    const owner = await user('Owner');
    const first = await user('First');
    const second = await user('Second');
    const staff = await user('Staff', 'coach');
    const created = await entry(owner);
    const path = '/entries/' + created.id + '/kudos';
    expect(await (await api(path, first)).json()).toEqual([]);
    for (const client of [owner, first]) expect((await api(path, client, 'POST')).status).toBe(204);
    expect((await api(path, second, 'POST', undefined, '2026-03-09T18:01:00Z')).status).toBe(204);
    const expected = [second.user.id, ...[owner.user.id, first.user.id].sort()];
    const response = await api(path, first);
    expect(response.status).toBe(200);
    const listed = await response.json<{ id: string }[]>();
    expect(listed.map((row) => row.id)).toEqual(expected);
    for (const row of listed)
      for (const field of ['email', 'password_hash', 'password_salt', 'must_change_password'])
        expect(row).not.toHaveProperty(field);
    await sql((storage) => {
      let queries = 0;
      const traced = new Proxy(storage, {
        get(target, key) {
          if (key === 'sql')
            return {
              exec: (...args: Parameters<typeof storage.sql.exec>) => {
                queries++;
                return target.sql.exec(...args);
              },
            };
          return Reflect.get(target, key, target);
        },
      });
      expect(kudosUsers(traced, created.id, owner.user.id).map((row) => row.id)).toEqual(expected);
      expect(queries).toBe(1);
    });
    const secret = await entry(owner, { visibility: 'private' });
    const privatePath = '/entries/' + secret.id + '/kudos';
    for (const viewer of [first, staff]) expect((await api(privatePath, viewer)).status).toBe(200);
    expect(await (await api(privatePath, owner)).json()).toEqual([]);
    expect((await api(privatePath, owner, 'POST')).status).toBe(204);
    expect(await (await api(privatePath, owner)).json()).toMatchObject([{ id: owner.user.id }]);
    expect((await api(path)).status).toBe(401);
    expect((await api('/entries/missing/kudos', owner)).status).toBe(404);
  });
  it('makes kudos idempotent, skips self notifications, returns public authors, marks only mine read', async () => {
    const owner = await user('Owner');
    const other = await user('Other');
    const created = await entry(owner);
    expect(await (await api('/entries/' + created.id + '/comments', owner)).json()).toEqual([]);
    expect(await (await api('/notifications', owner)).json()).toEqual([]);
    await api('/entries/' + created.id + '/kudos', owner, 'POST');
    await api('/entries/' + created.id + '/comments', owner, 'POST', { body: 'Self' });
    expect(await (await api('/notifications', owner)).json()).toEqual([]);
    for (let i = 0; i < 2; i++)
      expect((await api('/entries/' + created.id + '/kudos', other, 'POST')).status).toBe(204);
    const comment = await api(
      '/entries/' + created.id + '/comments',
      other,
      'POST',
      { body: ' Nice work! ' },
      '2026-03-09T18:01:00Z',
    );
    expect(comment.status).toBe(201);
    expect(await comment.json()).toMatchObject({ body: 'Nice work!', author: { name: 'Other' } });
    const enriched = await (await api('/entries/' + created.id, other)).json<EntryDetail>();
    expect(enriched).toMatchObject({ kudos_count: 2, has_kudos: true, comment_count: 2 });
    const notices = await (await api('/notifications', owner)).json<Notification[]>();
    expect(notices).toHaveLength(2);
    expect(notices[0]).toMatchObject({
      kind: 'comment',
      entry_title: 'Workout',
      actor: { name: 'Other' },
    });
    expect(JSON.stringify(notices)).not.toMatch(/password|email|other@example.com/);
    await api('/notifications/read', other, 'POST', { ids: notices.map((row) => row.id) });
    expect(
      (await (await api('/notifications', owner)).json<Notification[]>()).every(
        (row) => row.read_at === null,
      ),
    ).toBe(true);
    await api('/entries/' + created.id + '/kudos', other, 'DELETE');
    expect(await (await api('/notifications', owner)).json<Notification[]>()).toHaveLength(1);
    await api('/notifications/read', owner, 'POST', { ids: [] });
    expect(
      (await (await api('/notifications', owner)).json<Notification[]>()).every(
        (row) => row.read_at !== null,
      ),
    ).toBe(true);
    expect((await api('/notifications/read', owner, 'POST', { ids: 'bad' })).status).toBe(400);
    expect(
      (await api('/notifications/read', owner, 'POST', { ids: Array(201).fill('x') })).status,
    ).toBe(400);
  });
  it('orders comments oldest first, validates body and enforces author/staff deletion', async () => {
    const owner = await user('Owner');
    const other = await user('Other');
    const staff = await user('Staff', 'admin');
    const created = await entry(owner);
    for (const body of ['', ' ', 'x'.repeat(1001), 12])
      expect(
        (await api('/entries/' + created.id + '/comments', other, 'POST', { body })).status,
      ).toBe(400);
    const first = await (
      await api('/entries/' + created.id + '/comments', other, 'POST', { body: 'First' })
    ).json<{ id: string }>();
    const second = await (
      await api(
        '/entries/' + created.id + '/comments',
        owner,
        'POST',
        { body: 'Second' },
        '2026-03-09T18:02:00Z',
      )
    ).json<{ id: string }>();
    expect(
      (
        await (await api('/entries/' + created.id + '/comments', owner)).json<{ body: string }[]>()
      ).map((row) => row.body),
    ).toEqual(['First', 'Second']);
    expect((await api('/comments/' + first.id, owner, 'DELETE')).status).toBe(403);
    expect((await api('/comments/' + first.id, staff, 'DELETE')).status).toBe(204);
    expect((await api('/comments/' + second.id, owner, 'DELETE')).status).toBe(204);
    expect((await api('/comments/' + second.id, owner, 'DELETE')).status).toBe(404);
  });
});
describe('image references and privacy', () => {
  it('allows only the owner to read unattached uploads and legacy detached images', async () => {
    const owner = await user('Owner');
    const other = await user('Other');
    const staff = await user('Staff', 'coach');
    const id = await image(owner);
    expect((await api('/images/' + id, owner)).status).toBe(200);
    for (const viewer of [other, staff])
      expect((await api('/images/' + id, viewer)).status).toBe(404);
    const secret = await entry(owner, { visibility: 'private', image_ids: [id] });
    await sql((storage) =>
      storage.sql.exec('DELETE FROM entry_images WHERE entry_id=?', secret.id),
    );
    expect((await api('/images/' + id, owner)).status).toBe(200);
    for (const viewer of [other, staff]) {
      expect((await api('/images/' + id, viewer)).status).toBe(404);
      const cached = await SELF.fetch('https://oyo.test/api/images/' + id, {
        headers: { Cookie: viewer.cookie, 'X-OYO-Test-Now': NOW, 'If-None-Match': '"' + id + '"' },
      });
      expect(cached.status).toBe(404);
    }
  });
  it('collects detached images, preserves retained attachments and leaves other fresh uploads alone', async () => {
    const owner = await user('Owner');
    const other = await user('Other');
    const detached = await image(owner);
    const retained = await image(owner);
    const fresh = await image(owner);
    const secret = await entry(owner, { visibility: 'private', image_ids: [detached, retained] });
    expect(
      (await api('/entries/' + secret.id, owner, 'PATCH', { image_ids: [retained] })).status,
    ).toBe(200);
    for (const viewer of [owner, other])
      expect((await api('/images/' + detached, viewer)).status).toBe(404);
    expect((await api('/images/' + retained, owner)).status).toBe(200);
    expect((await api('/images/' + retained, other)).status).toBe(200);
    expect((await api('/images/' + fresh, owner)).status).toBe(200);
    expect((await api('/entries/' + secret.id, owner, 'PATCH', { image_ids: [] })).status).toBe(
      200,
    );
    expect((await api('/images/' + retained, owner)).status).toBe(404);
    expect((await api('/images/' + fresh, owner)).status).toBe(200);
    expect((await api('/images/' + fresh, other)).status).toBe(404);
  });
  it('makes current avatars visible on entries, and collects old avatars only after their last reference', async () => {
    const owner = await user('Owner');
    const other = await user('Other');
    const staff = await user('Staff', 'coxswain');
    const oldAvatar = await image(owner);
    const nextAvatar = await image(owner);
    const secret = await entry(owner, { visibility: 'private', image_ids: [oldAvatar] });
    expect((await api('/me', owner, 'PATCH', { avatar_image_id: oldAvatar })).status).toBe(200);
    for (const viewer of [other, staff])
      expect((await api('/images/' + oldAvatar, viewer)).status).toBe(200);
    expect((await api('/me', owner, 'PATCH', { avatar_image_id: nextAvatar })).status).toBe(200);
    expect((await api('/images/' + oldAvatar, owner)).status).toBe(200);
    expect((await api('/images/' + oldAvatar, other)).status).toBe(200);
    expect((await api('/images/' + nextAvatar, other)).status).toBe(200);
    expect((await api('/me', owner, 'PATCH', { avatar_image_id: nextAvatar })).status).toBe(200);
    expect((await api('/images/' + nextAvatar, owner)).status).toBe(200);
    expect((await api('/me', owner, 'PATCH', { avatar_image_id: null })).status).toBe(200);
    expect((await api('/images/' + nextAvatar, owner)).status).toBe(404);
    expect((await api('/entries/' + secret.id, owner, 'PATCH', { image_ids: [] })).status).toBe(
      200,
    );
    expect((await api('/images/' + oldAvatar, owner)).status).toBe(404);
    const unreferenced = await image(owner);
    const replacement = await image(owner);
    expect((await api('/me', owner, 'PATCH', { avatar_image_id: unreferenced })).status).toBe(200);
    expect((await api('/me', owner, 'PATCH', { avatar_image_id: replacement })).status).toBe(200);
    expect((await api('/images/' + unreferenced, owner)).status).toBe(404);
    const avatarEntry = await entry(owner, { visibility: 'private', image_ids: [replacement] });
    expect((await api('/entries/' + avatarEntry.id, owner, 'DELETE')).status).toBe(204);
    expect((await api('/images/' + replacement, other)).status).toBe(200);
    expect((await api('/me', owner, 'PATCH', { avatar_image_id: null })).status).toBe(200);
    expect((await api('/images/' + replacement, owner)).status).toBe(404);
  });
  it('permits any visible entry reference and preserves images until all entry references disappear', async () => {
    const owner = await user('Owner');
    const other = await user('Other');
    const id = await image(owner);
    const secret = await entry(owner, { visibility: 'private', image_ids: [id] });
    const visible = await entry(owner);
    await sql((storage) =>
      storage.sql.exec('INSERT INTO entry_images VALUES (?,?,?)', visible.id, id, 0),
    );
    expect((await api('/images/' + id, other)).status).toBe(200);
    expect((await api('/entries/' + secret.id, owner, 'DELETE')).status).toBe(204);
    expect((await api('/images/' + id, owner)).status).toBe(200);
    expect((await api('/images/' + id, other)).status).toBe(200);
    expect((await api('/entries/' + visible.id, owner, 'DELETE')).status).toBe(204);
    expect((await api('/images/' + id, owner)).status).toBe(404);
    const publicId = await image(owner);
    const publicEntry = await entry(owner, { image_ids: [publicId] });
    expect((await api('/images/' + publicId, other)).status).toBe(200);
    expect(
      (await api('/entries/' + publicEntry.id, owner, 'PATCH', { visibility: 'private' })).status,
    ).toBe(200);
    expect((await api('/images/' + publicId, other)).status).toBe(200);
  });
});
describe('team statistics and positive daily aggregates', () => {
  it.each(['season=2025', 'year=2026'])(
    'filters every breakdown and aggregates ascending positive PT dates for %s',
    async (variant) => {
      const owner = await user('Owner');
      const other = await user('Other');
      const staff = await user('Staff', 'coach');
      await target(owner, 10000, '2025-09-01T18:00:00Z');
      await entry(owner, {
        date: '2026-03-09',
        distance_m: 60000,
        modality: 'bike',
        zone: 'E',
        visibility: 'private',
      });
      await entry(owner, { date: '2026-03-09', distance_m: 4000 });
      await entry(owner, {
        date: '2026-03-02',
        distance_m: 20000,
        zone: 'D',
        visibility: 'private',
      });
      await entry(owner, { date: '2026-02-23', distance_m: 12000 });
      await entry(owner, { date: '2025-12-31', distance_m: 3000 });
      await entry(owner, { date: '2026-03-09', distance_m: 2000 });
      const zero = await entry(owner, {
        date: '2026-03-05',
        distance_m: 1,
        modality: 'bike',
        zone: 'E',
      });
      expect(zero.equiv_m).toBe(0);
      const prefix = variant.startsWith('season') ? [{ date: '2025-12-31', equiv_m: 3000 }] : [];
      const ownDays = [
        ...prefix,
        { date: '2026-02-23', equiv_m: 12000 },
        { date: '2026-03-02', equiv_m: 27000 },
        { date: '2026-03-09', equiv_m: 26000 },
      ];
      const extra = prefix.length ? 3000 : 0;
      const own = await (await api('/stats/season?' + variant, owner)).json<SeasonStats>();
      expect(own).toMatchObject({
        total_m: 65000 + extra,
        streak: 3,
        best_week: { week_start: '2026-03-02', total_m: 27000 },
        by_modality: { erg: 45000 + extra, bike: 20000, run: 0 },
        by_zone: { E: 38000 + extra, D: 27000 },
      });
      expect(own.days).toEqual(ownDays);
      expect(own.weeks.at(-1)).toMatchObject({ total_m: 26000, hit_target: true, percent: 260 });
      const ownWeek = await (await api('/stats/week', owner)).json<WeekStats>();
      expect(ownWeek).toMatchObject({
        total_m: 26000,
        percent: 260,
        hit_target: true,
        by_modality: { erg: 6000, bike: 20000, run: 0 },
      });
      expect(ownWeek.entries).toHaveLength(3);
      expect(ownWeek.by_day.map((day) => day.equiv_m)).toEqual([26000, 0, 0, 0, 0, 0, 0]);
      for (const viewer of [other, staff]) {
        const stats = await (
          await api('/stats/season?' + variant + '&user=' + owner.user.id, viewer)
        ).json<SeasonStats>();
        expect(stats).toEqual(own);
        const week = await (
          await api('/stats/week?user=' + owner.user.id, viewer)
        ).json<WeekStats>();
        expect(week.total_m).toBe(ownWeek.total_m);
        expect(week.by_day).toEqual(ownWeek.by_day);
        expect(week.entries.map((row) => row.id)).toEqual(ownWeek.entries.map((row) => row.id));
        const profile = await (
          await api('/users/' + owner.user.id, viewer)
        ).json<{ stats: SeasonStats }>();
        expect(profile.stats.total_m).toBe(68000);
        expect(profile.stats.days.reduce((sum, day) => sum + day.equiv_m, 0)).toBe(68000);
      }
      const profile = await (
        await api('/users/' + owner.user.id, owner)
      ).json<{ stats: SeasonStats }>();
      expect(profile.stats.total_m).toBe(68000);
      expect(profile.stats.days).toEqual([
        { date: '2025-12-31', equiv_m: 3000 },
        { date: '2026-02-23', equiv_m: 12000 },
        { date: '2026-03-02', equiv_m: 27000 },
        { date: '2026-03-09', equiv_m: 26000 },
      ]);
      const leaders = await (
        await api('/leaderboard?metric=meters', other)
      ).json<LeaderboardRow[]>();
      expect(leaders.find((row) => row.user.id === owner.user.id)).toMatchObject({
        total_m: 26000,
        entry_count: 3,
        streak: 3,
      });
    },
  );
  it('shares daily rows with the team and omits zero-only dates, empty and future ranges', async () => {
    const owner = await user('Owner');
    const other = await user('Other');
    await entry(owner, { date: '2026-03-09', visibility: 'private' });
    await entry(owner, { date: '2026-03-08', distance_m: 1, modality: 'bike', zone: 'E' });
    const own = await (await api('/stats/season', owner)).json<SeasonStats>();
    expect(own.days).toEqual([{ date: '2026-03-09', equiv_m: 10000 }]);
    for (const path of [
      '/stats/season?user=' + owner.user.id,
      '/stats/season?year=2026&user=' + owner.user.id,
    ]) {
      const hidden = await (await api(path, other)).json<SeasonStats>();
      expect(hidden.total_m).toBe(own.total_m);
      expect(hidden.days).toEqual(own.days);
    }
    expect((await (await api('/stats/season', other)).json<SeasonStats>()).days).toEqual([]);
    expect((await (await api('/stats/season?year=2027', owner)).json<SeasonStats>()).days).toEqual(
      [],
    );
  });
});
describe('statistics, leaderboard and team', () => {
  it('zero fills week totals/by_day, normalizes weeks, and includes every workout for other viewers', async () => {
    const owner = await user('Owner');
    const other = await user('Other');
    const empty = await (await api('/stats/week', owner)).json<WeekStats>();
    expect(empty).toMatchObject({
      week_start: '2026-03-09',
      total_m: 0,
      percent: 0,
      hit_target: false,
      entries: [],
      by_modality: { erg: 0, bike: 0, run: 0 },
    });
    expect(empty.by_day).toHaveLength(7);
    expect(Object.values(empty.by_zone)).toEqual(Array(10).fill(0));
    await entry(owner, { distance_m: 10000 });
    await entry(owner, {
      date: '2026-03-10',
      distance_m: 20000,
      visibility: 'private',
      modality: 'bike',
      zone: 'D',
    });
    const stats = await (
      await api('/stats/week?week=2026-03-11&user=' + owner.user.id, other)
    ).json<WeekStats>();
    expect(stats).toMatchObject({
      total_m: 19000,
      percent: 23.8,
      hit_target: false,
      by_modality: { erg: 10000, bike: 9000, run: 0 },
    });
    expect(stats.by_day.map((row) => row.equiv_m)).toEqual([10000, 9000, 0, 0, 0, 0, 0]);
    expect(stats.entries).toHaveLength(2);
    const own = await (await api('/stats/week?week=2026-03-11', owner)).json<WeekStats>();
    expect(own.total_m).toBe(19000);
    expect(own.by_day.map((row) => row.equiv_m)).toEqual([10000, 9000, 0, 0, 0, 0, 0]);
    for (const path of [
      '/stats/week?week=bad',
      '/stats/season?year=bad',
      '/stats/season?year=2026&season=2025',
      '/leaderboard?metric=bad',
    ])
      expect((await api(path, owner)).status).toBe(400);
    expect((await api('/stats/week?user=missing', owner)).status).toBe(404);
  });
  it('computes season/year totals, streaks, best week, current-week-in-progress rule and future empty ranges', async () => {
    const owner = await user('Owner');
    await target(owner, 10000, '2026-02-23T18:00:00Z');
    await entry(owner, { date: '2026-02-23', distance_m: 12000 });
    await entry(owner, { date: '2026-03-02', distance_m: 15000 });
    await entry(owner, { distance_m: 1000 });
    const stats = await (await api('/stats/season?season=2025', owner)).json<SeasonStats>();
    expect(stats).toMatchObject({
      start: '2025-09-01',
      end: '2026-08-31',
      total_m: 28000,
      streak: 2,
      best_week: { week_start: '2026-03-02', total_m: 15000 },
    });
    expect(stats.weeks.at(-1)).toMatchObject({
      week_start: '2026-03-09',
      hit_target: false,
      target_m: 10000,
    });
    await entry(owner, { distance_m: 9000 });
    expect((await (await api('/stats/season', owner)).json<SeasonStats>()).streak).toBe(3);
    const year = await (await api('/stats/season?year=2026', owner)).json<SeasonStats>();
    expect(year).toMatchObject({
      start: '2026-01-01',
      end: '2026-12-31',
      total_m: 37000,
      streak: 3,
    });
    const future = await (await api('/stats/season?year=2027', owner)).json<SeasonStats>();
    expect(future).toMatchObject({ total_m: 0, weeks: [], days: [], streak: 0, best_week: null });
    const empty = await user('Empty');
    expect((await (await api('/stats/season', empty)).json<SeasonStats>()).best_week).toBeNull();
  });
  it('keeps season date-range totals separate from boundary-week summaries', async () => {
    const owner = await user('Owner');
    await entry(owner, { date: '2025-08-31', distance_m: 3000 });
    await entry(owner, { date: '2025-09-01', distance_m: 7000 });
    const old = await (await api('/stats/season?season=2024', owner)).json<SeasonStats>();
    expect(old.total_m).toBe(3000);
    const current = await (await api('/stats/season?season=2025', owner)).json<SeasonStats>();
    expect(current.total_m).toBe(7000);
  });
  it('sorts all leaderboard metrics, competition ranks ties, excludes inactive/hidden and keeps all workout totals', async () => {
    const alice = await user('Alice');
    const bob = await user('Bob');
    const carol = await user('Carol');
    const hidden = await user('Hidden', 'coach');
    const inactive = await user('Inactive');
    await target(alice, 10000);
    await target(bob, 10000);
    await target(carol, 40000);
    await entry(alice, { distance_m: 10000 });
    await entry(bob, { distance_m: 10000, visibility: 'private' });
    await entry(carol, { distance_m: 20000 });
    await entry(alice, { date: '2026-03-02', distance_m: 50000 });
    await entry(bob, { date: '2026-03-02', distance_m: 50000 });
    await entry(hidden, { distance_m: 100000 });
    await entry(inactive, { distance_m: 100000 });
    await sql((storage) =>
      storage.sql.exec('UPDATE users SET active = ? WHERE id = ?', 0, inactive.user.id).toArray(),
    );
    for (const [metric, names, ranks] of [
      ['percent', ['Alice', 'Bob', 'Carol'], [1, 1, 3]],
      ['meters', ['Carol', 'Alice', 'Bob'], [1, 2, 2]],
      ['season', ['Alice', 'Bob', 'Carol'], [1, 1, 3]],
    ] as const) {
      const rows = await (
        await api('/leaderboard?metric=' + metric, alice)
      ).json<LeaderboardRow[]>();
      expect(rows.map((row) => row.user.name)).toEqual(names);
      expect(rows.map((row) => row.rank)).toEqual(ranks);
      expect(JSON.stringify(rows)).not.toMatch(/password|email|example.com/);
      expect(rows.find((row) => row.user.id === bob.user.id)?.entry_count).toBe(1);
      if (metric === 'season') {
        expect(rows[0].total_m).toBe(60000);
        expect(rows[0].target_m).toBeGreaterThan(10000);
      }
    }
  });
  it('returns sorted active public team users and season profiles without secrets', async () => {
    const zed = await user('Zed');
    const amy = await user('Amy');
    const inactive = await user('Inactive');
    await entry(amy, { visibility: 'private' });
    await sql((storage) =>
      storage.sql.exec('UPDATE users SET active = ? WHERE id = ?', 0, inactive.user.id).toArray(),
    );
    const response = await api('/users', zed);
    const text = await response.text();
    expect(text).not.toMatch(/password|email|example.com/);
    expect((JSON.parse(text) as PublicUser[]).map((row) => row.name)).toEqual(['Amy', 'Zed']);
    const profile = await (
      await api('/users/' + amy.user.id, zed)
    ).json<{ user: PublicUser; stats: SeasonStats }>();
    expect(profile).toMatchObject({
      user: { name: 'Amy' },
      stats: {
        total_m: 10000,
        days: [{ date: '2026-03-09', equiv_m: 10000 }],
        streak: 0,
        best_week: { total_m: 10000 },
      },
    });
    expect(JSON.stringify(profile)).not.toMatch(/password|email|example.com/);
    expect((await api('/users/' + inactive.user.id, zed)).status).toBe(404);
    expect((await api('/users/missing', zed)).status).toBe(404);
    for (const path of [
      '/entries',
      '/notifications',
      '/stats/week',
      '/stats/season',
      '/leaderboard',
      '/users',
      '/users/' + amy.user.id,
    ])
      expect((await api(path)).status).toBe(401);
  });
});

describe('teammate tags and mentions', () => {
  it('deduplicates tags, replaces only supplied sets and notifies only new recipients once', async () => {
    const owner = await user('Owner');
    const ann = await user('Ann');
    const bob = await user('Bob');
    const staff = await user('Staff', 'coach');
    const logged = await entry(owner, {
      tagged_user_ids: [owner.user.id, ann.user.id, ann.user.id],
    });
    expect(logged.tagged.map((u) => u.id)).toEqual([ann.user.id]);
    const path = '/entries/' + logged.id;
    expect(
      (await (await api(path, owner, 'PATCH', { title: 'Changed' })).json<EntryDetail>()).tagged,
    ).toHaveLength(1);
    const replaced = await (
      await api(path, staff, 'PATCH', {
        tagged_user_ids: [owner.user.id, ann.user.id, bob.user.id],
      })
    ).json<EntryDetail>();
    expect(replaced.tagged.map((u) => u.name)).toEqual(['Ann', 'Bob']);
    await api(path, owner, 'PATCH', { tagged_user_ids: [] });
    await api(path, owner, 'PATCH', { tagged_user_ids: [ann.user.id] });
    const notes = await (await api('/notifications', ann)).json<Notification[]>();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ kind: 'tag', actor_id: owner.user.id, entry_id: logged.id });
    const bobNotes = await (await api('/notifications', bob)).json<Notification[]>();
    expect(bobNotes).toHaveLength(1);
    expect(bobNotes[0]).toMatchObject({ kind: 'tag', actor_id: staff.user.id });
    expect((await (await api('/stats/week', ann)).json<WeekStats>()).total_m).toBe(0);
    expect((await (await api('/stats/season', ann)).json<SeasonStats>()).total_m).toBe(0);
    const board = await (await api('/leaderboard', owner)).json<LeaderboardRow[]>();
    expect(board.find((r) => r.user.id === ann.user.id)?.total_m).toBe(0);
    await sql((storage) =>
      storage.sql.exec('UPDATE users SET active=0 WHERE id=?', ann.user.id).toArray(),
    );
    expect((await (await api(path, owner)).json<EntryDetail>()).tagged).toEqual([]);
  });
  it('rejects malformed, unknown, inactive and over-cap recipients before filtering bodies', async () => {
    const owner = await user('Owner');
    const inactive = await user('Inactive');
    const ids: string[] = [];
    for (let i = 0; i < 11; i++) ids.push((await user('Mate' + i)).user.id);
    await sql((storage) =>
      storage.sql.exec('UPDATE users SET active=0 WHERE id=?', inactive.user.id).toArray(),
    );
    const logged = await entry(owner);
    for (const value of [null, 'bad', [1], ['missing'], [inactive.user.id], ids]) {
      for (const [path, method, body] of [
        ['/entries', 'POST', { ...input, tagged_user_ids: value }],
        ['/entries/' + logged.id, 'PATCH', { tagged_user_ids: value }],
        [
          '/entries/' + logged.id + '/comments',
          'POST',
          { body: 'No names here', mention_ids: value },
        ],
      ] as const) {
        const response = await api(path, owner, method, body);
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      }
    }
    expect((await (await api('/entries', owner)).json<Page<EntryDetail>>()).items).toHaveLength(1);
  });
  it('filters full names with boundaries, deduplicates and gives a mentioned owner only mention', async () => {
    const owner = await user('Ann');
    const anna = await user('Anna');
    const full = await user('Full Name');
    const author = await user('Writer');
    const logged = await entry(owner);
    const path = '/entries/' + logged.id + '/comments';
    const post = async (body: string, mention_ids?: string[]) => {
      const response = await api(path, author, 'POST', {
        body,
        ...(mention_ids === undefined ? {} : { mention_ids }),
      });
      expect(response.status).toBe(201);
      return response.json<CommentWithAuthor>();
    };
    expect(
      (await post('@Anna', [owner.user.id, anna.user.id])).mentions.map((u) => u.name),
    ).toEqual(['Anna']);
    const comment = await post('@aNN! @full name, @Writer', [
      owner.user.id,
      owner.user.id,
      full.user.id,
      author.user.id,
    ]);
    expect(comment.mentions.map((u) => u.name).sort()).toEqual(['Ann', 'Full Name']);
    expect((await post('No names', [anna.user.id])).mentions).toEqual([]);
    expect((await post('Legacy comment')).mentions).toEqual([]);
    const list = await (await api(path, author)).json<CommentWithAuthor[]>();
    expect(list.find((c) => c.id === comment.id)?.mentions).toEqual(comment.mentions);
    const notes = await (await api('/notifications', owner)).json<Notification[]>();
    expect(notes.filter((n) => n.kind === 'mention')).toHaveLength(1);
    expect(notes.filter((n) => n.kind === 'comment')).toHaveLength(3);
    expect((await (await api('/notifications', full)).json<Notification[]>())[0].kind).toBe(
      'mention',
    );
    expect(await (await api('/notifications', author)).json()).toEqual([]);
  });
  it('cleans join tables for author/staff comment deletion and owner/staff entry deletion', async () => {
    const owner = await user('Owner');
    const author = await user('Author');
    const staff = await user('Staff', 'coach');
    for (const deleter of [author, staff]) {
      const logged = await entry(owner, { tagged_user_ids: [author.user.id] });
      const comment = await (
        await api('/entries/' + logged.id + '/comments', author, 'POST', {
          body: '@Owner',
          mention_ids: [owner.user.id],
        })
      ).json<CommentWithAuthor>();
      expect((await api('/comments/' + comment.id, deleter, 'DELETE')).status).toBe(204);
      await sql((storage) =>
        expect(
          storage.sql
            .exec('SELECT * FROM comment_mentions WHERE comment_id=?', comment.id)
            .toArray(),
        ).toEqual([]),
      );
    }
    for (const deleter of [owner, staff]) {
      const logged = await entry(owner, { tagged_user_ids: [author.user.id] });
      await api('/entries/' + logged.id + '/comments', author, 'POST', {
        body: '@Owner',
        mention_ids: [owner.user.id],
      });
      expect((await api('/entries/' + logged.id, deleter, 'DELETE')).status).toBe(204);
      await sql((storage) => {
        for (const table of ['entry_tags', 'comment_mentions'])
          expect(
            storage.sql.exec(`SELECT * FROM ${table} WHERE entry_id=?`, logged.id).toArray(),
          ).toEqual([]);
      });
    }
  });
});
