/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { EntryDetail, Page, User, WeekStats } from '../../shared/types';
import { IDEMPOTENCY_HEADER } from '../../shared/headers';
import type { Env } from './index';
import { migrate } from './db/migrate';
import { getSetting, setSetting } from './db/settings';
import { insertImage } from './db/images';
import { insertRosterFixture } from './testFixtures';

const bindings = env as unknown as Env;
const NOW = '2026-03-09T18:00:00.000Z';
const body = {
  date: '2026-03-09',
  modality: 'erg',
  zone: 'E',
  distance_m: 10000,
  title: 'Training',
  notes: '',
  visibility: 'team',
};
type Client = { cookie: string; user: User };
function sql<T>(fn: (storage: DurableObjectStorage) => T): Promise<T> {
  return runInDurableObject(
    bindings.TEAM.get(bindings.TEAM.idFromName('stanford')),
    (_instance, state) => fn(state.storage),
  );
}
function api(path: string, client?: Client, method = 'GET', data?: unknown, key?: string) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method,
    headers: {
      'X-OYO-CSRF': '1',
      'Content-Type': 'application/json',
      'X-OYO-Test-Now': NOW,
      ...(client ? { Cookie: client.cookie } : {}),
      ...(key === undefined ? {} : { [IDEMPOTENCY_HEADER]: key }),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}
