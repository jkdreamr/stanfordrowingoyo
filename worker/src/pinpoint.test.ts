/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import type { Env } from './index';
import type { PinpointDay } from '../../shared/types';
import { sha256 } from './auth/crypto';
import { pinpointPuzzleFor } from './games/pinpoint/puzzles';

const NOW = '2026-11-16T18:00:00Z',
  DATE = '2026-11-16',
  TOKEN = 'pinpoint-test-session';
const bindings = env as unknown as Env;
function sql<T>(callback: (s: DurableObjectStorage) => T | Promise<T>) {
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
const guess = (text: unknown, date = DATE) =>
  api('/games/pinpoint/guess', 'POST', { guess: text, date });
const day = async () => (await api('/games/pinpoint/today')).json<PinpointDay>();
async function unlock() {
  expect(
    (
      await api('/entries', 'POST', {
        date: DATE,
        modality: 'erg',
        zone: 'E',
        distance_m: 1000,
        title: '',
        notes: '',
        visibility: 'team',
      })
    ).status,
  ).toBe(201);
}
beforeEach(async () => {
  await SELF.fetch('https://oyo.test/api/health');
  const hash = await sha256(TOKEN);
  await sql((s) => {
    for (const table of ['game_results', 'game_progress', 'entries', 'sessions', 'users'])
      s.sql.exec(`DELETE FROM ${table}`);
    s.sql.exec(
      "INSERT INTO users (id,email,name,password_hash,password_salt,role,group_key,active,created_at,updated_at) VALUES ('u0','u0@example.com','Rower 0','unused','unused','rower','normal',1,?,?)",
      NOW,
      NOW,
    );
    s.sql.exec('INSERT INTO sessions VALUES (?,?,?,?)', hash, 'u0', '2027-05-01T00:00:00Z', NOW);
  });
});
it('returns locked shape and requires access without leaking content', async () => {
  const initial = await day();
  expect(initial).toEqual({
    date: DATE,
    access: { date: DATE, unlocked: false, reason: 'locked' },
    clues: [],
    guesses: [],
    cluesUsed: 1,
    finished: false,
    won: false,
    category: null,
  });
  const raw = JSON.stringify(initial),
    puzzle = pinpointPuzzleFor(DATE);
  for (const secret of [...puzzle.clues, puzzle.category, ...puzzle.accepted])
    expect(raw).not.toContain(secret);
  expect((await guess('ball')).status).toBe(403);
  expect((await api('/games/pinpoint/results', 'POST', { payload: {} })).status).toBe(403);
});
it('reveals only one additional clue per miss, never the category or accepted answers', async () => {
  await unlock();
  const puzzle = pinpointPuzzleFor(DATE);
  for (let i = 0; i < 5; i++) {
    const current = await day();
    expect(current.clues).toEqual(puzzle.clues.slice(0, i + 1));
    const raw = JSON.stringify(current);
    for (const secret of [...puzzle.clues.slice(i + 1), puzzle.category, ...puzzle.accepted])
      expect(raw).not.toContain(secret);
    expect((await guess(`incorrect ${i}`)).status).toBe(200);
  }
  expect(await day()).toMatchObject({
    finished: true,
    won: false,
    cluesUsed: 5,
    category: puzzle.category,
  });
  expect(await (await api('/games/pinpoint/results/me')).json()).toMatchObject({
    score: 0,
    payload: { clues: puzzle.clues, won: false, cluesUsed: 5 },
  });
  expect((await guess('ball')).status).toBe(409);
});
it.each([1, 3])('wins at clue %i and writes exactly one immutable result', async (clue) => {
  await unlock();
  for (let i = 1; i < clue; i++) expect((await guess('')).status).toBe(200);
  const replies = await Promise.all([guess('ball'), guess('ball')]);
  expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await day()).toMatchObject({
    finished: true,
    won: true,
    cluesUsed: clue,
    category: 'Words before ball',
  });
  expect(await (await api('/games/pinpoint/results/me')).json()).toMatchObject({
    score: 6 - clue,
    payload: {
      won: true,
      cluesUsed: clue,
      category: 'Words before ball',
      clues: pinpointPuzzleFor(DATE).clues,
    },
  });
  await sql((s) =>
    expect(
      s.sql.exec("SELECT * FROM game_results WHERE game_id='pinpoint'").toArray(),
    ).toHaveLength(1),
  );
  expect(await (await api('/games')).json()).toMatchObject({
    streak: { current: 1, best: 1 },
    games: expect.arrayContaining([{ id: 'pinpoint', direction: 'higher' }]),
  });
  expect(await (await api('/games/pinpoint/leaderboard')).json()).toMatchObject({
    players: 1,
    rows: [{ score: 6 - clue, rank: 1 }],
  });
  expect(await (await api('/games/leaderboard')).json()).toMatchObject({
    rows: expect.arrayContaining([
      expect.objectContaining({ user: expect.objectContaining({ id: 'u0' }) }),
    ]),
  });
});
it('counts all five skips as misses and loses on clue five', async () => {
  await unlock();
  for (let i = 0; i < 5; i++) expect((await guess('')).status).toBe(200);
  expect(await day()).toMatchObject({
    finished: true,
    won: false,
    cluesUsed: 5,
    guesses: Array.from({ length: 5 }, () => ({ text: '', correct: false })),
  });
});
it('does not count invalid or normalized duplicate guesses or stale dates', async () => {
  await unlock();
  for (const input of [null, 123, {}, 'x'.repeat(61), '!!!', '   '])
    expect((await guess(input)).status).toBe(400);
  expect((await guess('a wrong guess')).status).toBe(200);
  expect((await guess('THE WRONG GUESSES!')).status).toBe(400);
  const stale = await guess('ball', '2026-11-15');
  expect(stale.status).toBe(409);
  expect(await stale.json()).toMatchObject({ error: { code: 'DAY_CHANGED' } });
  expect(await day()).toMatchObject({
    cluesUsed: 2,
    guesses: [{ text: 'a wrong guess', correct: false }],
  });
  expect((await api('/games/pinpoint/results', 'POST', { payload: {} })).status).toBe(405);
});
it('accepts a transposition typo but not a real different category', async () => {
  await unlock();
  expect(await (await guess('words before bell')).json()).toMatchObject({
    won: false,
    finished: false,
  });
  expect(await (await guess('compound wodrs with ball')).json()).toMatchObject({
    won: true,
    finished: true,
    cluesUsed: 2,
  });
});
it.each(['coach', 'coxswain', 'admin'])('lets %s play without a workout', async (role) => {
  await sql((s) => s.sql.exec("UPDATE users SET role=? WHERE id='u0'", role));
  expect(await day()).toMatchObject({
    access: { unlocked: true, reason: 'staff' },
    clues: ['Crystal'],
  });
  expect((await guess('ball')).status).toBe(200);
});
