/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import type { Env } from './index';
import type { GameDayLeaderboard, GameResult, GamesToday } from '../../shared/types';
import { sha256 } from './auth/crypto';
import { dailyAnswer } from '../../shared/games/wordGuess';
import { perceptionPuzzle } from '../../shared/games/perception';
import { intervalMs, rateHoldRates, STROKES_PER_PIECE } from '../../shared/games/rateHold';

const bindings = env as unknown as Env;
const NOW = '2026-03-18T18:00:00Z';
const DATE = '2026-03-18';
const TOKEN = 'games-more-session';

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
const submit = (game: string, payload: unknown) =>
  api(`/games/${game}/results`, 'POST', { payload, score: 999_999 });

beforeEach(async () => {
  await SELF.fetch('https://oyo.test/api/health');
  const hash = await sha256(TOKEN);
  await sql((s) => {
    for (const table of ['game_results', 'entries', 'sessions', 'users'])
      s.sql.exec(`DELETE FROM ${table}`);
    s.sql.exec(
      "INSERT INTO users (id,email,name,password_hash,password_salt,role,group_key,active,created_at,updated_at) VALUES ('u0','u0@example.com','Rower 0','unused','unused','rower','normal',1,?,?)",
      NOW,
      NOW,
    );
    s.sql.exec('INSERT INTO sessions VALUES (?,?,?,?)', hash, 'u0', '2026-05-01T00:00:00Z', NOW);
  });
});
async function unlock() {
  const workout = await api('/entries', 'POST', {
    date: DATE,
    modality: 'erg',
    zone: 'E',
    distance_m: 1000,
    title: '',
    notes: '',
    visibility: 'team',
  });
  expect(workout.status).toBe(201);
}

it('registers Word Guess, Perception and Rate Hold behind the OYO gate', async () => {
  const list = (await (await api('/games')).json()) as GamesToday;
  expect(list.games.map((g) => g.id)).toEqual(['dive', 'wordguess', 'perception', 'ratehold']);
  expect(list.games.every((g) => g.direction === 'higher')).toBe(true);
  expect((await submit('wordguess', { guesses: [dailyAnswer(DATE)] })).status).toBe(403);
});

it('verifies Word Guess boards against the server-dated answer and ignores client scores', async () => {
  await unlock();
  const answer = dailyAnswer(DATE);
  const other = answer === 'crane' ? 'slate' : 'crane';
  expect((await submit('wordguess', { guesses: ['zzzzz'] })).status).toBe(400);
  expect((await submit('wordguess', { guesses: [other] })).status).toBe(400);
  expect(dailyAnswer('2026-03-17')).not.toBe(answer);
  expect((await submit('wordguess', { guesses: [dailyAnswer('2026-03-17')] })).status).toBe(400);
  expect((await submit('wordguess', { guesses: [answer, answer] })).status).toBe(400);
  expect((await submit('wordguess', { guesses: Array(7).fill(other) })).status).toBe(400);
  const ok = await submit('wordguess', { guesses: [other, answer] });
  expect(ok.status).toBe(201);
  const result = (await ok.json()) as GameResult;
  expect(result).toMatchObject({
    game_id: 'wordguess',
    date: DATE,
    score: 5,
    payload: { guesses: [other, answer], solved: true, tries: 2 },
  });
  expect((await submit('wordguess', { guesses: [answer] })).status).toBe(409);
  const board = (await (await api('/games/wordguess/leaderboard')).json()) as GameDayLeaderboard;
  expect(board.rows).toMatchObject([{ rank: 1, score: 5, me: true }]);
});

it('scores an unsolved six-guess Word Guess board as zero', async () => {
  await unlock();
  const answer = dailyAnswer(DATE);
  const guesses = ['crane', 'slate', 'pious', 'dough', 'lymph', 'twerk', 'fizzy']
    .filter((g) => g !== answer)
    .slice(0, 6);
  const res = await submit('wordguess', { guesses });
  expect(res.status).toBe(201);
  expect(((await res.json()) as GameResult).score).toBe(0);
});

it('re-scores Perception answers from the daily puzzle', async () => {
  await unlock();
  const p = perceptionPuzzle(DATE);
  const answer = { clockMs: p.clockMs, hue: p.hue, dot: p.dot, cells: p.cells, reactionMs: 150 };
  expect((await submit('perception', { answer: { ...answer, hue: 400 } })).status).toBe(400);
  expect((await submit('perception', { answer: { ...answer, cells: [1, 1] } })).status).toBe(400);
  expect((await submit('perception', 500)).status).toBe(400);
  const res = await submit('perception', { answer });
  expect(res.status).toBe(201);
  const result = (await res.json()) as GameResult & { payload: { scores: Record<string, number> } };
  expect(result.score).toBe(500);
  expect(result.payload.scores).toEqual({
    clock: 100,
    color: 100,
    dot: 100,
    pattern: 100,
    reaction: 100,
  });
});

it('re-scores Rate Hold taps against the daily rates', async () => {
  await unlock();
  const taps = rateHoldRates(DATE).map((rate) =>
    Array.from({ length: STROKES_PER_PIECE }, (_, i) => Math.round(1000 + i * intervalMs(rate))),
  );
  expect((await submit('ratehold', { taps: taps.slice(0, 2) })).status).toBe(400);
  expect(
    (await submit('ratehold', { taps: [[1, 2, 3, 4, 5, 6, 7, 8], ...taps.slice(1)] })).status,
  ).toBe(400);
  const res = await submit('ratehold', { taps });
  expect(res.status).toBe(201);
  const result = (await res.json()) as GameResult;
  expect(result.score).toBeGreaterThanOrEqual(99);
  expect(result.score).toBeLessThanOrEqual(100);
});
