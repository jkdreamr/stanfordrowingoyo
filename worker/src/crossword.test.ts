/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import type { Env } from './index';
import type { CrosswordDay, GameResult } from '../../shared/types';
import { sha256 } from './auth/crypto';
import { crosswordFor, loadCrossword } from './games/crossword/puzzles';
import { CROSSWORD_DATA } from './games/crossword/data';

const bindings = env as unknown as Env;
const DATE = CROSSWORD_DATA.start;
const NOW = `${DATE}T18:00:00Z`;
const TOKEN = 'crossword-test-session';
const empty = () => Array<string>(25).fill('');
function sql<T>(fn: (storage: DurableObjectStorage) => T) {
  return runInDurableObject(bindings.TEAM.get(bindings.TEAM.idFromName('stanford')), (_, state) =>
    fn(state.storage),
  );
}
function api(path = '/today', body?: unknown, seconds = 0) {
  return SELF.fetch(`https://oyo.test/api/games/crossword${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Cookie: `oyo_session=${TOKEN}`,
      'X-OYO-CSRF': '1',
      'Content-Type': 'application/json',
      'X-OYO-Test-Now': new Date(Date.parse(NOW) + seconds * 1000).toISOString(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function post(path: string, body: unknown, seconds = 0) {
  const res = await api(path, body, seconds);
  expect(res.status).toBe(200);
  return res.json() as Promise<CrosswordDay>;
}
async function solution() {
  return crosswordFor(await loadCrossword(bindings), DATE)!.solution;
}
const start = () => post('/start', { date: DATE });
beforeEach(async () => {
  await SELF.fetch('https://oyo.test/api/health');
  const hash = await sha256(TOKEN);
  await sql((s) => {
    for (const table of ['game_results', 'game_progress', 'entries', 'sessions', 'users'])
      s.sql.exec(`DELETE FROM ${table}`);
    s.sql.exec(
      "INSERT INTO users (id,email,name,password_hash,password_salt,role,group_key,active,created_at,updated_at) VALUES ('cw','cw@example.com','Crossword','unused','unused','admin','normal',1,?,?)",
      NOW,
      NOW,
    );
    s.sql.exec('INSERT INTO sessions VALUES (?,?,?,?)', hash, 'cw', '2030-01-01T00:00:00Z', NOW);
  });
});
it('loads encrypted assets in the DO environment, caches, and cycles deterministically', async () => {
  const measurement = await sql(async () => {
    let fetches = 0;
    const assets = {
      ASSETS: {
        fetch: async (...args: Parameters<Fetcher['fetch']>) => {
          fetches++;
          return bindings.ASSETS.fetch(...args);
        },
      },
    } as Pick<Env, 'ASSETS'>;
    const before = performance.now();
    const first = await loadCrossword(assets);
    const milliseconds = performance.now() - before;
    expect(await loadCrossword(assets)).toBe(first);
    expect(fetches).toBeLessThanOrEqual(1);
    expect(crosswordFor(first, '2000-01-01')).toBeNull();
    const cycle = new Date(Date.parse(DATE) + first.length * 86400000).toISOString().slice(0, 10);
    expect(crosswordFor(first, cycle)).toBe(first[0]);
    return { milliseconds, count: first.length, fetches };
  });
  console.log(
    `Crossword first load/decode: ${measurement.milliseconds.toFixed(3)} ms; ${measurement.count} puzzles; ${measurement.fetches} fetches`,
  );
  expect((await SELF.fetch('https://oyo.test/games/crossword.dat')).status).toBe(404);
});
it('GET never starts and hides clues until idempotent start', async () => {
  for (let i = 0; i < 2; i++)
    expect(await (await api()).json()).toMatchObject({
      started: false,
      started_at: null,
      clues: [],
      solution: null,
      elapsed: 0,
    });
  const first = await start();
  expect(first.clues.length).toBeGreaterThan(0);
  expect(first.clues[0]).not.toHaveProperty('cells');
  expect(first.solution).toBeNull();
  expect((await post('/start', {}, 12)).started_at).toBe(first.started_at);
  expect(await (await api()).json()).toMatchObject({
    started: true,
    started_at: new Date(NOW).toISOString(),
  });
});
it('is unavailable before the content start without exposing or starting a puzzle', async () => {
  expect(await (await api('/today', undefined, -86400)).json()).toMatchObject({
    available: false,
    started: false,
    clues: [],
    blocks: [],
    solution: null,
  });
  expect((await api('/start', {}, -86400)).status).toBe(409);
});
it('gates rowers and supports staff', async () => {
  await sql((s) => s.sql.exec("UPDATE users SET role='rower'"));
  expect(await (await api()).json()).toMatchObject({ blocks: [], clues: [], solution: null });
  for (const path of ['/start', '/progress', '/check', '/reveal', '/finish'])
    expect((await api(path, {})).status).toBe(403);
  await sql((s) => s.sql.exec("UPDATE users SET role='coach'"));
  expect((await start()).access.reason).toBe('staff');
});
it('saves, checks, clears wrong on change, and reveals only newly incorrect cells', async () => {
  await start();
  const answer = await solution();
  const cell = answer.findIndex(Boolean);
  const cells = empty();
  cells[cell] = answer[cell] === 'Z' ? 'Q' : 'Z';
  expect((await post('/progress', { cells })).cells).toEqual(cells);
  expect(((await (await api()).json()) as CrosswordDay).cells).toEqual(cells);
  const help = { cells, scope: 'cell', cell, dir: 'across' };
  expect(await post('/check', help)).toMatchObject({
    checks: 1,
    penalty: 5,
    wrong: [cell],
    solution: null,
  });
  cells[cell] = '';
  expect((await post('/progress', { cells })).wrong).toEqual([]);
  expect(await post('/reveal', { ...help, cells })).toMatchObject({
    reveals: 1,
    penalty: 20,
    revealed: [cell],
  });
  expect(await post('/reveal', { ...help, cells })).toMatchObject({
    reveals: 1,
    penalty: 20,
    revealed: [cell],
  });
  expect((await post('/progress', { cells })).cells[cell]).toBe(answer[cell]);
  expect(await post('/check', { ...help, cells, scope: 'word' })).toMatchObject({
    checks: 2,
    penalty: 30,
  });
  expect(await post('/check', { ...help, cells, scope: 'puzzle' })).toMatchObject({
    checks: 3,
    penalty: 50,
  });
});
it('does not charge or lock already correct letters and auto-finishes on reveal', async () => {
  await start();
  const answer = await solution(),
    cell = answer.findIndex(Boolean);
  const cells = [...answer];
  cells[cell] = '';
  const state = await post('/reveal', { cells, scope: 'puzzle', cell, dir: 'down' }, 7);
  expect(state).toMatchObject({
    finished: true,
    elapsed: 7,
    penalty: 15,
    reveals: 1,
    revealed: [cell],
    solution: answer,
  });
  expect(await (await api('/results/me')).json()).toMatchObject({
    score: 22,
    payload: { seconds: 7, penalty: 15, reveals: 1 },
  });
});
it('rejects invalid and stale writes atomically, including before start', async () => {
  expect((await api('/progress', { cells: empty() })).status).toBe(409);
  expect((await api('/start', { date: '2000-01-01' })).status).toBe(409);
  expect(await (await api()).json()).toMatchObject({ started: false });
  await start();
  const before = await (await api()).json();
  for (const [path, body] of [
    ['/progress', { cells: [] }],
    ['/progress', { cells: Array(25).fill('ab') }],
    ['/check', { cells: empty(), scope: 'bogus', cell: 0, dir: 'across' }],
    ['/reveal', { cells: empty(), scope: 'cell', cell: 25, dir: 'down' }],
    ['/finish', { cells: empty(), score: 1 }],
    ['/start', { date: 4 }],
  ] as const)
    expect((await api(path, body)).status).toBe(400);
  for (const path of ['/start', '/progress', '/check', '/reveal', '/finish']) {
    const res = await api(path, { date: '2000-01-01', cells: empty() });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'DAY_CHANGED' } });
  }
  expect(await (await api()).json()).toEqual(before);
});
it.each(['progress', 'check', 'reveal'])(
  'clears incorrect after a cell edit saved by %s and on resume',
  async (action) => {
    const day = await start();
    const answer = await solution();
    const cells = answer.map((c) => (c ? (c === 'Z' ? 'Q' : 'Z') : ''));
    expect(await post('/finish', { cells })).toMatchObject({ incorrect: true });
    const cell = day.clues[0].row * 5 + day.clues[0].col;
    cells[cell] = '';
    expect(
      await post(`/${action}`, {
        cells,
        ...(action === 'progress' ? {} : { scope: 'cell', cell, dir: day.clues[0].dir }),
      }),
    ).toMatchObject({ incorrect: false });
    expect(await (await api()).json()).toMatchObject({ incorrect: false });
  },
);
it.each([0, 47, 4000])(
  'finishes only correct grids with server time (%s seconds) and rejects replay',
  async (seconds) => {
    await start();
    expect(await post('/finish', { cells: empty() })).toMatchObject({
      finished: false,
      incorrect: false,
      solution: null,
    });
    const answer = await solution();
    const wrong = answer.map((c) => (c ? (c === 'Z' ? 'Q' : 'Z') : ''));
    expect(await post('/finish', { cells: wrong })).toMatchObject({
      finished: false,
      incorrect: true,
      solution: null,
    });
    expect(await (await api()).json()).toMatchObject({ incorrect: true, solution: null });
    const done = await post('/finish', { date: DATE, cells: answer }, seconds);
    expect(done).toMatchObject({
      finished: true,
      elapsed: Math.max(1, Math.min(3599, seconds)),
      solution: answer,
    });
    const result = (await (await api('/results/me', undefined, seconds)).json()) as GameResult;
    expect(result.score).toBe(Math.max(1, Math.min(3599, seconds)));
    for (const path of ['/start', '/progress', '/check', '/reveal', '/finish'])
      expect((await api(path, { cells: answer }, seconds)).status).toBe(409);
  },
);
it('rejects generic submission', async () => {
  expect((await api('/results', { payload: { score: 1 } })).status).toBe(405);
});
