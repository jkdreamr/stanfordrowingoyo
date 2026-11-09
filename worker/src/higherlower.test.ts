/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import type { Env } from './index';
import type { HigherLowerDay } from '../../shared/types';
import { sha256 } from './auth/crypto';
import { higherLowerPuzzle } from './games/higherlower';

const bindings = env as unknown as Env;
const NOW = '2026-11-16T18:00:00Z',
  DATE = '2026-11-16',
  TOKEN = 'higherlower-session';
function sql<T>(callback: (storage: DurableObjectStorage) => T | Promise<T>) {
  return runInDurableObject(bindings.TEAM.get(bindings.TEAM.idFromName('stanford')), (_, state) =>
    callback(state.storage),
  );
}
function api(path = '/today', method = 'GET', body?: unknown, now = NOW) {
  return SELF.fetch('https://oyo.test/api/games/higherlower' + path, {
    method,
    headers: {
      Cookie: `oyo_session=${TOKEN}`,
      'X-OYO-Test-Now': now,
      'X-OYO-CSRF': '1',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function view() {
  return (await (await api()).json()) as HigherLowerDay;
}
const choice = (step: number) => {
  const { chain } = higherLowerPuzzle(DATE);
  return chain[step + 1].value > chain[step].value ? 'higher' : 'lower';
};
async function unlock() {
  await sql((s) => s.sql.exec("UPDATE users SET role='coach' WHERE id='hl-user'"));
}
async function rows() {
  return sql((s) => ({
    progress: s.sql.exec("SELECT * FROM game_progress WHERE game='higherlower'").toArray(),
    results: s.sql.exec("SELECT * FROM game_results WHERE game_id='higherlower'").toArray(),
  }));
}
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
      'my_plans',
      'team_plan_slots',
    ])
      s.sql.exec(`DELETE FROM ${table}`);
    s.sql.exec(
      "INSERT INTO users (id,email,name,password_hash,password_salt,role,group_key,active,created_at,updated_at) VALUES ('hl-user','hl@example.com','HL Rower','unused','unused','rower','normal',1,?,?)",
      NOW,
      NOW,
    );
    s.sql.exec(
      'INSERT INTO sessions VALUES (?,?,?,?)',
      hash,
      'hl-user',
      '2027-12-31T00:00:00Z',
      NOW,
    );
  });
});
it('returns nothing private while locked and rejects locked guesses', async () => {
  expect(await view()).toMatchObject({
    question: null,
    higherLabel: null,
    lowerLabel: null,
    unit: null,
    asOf: null,
    items: [],
    next: null,
    results: [],
    access: { unlocked: false },
  });
  expect((await api('/guess', 'POST', { step: 0, choice: 'higher' })).status).toBe(403);
  expect(await rows()).toEqual({ progress: [], results: [] });
});
it('reveals only current values and finishes a perfect attempt exactly once', async () => {
  await unlock();
  for (let step = 0; step < 20; step++) {
    const day = await view();
    expect(day.access.reason).toBe('staff');
    expect(day.step).toBe(step);
    expect(day.items).toHaveLength(step + 1);
    expect(day.next).toEqual({
      name: higherLowerPuzzle(DATE).chain[step + 1].name,
      detail: higherLowerPuzzle(DATE).chain[step + 1].detail,
      value: null,
      display: null,
    });
    expect(day.items.every((f) => f.value !== null && f.display !== null)).toBe(true);
    const response = await api('/guess', 'POST', { step, choice: choice(step), date: DATE });
    expect(response.status).toBe(200);
  }
  expect(await view()).toMatchObject({
    step: 20,
    score: 20,
    perfect: true,
    finished: true,
    next: null,
    results: Array(20).fill(true),
  });
  expect((await view()).items).toHaveLength(21);
  expect((await rows()).results).toHaveLength(1);
  expect((await api('/guess', 'POST', { step: 13, choice: 'higher' })).status).toBe(409);
  expect((await rows()).results).toHaveLength(1);
});
it('ends on a miss, reveals the missed item only and writes one summary', async () => {
  await unlock();
  await api('/guess', 'POST', { step: 0, choice: choice(0) });
  const response = await api('/guess', 'POST', {
    step: 1,
    choice: choice(1) === 'higher' ? 'lower' : 'higher',
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    step: 1,
    score: 1,
    results: [true, false],
    finished: true,
    perfect: false,
    next: null,
  });
  const day = await view();
  expect(day.items).toHaveLength(3);
  expect(day.items[2].value).toBe(higherLowerPuzzle(DATE).chain[2].value);
  const result = (await rows()).results[0];
  expect(result.score).toBe(1);
  expect(JSON.parse(result.payload_json as string)).toMatchObject({
    results: [true, false],
    score: 1,
    rounds: 20,
    items: day.items,
  });
  expect((await api('/guess', 'POST', { step: 1, choice: choice(1) })).status).toBe(409);
  expect((await rows()).results).toHaveLength(1);
});
it('rejects skipped and replayed steps without changing progress', async () => {
  await unlock();
  expect((await api('/guess', 'POST', { step: 1, choice: 'higher' })).status).toBe(409);
  await api('/guess', 'POST', { step: 0, choice: choice(0) });
  const before = await rows();
  const response = await api('/guess', 'POST', { step: 0, choice: choice(0) });
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: { code: 'OUT_OF_ORDER' } });
  expect(await rows()).toEqual(before);
});
it('rejects stale dates before any change even while locked', async () => {
  const response = await api(
    '/guess',
    'POST',
    { step: 0, choice: 'higher', date: DATE },
    '2026-11-17T08:00:01Z',
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: { code: 'DAY_CHANGED' } });
  expect(await rows()).toEqual({ progress: [], results: [] });
});
it.each([
  {},
  null,
  [],
  { step: 0 },
  { step: 0, choice: 'equal' },
  { step: -1, choice: 'higher' },
  { step: 20, choice: 'higher' },
  { step: 0.5, choice: 'higher' },
  { step: '0', choice: 'higher' },
  { step: 0, choice: 'higher', date: 'bad' },
  { step: 0, choice: 'higher', score: 20 },
])('rejects malformed body %j without counting', async (body) => {
  await unlock();
  expect((await api('/guess', 'POST', body)).status).toBe(400);
  expect(await rows()).toEqual({ progress: [], results: [] });
});
it('disallows generic result scoring', async () => {
  await unlock();
  expect((await api('/results', 'POST', { payload: { score: 20 } })).status).toBe(405);
  expect(await rows()).toEqual({ progress: [], results: [] });
});
