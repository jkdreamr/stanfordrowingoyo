/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import type {
  Entry,
  EntryDetail,
  LeaderboardRow,
  PublicUser,
  CommentWithAuthor,
  Announcement,
  Notification,
  WeekStats,
} from '../../shared/types';
import type { Env } from './index';
import { sha256 } from './auth/crypto';
import { details } from './db/entries';
import { deleteUnreferencedImages } from './db/images';
import { uncachedLeaderboard } from './db/stats';
import type { Row } from './db/row';

const bindings = env as unknown as Env;
const NOW = '2026-08-30T18:00:00Z';
const TOKEN = 'large-team-test-session';
function sql<T>(callback: (storage: DurableObjectStorage) => T) {
  return runInDurableObject(bindings.TEAM.get(bindings.TEAM.idFromName('stanford')), (_, state) =>
    callback(state.storage),
  );
}
function api(path: string, method = 'GET', body?: unknown) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method,
    headers: {
      Cookie: `oyo_session=${TOKEN}`,
      'X-OYO-Test-Now': NOW,
      'X-OYO-CSRF': '1',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function ok(path: string, method = 'GET', body?: unknown) {
  const response = await api(path, method, body);
  expect(response.status, path + ' ' + (await response.clone().text())).toBeLessThan(300);
  return response;
}
beforeEach(async () => {
  await SELF.fetch('https://oyo.test/api/health');
  const hash = await sha256(TOKEN);
  await sql((s) => {
    for (const table of [
      'sessions',
      'entry_tags',
      'comment_mentions',
      'entry_images',
      'comments',
      'kudos',
      'notifications',
      'announcements',
      'images',
      'entries',
      'weekly_targets',
      'roster',
      'users',
    ])
      s.sql.exec(`DELETE FROM ${table}`);
    for (let i = 0; i < 150; i++) {
      const user = `u${i}`,
        entry = `e${i}`;
      s.sql.exec(
        "INSERT INTO users (id,email,name,password_hash,password_salt,role,group_key,active,created_at,updated_at) VALUES (?,?,?,'unused','unused',?,'normal',?,?,?)",
        user,
        `${user}@example.com`,
        `Rower ${i}`,
        i === 0 ? 'admin' : 'rower',
        Number(i < 125),
        NOW,
        NOW,
      );
      s.sql.exec(
        "INSERT INTO entries (id,user_id,date,week_start,modality,zone,distance_m,title,notes,mode_factor,zone_factor,equiv_m,visibility,created_at,updated_at) VALUES (?,?,'2026-08-30','2026-08-24','erg','E',1000,'Training','',1,1,1000,'team',?,?)",
        entry,
        user,
        NOW,
        NOW,
      );
      s.sql.exec(
        "INSERT INTO roster (id,name,role,group_key,claimed_by_user_id,created_at) VALUES (?,?,'rower','normal',?,?)",
        `r${i}`,
        `Rower ${i}`,
        user,
        NOW,
      );
      s.sql.exec(
        'INSERT INTO comments VALUES (?,?,?,?,?)',
        `c${i}`,
        'e0',
        user,
        'Training @Rower 1',
        NOW,
      );
      s.sql.exec('INSERT INTO comment_mentions VALUES (?,?,?)', `c${i}`, 'e0', 'u1');
      s.sql.exec('INSERT INTO kudos VALUES (?,?,?)', 'e0', user, NOW);
      s.sql.exec('INSERT INTO entry_tags VALUES (?,?,?)', entry, 'u1', NOW);
      s.sql.exec(
        'INSERT INTO notifications VALUES (?,?,?,?,?,?,NULL)',
        `n${i}`,
        'u0',
        'comment',
        user,
        entry,
        NOW,
      );
      s.sql.exec(
        'INSERT INTO announcements VALUES (?,?,?,?,?,?)',
        `a${i}`,
        user,
        'Team',
        'Training',
        0,
        NOW,
      );
      s.sql.exec(
        "INSERT INTO images VALUES (?,?,'image/png',1,1,?,?)",
        `i${i}`,
        user,
        new Uint8Array([1]).buffer,
        NOW,
      );
      s.sql.exec('INSERT INTO entry_images VALUES (?,?,0)', entry, `i${i}`);
    }
    s.sql.exec('INSERT INTO sessions VALUES (?,?,?,?)', hash, 'u0', '2099-01-01T00:00:00Z', NOW);
  });
});

it('serves every leaderboard metric cold and warm above the SQLite variable limit, with cache invalidation', async () => {
  for (const week of ['2026-08-24', '2026-08-17']) {
    for (const metric of ['percent', 'meters', 'season'] as const) {
      const path = `/leaderboard?metric=${metric}&week=${week}`;
      const expected = await sql((s) => uncachedLeaderboard(s, week, metric, new Date(NOW)));
      const cold = await (await ok(path)).json<LeaderboardRow[]>();
      expect(cold).toHaveLength(125);
      expect(cold).toEqual(expected);
      expect(await (await ok(path)).json()).toEqual(expected);
    }
  }
  await sql((s) => s.sql.exec('UPDATE entries SET equiv_m=2000 WHERE id=?', 'e1').rowsWritten);
  for (const metric of ['percent', 'meters', 'season'] as const) {
    expect(await (await ok(`/leaderboard?metric=${metric}`)).json()).toEqual(
      await sql((s) => uncachedLeaderboard(s, '2026-08-30', metric, new Date(NOW))),
    );
  }
  await sql((s) => s.sql.exec('UPDATE users SET active=1').rowsWritten);
  for (const metric of ['percent', 'meters', 'season'] as const) {
    const path = `/leaderboard?metric=${metric}`;
    const expected = await sql((s) => uncachedLeaderboard(s, '2026-08-30', metric, new Date(NOW)));
    expect(expected).toHaveLength(150);
    expect(await (await ok(path)).json()).toEqual(expected);
    expect(await (await ok(path)).json()).toEqual(expected);
  }
});

it('hydrates large lists and serves stats, directory, feed, social, tags and staff endpoints', async () => {
  for (const query of ['', '?user=u1']) await ok('/stats/week' + query);
  for (const query of ['', '?user=u1', '?season=2025', '?year=2026'])
    await ok('/stats/season' + query);
  expect(await (await ok('/users')).json<PublicUser[]>()).toHaveLength(125);
  await ok('/users/u1');
  expect((await api('/stats/week?user=u149')).status).toBe(404);
  for (const scope of ['feed', 'mine', 'user:u1']) await ok('/entries?scope=' + scope);
  const hydrated = await sql((s) =>
    details(s, s.sql.exec<Row<Entry>>('SELECT * FROM entries ORDER BY id').toArray(), 'u0'),
  );
  expect(hydrated).toHaveLength(150);
  expect(
    hydrated.every(
      (entry) => entry.author && entry.images.length === 1 && entry.tagged?.[0].id === 'u1',
    ),
  ).toBe(true);
  expect(hydrated.find((entry) => entry.id === 'e0')).toMatchObject({
    kudos_count: 150,
    comment_count: 150,
    has_kudos: true,
  });
  expect(await (await ok('/entries/e0/kudos')).json<PublicUser[]>()).toHaveLength(150);
  const comments = await (await ok('/entries/e0/comments')).json<CommentWithAuthor[]>();
  expect(comments).toHaveLength(150);
  expect(comments.every((comment) => comment.author && comment.mentions?.[0].id === 'u1')).toBe(
    true,
  );
  expect(await (await ok('/announcements')).json<Announcement[]>()).toHaveLength(150);
  expect(await (await ok('/notifications')).json<Notification[]>()).toHaveLength(100);
  await ok('/notifications/read', 'POST', { ids: Array.from({ length: 150 }, (_, i) => `n${i}`) });
  expect(
    await sql(
      (s) => s.sql.exec('SELECT id FROM notifications WHERE read_at IS NULL').toArray().length,
    ),
  ).toBe(0);
  const input = {
    date: '2026-08-30',
    modality: 'erg',
    zone: 'E',
    distance_m: 1000,
    title: 'Tagged',
    notes: '',
    tagged_user_ids: Array.from({ length: 10 }, (_, i) => `u${i + 1}`),
  };
  expect((await (await ok('/entries', 'POST', input)).json<EntryDetail>()).tagged).toHaveLength(10);
  expect((await api('/entries', 'POST', { ...input, tagged_user_ids: ['u149'] })).status).toBe(400);
  await ok('/admin/compliance?week=2026-08-24');
  const csv = await (await ok('/admin/export?start=2026-08-24&end=2026-08-30')).text();
  expect(csv.split('\r\n').filter(Boolean)).toHaveLength(152);
  expect(await (await ok('/admin/roster')).json<unknown[]>()).toHaveLength(150);
  expect(await (await ok('/admin/users')).json<unknown[]>()).toHaveLength(150);
});

it('hydrates more than 100 workouts in one user weekly stats response', async () => {
  await sql((s) => s.sql.exec('UPDATE entries SET user_id=?', 'u1').rowsWritten);
  const stats = await (await ok('/stats/week?user=u1')).json<WeekStats>();
  expect(stats.entries).toHaveLength(150);
  expect(stats.total_m).toBe(150000);
  await ok('/stats/season?user=u1');
  await ok('/users/u1');
});

it('handles empty and untrusted list IDs and preserves referenced images when deleting 150 candidates', async () => {
  await sql((s) => {
    expect(details(s, [], 'u0')).toEqual([]);
    deleteUnreferencedImages(s, []);
    deleteUnreferencedImages(s, ["' OR 1=1 --"]);
    expect(s.sql.exec('SELECT id FROM images').toArray()).toHaveLength(150);
    s.sql.exec('UPDATE users SET avatar_image_id=? WHERE id=?', 'i1', 'u1');
    s.sql.exec('DELETE FROM entry_images WHERE image_id != ?', 'i0');
    deleteUnreferencedImages(
      s,
      Array.from({ length: 150 }, (_, i) => `i${i}`),
    );
    expect(
      s.sql
        .exec<{ id: string }>('SELECT id FROM images ORDER BY id')
        .toArray()
        .map((row) => row.id),
    ).toEqual(['i0', 'i1']);
  });
  await ok('/notifications/read', 'POST', { ids: ["' OR 1=1 --", 'missing'] });
  expect(
    await sql(
      (s) => s.sql.exec('SELECT id FROM notifications WHERE read_at IS NULL').toArray().length,
    ),
  ).toBe(150);
  await ok('/notifications/read', 'POST', { ids: [] });
  expect(
    await sql(
      (s) => s.sql.exec('SELECT id FROM notifications WHERE read_at IS NULL').toArray().length,
    ),
  ).toBe(0);
});
