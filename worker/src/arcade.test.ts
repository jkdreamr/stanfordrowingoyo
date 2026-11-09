/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import type { Env } from './index';
import type { ArcadeDay, ArcadeRunStart } from '../../shared/types';
import { sha256 } from './auth/crypto';
import { arcadeSeed } from './games/arcade';

const NOW = '2026-03-18T18:00:00Z',
  DATE = '2026-03-18',
  TOKEN = 'arcade-test-token';
const root = '/games/chicken-crossing';
const at = (ms: number) => new Date(Date.parse(NOW) + ms).toISOString();
function sql<T>(callback: (s: DurableObjectStorage) => T | Promise<T>) {
  const bindings = env as unknown as Env;
  return runInDurableObject(bindings.TEAM.get(bindings.TEAM.idFromName('stanford')), (_, state) =>
    callback(state.storage),
  );
}
function api(path: string, method = 'GET', body?: unknown, now = NOW, token = TOKEN) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method,
    headers: {
      Cookie: `oyo_session=${token}`,
      'X-OYO-Test-Now': now,
      'X-OYO-CSRF': '1',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const day = async () => (await api(root + '/today')).json<ArcadeDay>();
const start = async (now = NOW) =>
  (await api(root + '/runs/start', 'POST', { date: now.slice(0, 10) }, now)).json<ArcadeRunStart>();
const stats = (rows = 10) => ({ rows, coins: 0, hops: rows, death: 'quit', duration_ms: 5000 });
const finish = (run: string, score = 10, value: unknown = stats(score), now = at(5000)) =>
  api(root + '/runs/finish', 'POST', { date: DATE, run, score, stats: value }, now);
const unlock = () =>
  sql((s) => {
    s.sql.exec("UPDATE users SET role='coach'");
  });
beforeEach(async () => {
  await SELF.fetch('https://oyo.test/api/health');
  const hash = await sha256(TOKEN);
  await sql((s) => {
    for (const table of [
      'game_results',
      'game_progress',
      'entries',
      'sessions',
      'users',
      'team_plan_slots',
    ])
      s.sql.exec(`DELETE FROM ${table}`);
    s.sql.exec(
      "INSERT INTO users (id,email,name,password_hash,password_salt,role,group_key,active,created_at,updated_at) VALUES ('u0','u0@example.com','Rower 0','unused','unused','rower','normal',1,?,?)",
      NOW,
      NOW,
    );
    s.sql.exec('INSERT INTO sessions VALUES (?,?,?,?)', hash, 'u0', '2030-01-01T00:00:00Z', NOW);
  });
});
it('gates both writes, hides locked seed, and has read-only today', async () => {
  expect(await day()).toMatchObject({ seed: null, runs: [], access: { unlocked: false } });
  expect((await api(root + '/runs/start', 'POST', { date: DATE })).status).toBe(403);
  expect((await finish('unknown')).status).toBe(403);
  await sql((s) => expect(s.sql.exec('SELECT * FROM game_progress').toArray()).toHaveLength(0));
});
it.each(['coach', 'coxswain', 'admin'])('unlocks %s', async (role) => {
  await sql((s) => s.sql.exec("UPDATE users SET role=? WHERE id='u0'", role));
  expect(await start()).toMatchObject({ attempt: 1, access: { reason: 'staff' } });
});
it('unlocks no_oyo and uses a team-wide, day-specific seed', async () => {
  await sql((s) =>
    s.sql.exec(
      "INSERT INTO team_plan_slots (week_start,day,slot,kind,text) VALUES ('2026-03-16',0,'AM','off','Rest')",
    ),
  );
  const first = await start();
  expect(first).toMatchObject({
    seed: arcadeSeed('chicken-crossing', DATE),
    access: { reason: 'no_oyo' },
  });
  const hash = await sha256('second');
  await sql((s) => {
    s.sql.exec(
      "INSERT INTO users (id,email,name,password_hash,password_salt,role,group_key,active,created_at,updated_at) SELECT 'u1','u1@example.com','Second',password_hash,password_salt,'coach',group_key,active,created_at,updated_at FROM users WHERE id='u0'",
    );
    s.sql.exec('INSERT INTO sessions VALUES (?,?,?,?)', hash, 'u1', '2030-01-01T00:00:00Z', NOW);
  });
  const second = await (
    await api(root + '/runs/start', 'POST', { date: DATE }, NOW, 'second')
  ).json<ArcadeRunStart>();
  expect(second.seed).toBe(first.seed);
  await unlock();
  expect((await start('2026-03-19T18:00:00Z')).seed).not.toBe(first.seed);
});
it('keeps the best of three, updates payload, boards and streak, and rejects replay', async () => {
  await unlock();
  const first = await start();
  expect((await finish(first.run)).status).toBe(200);
  expect(await day()).toMatchObject({ best: 10 });
  const before = await sql((s) => s.sql.exec('SELECT * FROM game_results').toArray()[0]);
  expect(await (await api(root + '/leaderboard')).json()).toMatchObject({ rows: [{ score: 10 }] });
  await api('/games/leaderboard');
  const second = await start(at(6000));
  expect((await finish(second.run, 20, stats(20), at(11000))).status).toBe(200);
  expect(await (await api(root + '/leaderboard')).json()).toMatchObject({ rows: [{ score: 20 }] });
  expect(await (await api('/games/leaderboard')).json()).toMatchObject({ rows: [{ days: 1 }] });
  const third = await start(at(12000));
  expect((await finish(third.run, 5, stats(5), at(17000))).status).toBe(200);
  expect(await day()).toMatchObject({ best: 20, attempts_left: 0 });
  await sql((s) => {
    const row = s.sql
      .exec<{ score: number; payload_json: string; created_at: string }>(
        'SELECT * FROM game_results',
      )
      .toArray()[0];
    expect(row.score).toBe(20);
    expect(row.created_at).toBe(before.created_at);
    expect(JSON.parse(row.payload_json)).toMatchObject({
      best_attempt: 2,
      runs: [{ score: 10 }, { score: 20 }, { score: 5 }],
    });
  });
  expect(await (await api(root + '/runs/start', 'POST', { date: DATE })).json()).toMatchObject({
    error: { code: 'NO_RUNS_LEFT' },
  });
  expect(await (await finish(first.run)).json()).toMatchObject({ error: { code: 'RUN_FINISHED' } });
  expect(await (await finish('unknown')).json()).toMatchObject({ error: { code: 'RUN_UNKNOWN' } });
  expect((await api(root + '/results', 'POST', {})).status).toBe(405);
  const list = await (await api('/games')).json<{ games: { id: string }[]; streak: unknown }>();
  expect(JSON.stringify(list)).toContain('chicken-crossing');
  expect(list.streak).toMatchObject({ current: 1, best: 1 });
  expect((await api('/games/nope/today')).status).toBe(404);
});
it('allows empty quits but rejects backwards elapsed time and refreshed locked access', async () => {
  await unlock();
  const run = await start();
  expect((await finish(run.run, 0, { ...stats(0), duration_ms: 0 }, at(-1))).status).toBe(400);
  await sql((s) => s.sql.exec("UPDATE users SET role='rower'"));
  expect(await day()).toMatchObject({ seed: null, runs: [{ status: 'active' }] });
  expect((await finish(run.run, 0, { ...stats(0), duration_ms: 0 })).status).toBe(403);
  await unlock();
  expect((await finish(run.run, 0, { ...stats(0), duration_ms: 0 })).status).toBe(200);
  expect(await day()).toMatchObject({ best: 0 });
});
it('abandons active runs and never exposes their tokens in reads', async () => {
  await unlock();
  const first = await start();
  await start();
  const current = await day();
  expect(current.runs.map((r) => r.status)).toEqual(['abandoned', 'active']);
  expect(JSON.stringify(current)).not.toContain(first.run);
  expect(await (await finish(first.run)).json()).toMatchObject({ error: { code: 'RUN_FINISHED' } });
});
it('rejects stale and missing dates on writes without changes', async () => {
  await unlock();
  const run = await start();
  const before = await day();
  for (const action of ['start', 'finish']) {
    const response = await api(root + '/runs/' + action, 'POST', {
      date: '2026-03-17',
      run: run.run,
      score: 0,
      stats: stats(0),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: 'DAY_CHANGED' } });
    expect((await api(root + '/runs/' + action, 'POST', {})).status).toBe(400);
  }
  expect(await day()).toEqual(before);
});
it.each([
  [11, stats()],
  [13, { ...stats(1), coins: 4 }],
  [100, stats(100)],
  [10, { ...stats(), extra: true }],
  [100001, stats(100001)],
  [0, null],
  [0, {}],
])('rejects implausible score %s without consuming the run', async (score, value) => {
  await unlock();
  const run = await start();
  const response = await finish(run.run, score as number, value);
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: { message: 'Run is not plausible.' } });
  expect((await day()).runs[0].status).toBe('active');
  expect((await finish(run.run)).status).toBe(200);
});