async function signup(name: string): Promise<Client> {
  const roster = await sql((s) => insertRosterFixture(s, name));
  const response = await api('/auth/signup', undefined, 'POST', {
    roster_id: roster,
    team_code: 'team-code',
    email: name + '@example.com',
    password: 'password123',
  });
  expect(response.status).toBe(201);
  return {
    cookie: response.headers.get('Set-Cookie')!.split(';')[0],
    user: await response.json<User>(),
  };
}
beforeEach(async () => {
  await api('/health');
  await sql((s) => {
    for (const table of [
      'entry_idempotency',
      'entry_tags',
      'entry_images',
      'entries',
      'notifications',
      'audit_log',
      'images',
      'roster',
      'sessions',
      'users',
      'rate_limits',
    ])
      s.sql.exec(`DELETE FROM ${table}`);
    setSetting(s, 'team_code', 'team-code');
  });
});
describe('idempotent workout creation', () => {
  it('returns the original on replay, ignores body differences and counts once in feed and stats', async () => {
    const owner = await signup('owner');
    const tagged = await signup('tagged');
    const first = await api(
      '/entries',
      owner,
      'POST',
      { ...body, tagged_user_ids: [tagged.user.id] },
      'workout-1',
    );
    expect(first.status).toBe(201);
    const original = await first.json<EntryDetail>();
    const replay = await api(
      '/entries',
      owner,
      'POST',
      { ...body, distance_m: 20000, title: 'Changed' },
      'workout-1',
    );
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(original);
    const feed = await (await api('/entries', owner)).json<Page<EntryDetail>>();
    expect(feed.items).toHaveLength(1);
    const stats = await (await api('/stats/week?week=2026-03-09', owner)).json<WeekStats>();
    expect(stats.entries).toHaveLength(1);
    expect(stats.total_m).toBe(original.equiv_m);
    await sql((s) => {
      expect(s.sql.exec('SELECT * FROM notifications').toArray()).toHaveLength(1);
      expect(s.sql.exec('SELECT * FROM audit_log').toArray()).toHaveLength(0);
    });
  });
  it('isolates keys by user and preserves unkeyed creates', async () => {
    const a = await signup('first');
    const b = await signup('second');
    const ids = [];
    for (const [client, key] of [
      [a, 'same-key'],
      [b, 'same-key'],
      [a, undefined],
      [a, undefined],
    ] as const) {
      const response = await api('/entries', client, 'POST', body, key);
      expect(response.status).toBe(201);
      ids.push((await response.json<EntryDetail>()).id);
    }
    expect(new Set(ids).size).toBe(4);
  });
  it.each(['', 'short', 'a'.repeat(129), 'invalid key', 'invalid!key'])(
    'rejects invalid key %j',
    async (key) => {
      const owner = await signup('owner');
      const response = await api('/entries', owner, 'POST', body, key);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect((await (await api('/entries', owner)).json<Page<EntryDetail>>()).items).toHaveLength(
        0,
      );
    },
  );
  it('serializes concurrent identical requests', async () => {
    const owner = await signup('owner');
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => api('/entries', owner, 'POST', body, 'concurrent-key')),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
    const entries = await Promise.all(responses.map((r) => r.json<EntryDetail>()));
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(1);
    expect((await (await api('/entries', owner)).json<Page<EntryDetail>>()).items).toHaveLength(1);
  });
  it('returns NOT_FOUND after deletion, retaining the mapping', async () => {
    const owner = await signup('owner');
    const entry = await (
      await api('/entries', owner, 'POST', body, 'deleted-key')
    ).json<EntryDetail>();
    expect((await api('/entries/' + entry.id, owner, 'DELETE')).status).toBe(204);
    const replay = await api('/entries', owner, 'POST', body, 'deleted-key');
    expect(replay.status).toBe(404);
    expect(await replay.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
  it('replays attached images without validating them as new attachments', async () => {
    const owner = await signup('owner');
    await sql((s) =>
      insertImage(
        s,
        {
          id: 'image',
          owner_id: owner.user.id,
          mime: 'image/png',
          width: 1,
          height: 1,
          created_at: NOW,
        },
        new ArrayBuffer(1),
      ),
    );
    const input = { ...body, image_ids: ['image'] };
    const first = await api('/entries', owner, 'POST', input, 'images-key');
    expect(first.status).toBe(201);
    const original = await first.json<EntryDetail>();
    const replay = await api('/entries', owner, 'POST', input, 'images-key');
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(original);
  });
  it('cleans only expired mappings when inserting a new key', async () => {
    const owner = await signup('owner');
    await sql((s) => {
      s.sql.exec(
        'INSERT INTO entry_idempotency VALUES (?,?,?,?)',
        owner.user.id,
        'expired-key',
        'old',
        '2026-03-01T18:00:00.000Z',
      );
      s.sql.exec(
        'INSERT INTO entry_idempotency VALUES (?,?,?,?)',
        owner.user.id,
        'recent-key',
        'recent',
        NOW,
      );
    });
    expect((await api('/entries', owner, 'POST', body, 'fresh-key')).status).toBe(201);
    await sql((s) =>
      expect(s.sql.exec('SELECT key FROM entry_idempotency ORDER BY key').toArray()).toEqual([
        { key: 'fresh-key' },
        { key: 'recent-key' },
      ]),
    );
  });
  it.each([9, 10])('migrates a v%i database and is rerunnable', async (version) => {
    await sql((s) => {
      s.sql.exec('DROP TABLE entry_idempotency');
      setSetting(s, 'schema_version', version);
      migrate(s);
      expect(getSetting(s, 'schema_version')).toBe(16);
      s.sql.exec(
        'INSERT INTO entry_idempotency VALUES (?,?,?,?)',
        'user',
        'test-key',
        'entry',
        NOW,
      );
      setSetting(s, 'schema_version', version);
      migrate(s);
      migrate(s);
      expect(getSetting(s, 'schema_version')).toBe(16);
      expect(s.sql.exec('SELECT * FROM entry_idempotency').toArray()).toHaveLength(1);
      expect(
        s.sql
          .exec("SELECT name FROM sqlite_master WHERE name IN ('erg_tests','challenges')")
          .toArray(),
      ).toHaveLength(2);
      expect(
        s.sql
          .exec(
            "SELECT name FROM sqlite_master WHERE type='index' AND name='entry_idempotency_created_at'",
          )
          .toArray(),
      ).toHaveLength(1);
    });
  });
});
