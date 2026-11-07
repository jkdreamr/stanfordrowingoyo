/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { User, LeaderboardRow, SeasonStats, WeekStats } from '../../shared/types';
import { GROUP_TARGETS } from '../../shared/seed';
import type { Env } from './index';
import type { Context } from './context';
import { migrate } from './db/migrate';
import { getSetting, setSetting } from './db/settings';
import { sha256 } from './auth/crypto';
import { insertRosterFixture } from './testFixtures';
import { route } from './router';
import { details, listEntries, checkImages } from './db/entries';
import { comments } from './db/social';
import { notifications } from './db/notifications';
import { visibleImage } from './db/images';
const bindings = env as unknown as Env;
const NOW = '2026-03-09T18:00:00Z';
type Client = { cookie: string; user: User };
function sql<T>(callback: (storage: DurableObjectStorage) => T): Promise<T> {
  return runInDurableObject(
    bindings.TEAM.get(bindings.TEAM.idFromName('stanford')),
    (_instance, state) => callback(state.storage),
  );
}
function api(path: string, client?: Client, method = 'GET', body?: unknown, time = NOW) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-OYO-CSRF': '1',
      'X-OYO-Test-Now': time,
      ...(client ? { Cookie: client.cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function user(name: string, role = 'rower') {
  const id = await sql((storage) => insertRosterFixture(storage, name, role));
  const response = await api('/auth/signup', undefined, 'POST', {
    roster_id: id,
    email: name.toLowerCase() + '@example.com',
    password: 'password123',
    team_code: 'team-code',
  });
  expect(response.status).toBe(201);
  return {
    cookie: response.headers.get('Set-Cookie')!.split(';')[0],
    user: await response.json<User>(),
  };
}
async function entry(client: Client, distance: number, date = '2026-03-09', time = NOW) {
  const response = await api(
    '/entries',
    client,
    'POST',
    {
      date,
      distance_m: distance,
      modality: 'erg',
      zone: 'E',
      title: 'Training',
      notes: '',
      visibility: 'team',
    },
    time,
  );
  expect(response.status).toBe(201);
  return response.json<{ id: string }>();
}
function trace(storage: DurableObjectStorage) {
  const queries: { query: string; bindings: unknown[] }[] = [];
  const tracedSql = new Proxy(storage.sql, {
    get(target, key) {
      if (key === 'exec')
        return (...args: Parameters<SqlStorage['exec']>) => {
          queries.push({ query: args[0], bindings: args.slice(1) });
          return target.exec(...args);
        };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const traced = new Proxy(storage, {
    get(target, key) {
      if (key === 'sql') return tracedSql;
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { storage: traced, queries };
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
        'announcements',
        'audit_log',
        'presets',
        'plan_slots',
        'plan_totals',
      ])
        storage.sql.exec(`DELETE FROM ${table}`);
      migrate(storage);
      setSetting(storage, 'team_code', 'team-code');
    }),
  );
});
describe('leaderboard dates, exact ratios and defensive targets', () => {
  it('chooses the season from September 2 before normalizing its week to August 31', async () => {
    const athlete = await user('Athlete');
    const time = '2026-09-02T18:00:00Z';
    await sql((storage) =>
      storage.sql.exec('UPDATE sessions SET expires_at=?', '2027-01-01T00:00:00Z'),
    );
    await entry(athlete, 100000, '2026-08-31', time);
    await entry(athlete, 20000, '2026-09-01', time);
    for (const path of [
      '/leaderboard?metric=season',
      '/leaderboard?metric=season&week=2026-09-02',
    ]) {
      const response = await api(path, athlete, 'GET', undefined, time);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject([{ total_m: 20000, target_m: 80000 }]);
    }
    const previous = await api(
      '/leaderboard?metric=season&week=2026-08-31',
      athlete,
      'GET',
      undefined,
      time,
    );
    expect((await previous.json<LeaderboardRow[]>())[0].total_m).toBe(100000);
    const weekly = await api(
      '/leaderboard?metric=meters&week=2026-09-02',
      athlete,
      'GET',
      undefined,
      time,
    );
    expect((await weekly.json<LeaderboardRow[]>())[0].total_m).toBe(120000);
  });
  it('ranks exact ratios before meters and uses rounded percentages only for display', async () => {
    const clients = await Promise.all(
      ['Alice', 'Bravo', 'Charlie', 'Delta'].map((name) => user(name)),
    );
    const meters = [20001, 10001, 10001, 20002];
    const targets = [20000, 10000, 10000, 20000];
    for (let i = 0; i < clients.length; i++) {
      expect((await api('/me/target', clients[i], 'PUT', { target_m: targets[i] })).status).toBe(
        200,
      );
      await entry(clients[i], meters[i]);
    }
    const rows = await (
      await api('/leaderboard?metric=percent', clients[0])
    ).json<LeaderboardRow[]>();
    expect(rows.map((row) => row.user.name)).toEqual(['Delta', 'Bravo', 'Charlie', 'Alice']);
    expect(rows.map((row) => row.percent)).toEqual([100, 100, 100, 100]);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 2, 4]);
  });
  it('bounds and normalizes all week parameters, and falls back before the first target history', async () => {
    const athlete = await user('Athlete');
    const owner = await user('Owner', 'admin');
    await sql((storage) =>
      setSetting(storage, 'group_target_history', [
        { week_start: '2025-09-01', targets: { frosh: 71000, normal: 91000, u23: 111000 } },
      ]),
    );
    const paths = ['/stats/week', '/leaderboard', '/admin/compliance'];
    for (const path of paths) {
      for (const date of ['1999-12-31', '2026-02-30', '2026-13-01', 'bad', '', '2027-03-10'])
        expect(
          (await api(path + '?week=' + date, path.includes('/admin/') ? owner : athlete)).status,
          path + ' ' + date,
        ).toBe(400);
      for (const date of ['2000-01-01', '2027-03-09'])
        expect(
          (await api(path + '?week=' + date, path.includes('/admin/') ? owner : athlete)).status,
        ).toBe(200);
    }
    const old = await (await api('/stats/week?week=2000-01-01', athlete)).json<WeekStats>();
    expect(old).toMatchObject({ week_start: '1999-12-27', total_m: 0, target_m: 91000 });
    const normalized = await (await api('/stats/week?week=2026-03-11', athlete)).json<WeekStats>();
    expect(normalized.week_start).toBe('2026-03-09');
    for (const missing of ['empty', 'missing']) {
      await sql((storage) =>
        missing === 'empty'
          ? setSetting(storage, 'group_target_history', [])
          : storage.sql.exec('DELETE FROM settings WHERE key=?', 'group_target_history'),
      );
      const fallback = await (await api('/stats/week?week=2000-01-01', athlete)).json<WeekStats>();
      expect(fallback.target_m).toBe(GROUP_TARGETS.normal);
      expect((await api('/stats/season?year=2020', athlete)).status).toBe(200);
      expect((await api('/leaderboard?week=2000-01-01', athlete)).status).toBe(200);
    }
  });
});
describe('batched statistics and indexed read paths', () => {
  it('hydrates tags and mentions with constant query counts for one and many entries/comments', async () => {
    const owner = await user('Owner');
    const mate = await user('Mate');
    const logged: { id: string }[] = [];
    for (let i = 0; i < 12; i++) logged.push(await entry(owner, 1000));
    await sql((storage) => {
      for (const row of logged) {
        storage.sql.exec('INSERT INTO entry_tags VALUES (?,?,?)', row.id, mate.user.id, NOW);
        storage.sql.exec(
          'INSERT INTO comments VALUES (?,?,?,?,?)',
          row.id,
          logged[0].id,
          owner.user.id,
          '@Mate',
          NOW,
        );
        storage.sql.exec(
          'INSERT INTO comment_mentions VALUES (?,?,?)',
          row.id,
          logged[0].id,
          mate.user.id,
        );
      }
      const traced = trace(storage);
      const rows = listEntries(storage, owner.user.id, 'feed');
      for (const size of [1, 12]) {
        traced.queries.length = 0;
        const hydrated = details(traced.storage, rows.slice(0, size), owner.user.id);
        expect(hydrated).toHaveLength(size);
        expect(hydrated.every((row) => row.tagged[0].id === mate.user.id)).toBe(true);
        expect(traced.queries).toHaveLength(5);
      }
      traced.queries.length = 0;
      expect(
        comments(traced.storage, logged[0].id).every((row) => row.mentions[0].id === mate.user.id),
      ).toBe(true);
      expect(traced.queries).toHaveLength(3);
      storage.sql.exec('DELETE FROM comments WHERE id!=?', logged[0].id);
      traced.queries.length = 0;
      expect(comments(traced.storage, logged[0].id)).toHaveLength(1);
      expect(traced.queries).toHaveLength(3);
      traced.queries.length = 0;
      expect(comments(traced.storage, 'missing')).toEqual([]);
      expect(traced.queries).toHaveLength(1);
    });
  });
  it('returns an empty leaderboard when no users are eligible', async () => {
    const owner = await user('Owner', 'admin');
    for (const metric of ['percent', 'meters', 'season']) {
      const response = await api('/leaderboard?metric=' + metric, owner);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
    }
  });
  it('keeps complete route query counts below 20 with 40 users and 8000 entries each', async () => {
    const tokenHash = await sha256('performance-session');
    await sql((storage) =>
      storage.transactionSync(() => {
        storage.sql.exec(
          `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i+1 FROM n WHERE i<39)
        INSERT INTO users (id,email,name,password_hash,password_salt,role,group_key,on_leaderboard,active,created_at,updated_at)
        SELECT 'perf-'||i,'perf'||i||'@example.com','Athlete '||i,'hash','salt','rower','normal',1,1,?,? FROM n`,
          NOW,
          NOW,
        );
        storage.sql.exec(
          'INSERT INTO sessions VALUES (?,?,?,?)',
          tokenHash,
          'perf-0',
          '2027-01-01T00:00:00Z',
          NOW,
        );
        storage.sql.exec(
          `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i+1 FROM n WHERE i<7999),
        d AS (SELECT i,date('2026-03-09','-'||(i%180)||' days') AS day FROM n)
        INSERT INTO entries (id,user_id,date,week_start,modality,zone,distance_m,title,notes,mode_factor,zone_factor,equiv_m,visibility,created_at,updated_at)
        SELECT u.id||'-entry-'||d.i,u.id,d.day,date(d.day,'-'||((CAST(strftime('%w',d.day) AS INTEGER)+6)%7)||' days'),
        'erg','E',1000,'Training','',1,1,1000,'team',?,? FROM users u CROSS JOIN d`,
          NOW,
          NOW,
        );
        storage.sql.exec(
          'INSERT INTO weekly_targets SELECT id,?,? FROM users',
          '2025-09-01',
          80000,
        );
        storage.sql.exec(
          'INSERT INTO weekly_targets SELECT id,?,? FROM users',
          '2026-01-05',
          90000,
        );
        setSetting(storage, 'group_target_history', [
          { week_start: '2000-01-01', targets: { frosh: 60000, normal: 80000, u23: 100000 } },
          { week_start: '2025-10-06', targets: { frosh: 65000, normal: 85000, u23: 105000 } },
        ]);
      }),
    );
    const counts = await sql(async (storage) => {
      expect(storage.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM entries').one().n).toBe(
        320000,
      );
      const cases = [
        '/leaderboard?metric=percent',
        '/leaderboard?metric=meters',
        '/leaderboard?metric=season',
        '/stats/season?season=2025',
        '/stats/season?year=2026',
        '/stats/season?season=2025&user=perf-1',
        '/stats/season?year=2026&user=perf-1',
        '/users/perf-0',
        '/users/perf-1',
      ];
      const counts: Record<string, number> = {};
      for (const path of cases) {
        const traced = trace(storage);
        const ctx: Context = {
          request: new Request('https://oyo.test/api' + path, {
            headers: { Cookie: 'oyo_session=performance-session' },
          }),
          storage: traced.storage,
          env: bindings,
          now: new Date(NOW),
          params: {},
        };
        const response = await route(ctx);
        expect(response.status, path).toBe(200);
        counts[path] = traced.queries.length;
        expect(counts[path], path).toBeLessThan(20);
        const body = await response.json<SeasonStats | { stats: SeasonStats } | LeaderboardRow[]>();
        if (Array.isArray(body)) {
          expect(body).toHaveLength(40);
          expect(body[0].streak).toBeGreaterThan(0);
          expect(body[0].entry_count).toBe(45);
        } else {
          const stats = 'stats' in body ? body.stats : body;
          const range = path.includes('year=') ? '2026-01-01' : '2025-09-01';
          const owner = !path.includes('perf-1');
          const expected = storage.sql
            .exec<{ total: number }>(
              'SELECT COALESCE(SUM(equiv_m),0) AS total FROM entries WHERE user_id=? AND date>=? AND date<=?',
              owner ? 'perf-0' : 'perf-1',
              range,
              '2026-03-09',
            )
            .one().total;
          expect(stats.total_m).toBe(expected);
          expect(stats.days.reduce((sum, day) => sum + day.equiv_m, 0)).toBe(expected);
        }
        expect(
          traced.queries.filter((row) => row.query.includes('FROM weekly_targets')),
        ).toHaveLength(1);
        expect(
          traced.queries.filter((row) => row.bindings.includes('group_target_history')),
        ).toHaveLength(1);
      }
      return counts;
    });
    console.log('SQL counts (40 users x 8000 entries): ' + JSON.stringify(counts));
  }, 60000);
  it('migrates v3 to v4 idempotently and uses the new indexes for actual read queries', async () => {
    const athlete = await user('Athlete');
    const logged = await entry(athlete, 10000);
    const names = [
      'entries_feed',
      'entries_user_feed',
      'comments_entry_created',
      'entry_images_image',
      'notifications_user_created',
    ];
    await sql((storage) => {
      for (const name of names) storage.sql.exec(`DROP INDEX ${name}`);
      setSetting(storage, 'schema_version', 3);
      migrate(storage);
      migrate(storage);
      expect(getSetting(storage, 'schema_version')).toBe(10);
      expect(
        storage.sql.exec('SELECT id FROM entries WHERE id=?', logged.id).toArray(),
      ).toHaveLength(1);
      storage.sql.exec(
        'INSERT INTO images VALUES (?,?,?,?,?,?,?)',
        'image',
        athlete.user.id,
        'image/png',
        1,
        1,
        new ArrayBuffer(1),
        NOW,
      );
      storage.sql.exec('INSERT INTO entry_images VALUES (?,?,?)', logged.id, 'image', 0);
      storage.sql.exec(
        'INSERT INTO comments VALUES (?,?,?,?,?)',
        'comment',
        logged.id,
        athlete.user.id,
        'Text',
        NOW,
      );
      storage.sql.exec(
        'INSERT INTO notifications VALUES (?,?,?,?,?,?,?)',
        'notification',
        athlete.user.id,
        'comment',
        athlete.user.id,
        logged.id,
        NOW,
        null,
      );
      const traced = trace(storage);
      const cases: [string, string, string, () => unknown][] = [
        [
          'feed',
          'entries_feed',
          'SELECT * FROM entries',
          () => listEntries(traced.storage, athlete.user.id, 'feed'),
        ],
        [
          'mine',
          'entries_user_feed',
          'SELECT * FROM entries',
          () => listEntries(traced.storage, athlete.user.id, 'mine'),
        ],
        [
          'feed cursor',
          'entries_feed',
          'SELECT * FROM entries',
          () => listEntries(traced.storage, athlete.user.id, 'feed', [NOW, logged.id]),
        ],
        [
          'mine cursor',
          'entries_user_feed',
          'SELECT * FROM entries',
          () => listEntries(traced.storage, athlete.user.id, 'mine', [NOW, logged.id]),
        ],
        [
          'comments',
          'comments_entry_created',
          'SELECT * FROM comments',
          () => comments(traced.storage, logged.id),
        ],
        [
          'notifications',
          'notifications_user_created',
          'SELECT * FROM notifications',
          () => notifications(traced.storage, athlete.user.id),
        ],
        [
          'image ref',
          'entry_images_image',
          'SELECT entry_id FROM entry_images',
          () => checkImages(traced.storage, ['image'], athlete.user.id, logged.id),
        ],
        [
          'image read',
          'entry_images_image',
          'SELECT i.id FROM images',
          () => visibleImage(traced.storage, 'image', 'other'),
        ],
      ];
      for (const [label, index, prefix, read] of cases) {
        traced.queries.length = 0;
        read();
        const query = traced.queries.find((row) => row.query.startsWith(prefix))!;
        const plan = storage.sql
          .exec<{ detail: string }>('EXPLAIN QUERY PLAN ' + query.query, ...query.bindings)
          .toArray()
          .map((row) => row.detail)
          .join('\n');
        expect(plan, label).toContain(index);
        expect(plan, label).not.toMatch(/SCAN (entries|comments|notifications|entry_images|ei)\b/);
        expect(plan, label).not.toContain('USE TEMP B-TREE FOR ORDER BY');
      }
    });
  });
});
