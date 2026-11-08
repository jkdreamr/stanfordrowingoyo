/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import type { Env } from './index';
import type { GameDayLeaderboard, GameResult, GamesToday } from '../../shared/types';
import { sha256 } from './auth/crypto';
import { dailyAnswer } from '../../shared/games/wordGuess';
import { perceptionPuzzle } from '../../shared/games/perception';
import { connectionsPuzzleFor } from './games/connectionsPuzzles';
import type { ConnectionsCheck, ConnectionsDay } from '../../shared/types';

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

it('registers Word Guess, Perception and Connections behind the OYO gate', async () => {
  const list = (await (await api('/games')).json()) as GamesToday;
  expect(list.games.map((g) => g.id)).toEqual(['dive', 'wordguess', 'perception', 'connections']);
  expect(list.games.every((g) => g.direction === 'higher')).toBe(true);
  expect((await submit('wordguess', { guesses: [dailyAnswer(DATE)] })).status).toBe(403);
  const day = (await (await api('/games/connections/today')).json()) as ConnectionsDay;
  expect(day.words).toEqual([]);
  expect((await api('/games/connections/check', 'POST', { guesses: [] })).status).toBe(403);
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

it('never ships Connections groups before they are solved', async () => {
  await unlock();
  const day = (await (await api('/games/connections/today')).json()) as ConnectionsDay;
  const groups = connectionsPuzzleFor(DATE).groups.map((g) => g.words);
  expect([...day.words].sort()).toEqual(groups.flat().sort());
  expect(JSON.stringify(day)).not.toContain(connectionsPuzzleFor(DATE).groups[0].name);
  const check = (guesses: string[][]) => api('/games/connections/check', 'POST', { guesses });
  const [a, b, c, d] = groups;
  const near = (await (await check([[a[0], a[1], a[2], b[0]]])).json()) as ConnectionsCheck;
  expect(near).toMatchObject({ outcome: 'one_away', mistakes: 1, solved: [], groups: null });
  const hit = (await (await check([[a[0], a[1], a[2], b[0]], a])).json()) as ConnectionsCheck;
  expect(hit).toMatchObject({ outcome: 'correct', finished: false, groups: null });
  expect(hit.solved).toEqual([{ ...connectionsPuzzleFor(DATE).groups[0] }]);
  expect((await check([a, a])).status).toBe(400);
  expect((await check([['Nope', a[0], a[1], a[2]]])).status).toBe(400);
  const done = (await (await check([a, b, c, d])).json()) as ConnectionsCheck;
  expect(done).toMatchObject({ outcome: 'correct', finished: true, won: true });
  expect(done.groups).toHaveLength(4);
});

it('re-scores the full Connections guess log and rejects forged results', async () => {
  await unlock();
  const [a, b, c, d] = connectionsPuzzleFor(DATE).groups.map((g) => g.words);
  const miss = [a[0], a[1], b[0], b[1]];
  expect((await submit('connections', { guesses: [a, b, c] })).status).toBe(400);
  expect((await submit('connections', { guesses: [a, b, c, d, miss] })).status).toBe(400);
  expect((await submit('connections', { won: true, mistakes: 0 })).status).toBe(400);
  const yesterday = connectionsPuzzleFor('2026-03-17').groups.map((g) => g.words);
  expect((await submit('connections', { guesses: yesterday })).status).toBe(400);
  const res = await submit('connections', { guesses: [miss, a, b, c, d], score: 8 });
  expect(res.status).toBe(201);
  const result = (await res.json()) as GameResult & { payload: { mistakes: number } };
  expect(result.score).toBe(7);
  expect(result.payload).toMatchObject({ mistakes: 1, won: true, solved: [0, 1, 2, 3] });
  expect((await submit('connections', { guesses: [a, b, c, d] })).status).toBe(409);
  const board = (await (await api('/games/connections/leaderboard')).json()) as GameDayLeaderboard;
  expect(board.rows).toMatchObject([{ rank: 1, score: 7, me: true }]);
});
