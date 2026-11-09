/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import type { Env } from './index';
import type {
  DealDay,
  GameResult,
  GameDayLeaderboard,
  GamesWeekLeaderboard,
} from '../../shared/types';
import { sha256 } from './auth/crypto';
import { dealRound } from './games/deal/generate';
import { DEAL_ENABLED, DIVE_ENABLED } from './games/features';

const bindings = env as unknown as Env;
const NOW = '2026-11-16T18:00:00Z',
  DATE = '2026-11-16',
  TOKEN = 'deal-test';
const at = (ms: number) => new Date(Date.parse(NOW) + ms).toISOString();
function sql<T>(fn: (storage: DurableObjectStorage) => T | Promise<T>) {
  return runInDurableObject(bindings.TEAM.get(bindings.TEAM.idFromName('stanford')), (_, state) =>
    fn(state.storage),
  );
}
function api(path: string, method = 'GET', body?: unknown, ms = 0) {
  return SELF.fetch('https://oyo.test/api' + path, {
    method,
    headers: {
      Cookie: `oyo_session=${TOKEN}`,
      'Content-Type': 'application/json',
      'X-OYO-CSRF': '1',
      'X-OYO-Test-Now': at(ms),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const call = (action: string, body?: unknown, ms = 0) =>
  api('/games/deal/' + action, body === undefined ? 'GET' : 'POST', body, ms);
async function day(ms = 0) {
  return (await call('today', undefined, ms)).json<DealDay>();
}
async function failure(response: Response, status: number, code?: string) {
  expect(response.status).toBe(status);
  if (code) expect(await response.json()).toMatchObject({ error: { code } });
}
async function state() {
  return sql(
    (s) =>
      s.sql
        .exec<{ state_json: string }>(
          "SELECT state_json FROM game_progress WHERE user_id='u0' AND game='deal'",
        )
        .toArray()[0]?.state_json,
  );
}
async function unlock() {
  await sql((s) => s.sql.exec("UPDATE users SET role='coach' WHERE id='u0'"));
}
beforeEach(async () => {
  await SELF.fetch('https://oyo.test/api/health');
  const hash = await sha256(TOKEN);
  await sql((s) => {
    for (const table of ['game_results', 'game_progress', 'entries', 'sessions', 'users'])
      s.sql.exec(`DELETE FROM ${table}`);
    for (let i = 0; i < 4; i++)
      s.sql.exec(
        "INSERT INTO users (id,email,name,password_hash,password_salt,role,group_key,active,created_at,updated_at) VALUES (?,?,?,'unused','unused','rower','normal',1,?,?)",
        `u${i}`,
        `u${i}@example.com`,
        `Rower ${i}`,
        NOW,
        NOW,
      );
    s.sql.exec('INSERT INTO sessions VALUES (?,?,?,?)', hash, 'u0', '2027-01-01T00:00:00Z', NOW);
  });
});
it('enables Deal, keeps Dive disabled, gates access and generic submission', async () => {
  expect(DEAL_ENABLED).toBe(true);
  expect(DIVE_ENABLED).toBe(false);
  expect(await day()).toMatchObject({
    access: { unlocked: false },
    round: 0,
    results: [],
    active: null,
    done: false,
    totalMs: null,
  });
  for (const action of ['start', 'answer', 'skip'])
    await failure(await call(action, { round: 0 }), 403, 'GAME_LOCKED');
  await failure(await api('/games/deal/results', 'POST', { payload: 1 }), 403, 'GAME_LOCKED');
  await unlock();
  await failure(
    await api('/games/deal/results', 'POST', { payload: 1 }),
    405,
    'METHOD_NOT_ALLOWED',
  );
});
it('completes five rounds atomically and stores summed integer tenths with the exact payload', async () => {
  await unlock();
  let total = 0;
  for (let round = 0; round < 5; round++) {
    const start = round * 20000;
    expect((await call('start', { round, date: DATE }, start)).status).toBe(200);
    const p = dealRound(DATE, round);
    const response = await call(
      'answer',
      { round, date: DATE, steps: p.solution, elapsedMs: 8765 },
      start + 10000,
    );
    expect(response.status).toBe(200);
    const d = await response.json<DealDay>();
    total += 8765;
    expect(d.results[round]).toMatchObject({
      round,
      cards: p.cards,
      goal: p.goal,
      timeMs: 8765,
      skipped: false,
      parMs: p.parMs,
      solution: p.solution,
      teamBest: { timeMs: 8765, name: 'Rower 0', me: true },
    });
    expect(d).toMatchObject({
      round: round + 1,
      active: null,
      done: round === 4,
      totalMs: round === 4 ? total : null,
    });
  }
  const result = await (await api('/games/deal/results/me')).json<GameResult>();
  expect(result.score).toBe(Math.floor(total / 100));
  expect(Object.keys(result.payload as object)).toEqual(['rounds']);
  expect(Object.keys((result.payload as { rounds: object[] }).rounds[0]).sort()).toEqual([
    'cards',
    'goal',
    'parMs',
    'skipped',
    'timeMs',
  ]);
  for (const action of ['start', 'answer', 'skip'])
    await failure(await call(action, { round: 4 }, 100000), 409, 'ALREADY_PLAYED');
  expect((await day()).done).toBe(true);
  expect(
    await sql(
      (s) => s.sql.exec("SELECT * FROM game_results WHERE game_id='deal'").toArray().length,
    ),
  ).toBe(1);
});
it('resumes the same active hand without consuming it or exposing future puzzles', async () => {
  await unlock();
  const started = await (await call('start', { round: 0 })).json<DealDay>();
  const saved = await state(),
    resumed = await day(12345);
  expect(resumed.active).toEqual({ ...started.active, elapsedMs: 12345 });
  expect(resumed.results).toEqual([]);
  expect(resumed.round).toBe(0);
  expect(await state()).toBe(saved);
  const json = JSON.stringify(resumed);
  expect(json).not.toContain('solution');
  for (let round = 1; round < 5; round++) {
    const future = dealRound(DATE, round);
    expect(json).not.toContain(`"goal":${future.goal}`);
    expect(json).not.toContain(JSON.stringify(future.cards));
  }
});
it('rejects extra fields, malformed witnesses and implausible timing without changing progress', async () => {
  await unlock();
  await call('start', { round: 0 });
  const saved = await state();
  const valid = { round: 0, steps: dealRound(DATE, 0).solution, elapsedMs: 5000 };
  for (const body of [
    { ...valid, extra: 1 },
    { ...valid, steps: [] },
    { ...valid, steps: [{ a: 0, op: '+', b: 0 }] },
    { ...valid, elapsedMs: -1 },
    { ...valid, elapsedMs: '5000' },
    { round: 0, steps: valid.steps },
  ]) {
    await failure(await call('answer', body, 5000), 400);
    expect(await state()).toBe(saved);
  }
  const bad = await call('answer', { ...valid, steps: [] }, 5000);
  expect(await bad.json()).toMatchObject({ error: { message: 'Steps do not reach the goal.' } });
  const fast = await call('answer', valid, 100);
  expect(fast.status).toBe(400);
  expect(await fast.json()).toMatchObject({
    error: { message: 'Timing is not plausible for this round.' },
  });
  for (const action of ['start', 'skip']) {
    await failure(await call(action, { round: 0, extra: 1 }, 5000), 400);
    expect(await state()).toBe(saved);
  }
  expect((await day(6000)).active?.elapsedMs).toBe(6000);
});
it.each([
  [0, 7500],
  [100000, 10000],
  [9000, 9000],
])('clamps client elapsed %s to %s', async (elapsedMs, expected) => {
  await unlock();
  await call('start', { round: 0 });
  const d = await (
    await call('answer', { round: 0, steps: dealRound(DATE, 0).solution, elapsedMs }, 10000)
  ).json<DealDay>();
  expect(d.results[0].timeMs).toBe(expected);
});
it('applies skip penalties and caps a resumed round, including finalization of round five', async () => {
  await unlock();
  await call('start', { round: 0 });
  let d = await (await call('skip', { round: 0 }, 5000)).json<DealDay>();
  expect(d.results[0]).toMatchObject({ timeMs: 65000, skipped: true, teamBest: null });
  await call('start', { round: 1 }, 5000);
  d = await day(305000);
  expect(d.results[1]).toMatchObject({ timeMs: 300000, skipped: true });
  expect(d.round).toBe(2);
  for (let round = 2; round < 4; round++) {
    await call('start', { round }, 305000);
    await call('skip', { round }, 605000);
  }
  await call('start', { round: 4 }, 605000);
  d = await day(905000);
  expect(d).toMatchObject({ round: 5, done: true, totalMs: 1265000, active: null });
  expect((await (await api('/games/deal/results/me')).json<GameResult>()).score).toBe(12650);
  await day(906000);
  expect(
    await sql(
      (s) => s.sql.exec("SELECT * FROM game_results WHERE game_id='deal'").toArray().length,
    ),
  ).toBe(1);
});
it('caps a valid late answer and enforces all order/date conflict codes', async () => {
  await unlock();
  for (const action of ['answer', 'skip'])
    await failure(await call(action, { round: 0 }), 409, 'ROUND_NOT_STARTED');
  await failure(await call('start', { round: 1 }), 409, 'ROUND_ORDER');
  for (const action of ['start', 'answer', 'skip'])
    await failure(await call(action, { round: 0, date: '2026-11-15' }), 409, 'DAY_CHANGED');
  expect(await state()).toBeUndefined();
  await call('start', { round: 0 });
  const saved = await state();
  await failure(await call('start', { round: 0 }), 409, 'ROUND_STARTED');
  await failure(await call('skip', { round: 1 }), 409, 'ROUND_ORDER');
  await failure(await call('answer', { round: 0, date: '2026-11-15' }, 5000), 409, 'DAY_CHANGED');
  expect(await state()).toBe(saved);
  const d = await (
    await call(
      'answer',
      { round: 0, steps: dealRound(DATE, 0).solution, elapsedMs: 400000 },
      400000,
    )
  ).json<DealDay>();
  expect(d.results[0]).toMatchObject({ timeMs: 300000, skipped: false });
  await failure(await call('skip', { round: 0 }, 400000), 409, 'ROUND_ORDER');
});
it('exposes team best only for completed rounds, excluding skips and inactive users', async () => {
  await unlock();
  await sql((s) => {
    const rounds = (timeMs: number, skipped = false) => ({
      rounds: [
        { timeMs, skipped },
        { timeMs: 1, skipped: false },
      ],
      active: null,
    });
    for (const [id, time, skipped] of [
      ['u1', 2000, false],
      ['u2', 1, true],
      ['u3', 1, false],
    ] as const)
      s.sql.exec(
        'INSERT INTO game_progress VALUES (?,?,?,?,?)',
        id,
        'deal',
        DATE,
        JSON.stringify(rounds(time, skipped)),
        NOW,
      );
    s.sql.exec("UPDATE users SET active=0 WHERE id='u3'");
  });
  expect((await day()).results).toEqual([]);
  await call('start', { round: 0 });
  const d = await (
    await call('answer', { round: 0, steps: dealRound(DATE, 0).solution, elapsedMs: 5000 }, 5000)
  ).json<DealDay>();
  expect(d.results).toHaveLength(1);
  expect(d.results[0].teamBest).toEqual({ timeMs: 2000, name: 'Rower 1', me: false });
});
it('orders Deal day scores ASC and awards more weekly points for lower times', async () => {
  await unlock();
  await sql((s) => {
    for (let i = 0; i < 3; i++)
      s.sql.exec(
        'INSERT INTO game_results VALUES (?,?,?,?,?,?,?)',
        'deal',
        DATE,
        `u${i}`,
        [300, 100, 200][i],
        '{}',
        NOW,
        NOW,
      );
  });
  const board = await (await api('/games/deal/leaderboard')).json<GameDayLeaderboard>();
  expect(board.rows.map((r) => [r.user.id, r.score, r.rank])).toEqual([
    ['u1', 100, 1],
    ['u2', 200, 2],
    ['u0', 300, 3],
  ]);
  const week = await (await api('/games/leaderboard')).json<GamesWeekLeaderboard>();
  expect(week.rows.map((r) => [r.user.id, r.points, r.rank])).toEqual([
    ['u1', 3, 1],
    ['u2', 2, 2],
    ['u0', 1, 3],
  ]);
});
it('answers round five with forty users worth of team-best progress', async () => {
  await unlock();
  await sql((s) => {
    const rounds = Array.from({ length: 5 }, (_, r) => {
      const { cards, goal, parMs } = dealRound(DATE, r);
      return { cards, goal, parMs, timeMs: 10000, skipped: false };
    });
    for (let i = 0; i < 40; i++) {
      if (i >= 4)
        s.sql.exec(
          "INSERT INTO users (id,email,name,password_hash,password_salt,role,group_key,active,created_at,updated_at) VALUES (?,?,?,'unused','unused','rower','normal',1,?,?)",
          `u${i}`,
          `u${i}@example.com`,
          `Rower ${i}`,
          NOW,
          NOW,
        );
      s.sql.exec(
        'INSERT INTO game_progress VALUES (?,?,?,?,?)',
        `u${i}`,
        'deal',
        DATE,
        JSON.stringify({ rounds: i === 0 ? rounds.slice(0, 4) : rounds, active: null }),
        NOW,
      );
    }
  });
  await call('start', { round: 4 });
  const start = performance.now();
  const response = await call(
    'answer',
    { round: 4, steps: dealRound(DATE, 4).solution, elapsedMs: 10000 },
    10000,
  );
  console.log(
    `Deal round-five request with 40 users: ${(performance.now() - start).toFixed(3)} ms wall time (not isolated CPU)`,
  );
  expect(response.status).toBe(200);
  expect((await response.json<DealDay>()).done).toBe(true);
});
