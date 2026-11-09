/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import type { Env } from './index';
import type {
  GameDayLeaderboard,
  GameResult,
  GamesToday,
  GamesWeekLeaderboard,
  WorldleDay,
} from '../../shared/types';
import { sha256 } from './auth/crypto';
import { dailyCountry, dailyIndex, guessRow } from './games/worldle/game';
import { WORLDLE_SCHEDULE, WORLDLE_START, worldleData } from './games/worldle/data';
import { worldleNames } from '../../shared/games/worldleNames';
import { haversineKm, initialBearing, resolveCountry } from '../../shared/games/worldle';

const bindings = env as unknown as Env;
const NOW = '2026-11-16T18:00:00Z';
const DATE = '2026-11-16';
const TOKEN = 'worldle-test-session';
const country = dailyCountry(DATE);
const misses = worldleNames
  .filter((c) => c.name !== country.name)
  .slice(0, 6)
  .map((c) => c.name);

function sql<T>(callback: (s: DurableObjectStorage) => T | Promise<T>) {
  return runInDurableObject(bindings.TEAM.get(bindings.TEAM.idFromName('stanford')), (_, state) =>
    callback(state.storage),
  );
}
function api(path: string, method = 'GET', body?: unknown, now = NOW) {
  return SELF.fetch('https://oyo.test/api' + path, {
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
const guess = (value: unknown, date?: string) =>
  api('/games/worldle/guess', 'POST', { guess: value, date });
const current = async () => (await api('/games/worldle/today')).json<WorldleDay>();
const rows = () =>
  sql((s) => ({
    progress: s.sql.exec("SELECT * FROM game_progress WHERE game='worldle'").toArray(),
    results: s.sql.exec("SELECT * FROM game_results WHERE game_id='worldle'").toArray(),
  }));
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
function hidden(day: WorldleDay) {
  expect(day.answer).toBeNull();
  const text = JSON.stringify(day);
  expect(text).not.toContain(country.name);
  expect(text).not.toMatch(/"(?:lat|lon)":/);
}

beforeEach(async () => {
  await SELF.fetch('https://oyo.test/api/health');
  const hash = await sha256(TOKEN);
  await sql((s) => {
    for (const table of ['game_results', 'game_progress', 'entries', 'sessions', 'users'])
      s.sql.exec(`DELETE FROM ${table}`);
    s.sql.exec(
      "INSERT INTO users (id,email,name,password_hash,password_salt,role,group_key,active,created_at,updated_at) VALUES ('w0','worldle@example.com','Worldle Rower','unused','unused','rower','normal',1,?,?)",
      NOW,
      NOW,
    );
    s.sql.exec('INSERT INTO sessions VALUES (?,?,?,?)', hash, 'w0', '2027-01-01T00:00:00Z', NOW);
  });
});

it('locks rowers without a workout and publishes only the enabled game metadata', async () => {
  const day = await current();
  expect(day).toMatchObject({
    date: DATE,
    access: { unlocked: false, reason: 'locked' },
    shape: null,
    guesses: [],
    done: false,
    won: false,
  });
  hidden(day);
  expect((await guess(country.name)).status).toBe(403);
  expect(await rows()).toEqual({ progress: [], results: [] });
  const list = await (await api('/games')).json<GamesToday>();
  expect(list.games).toContainEqual({ id: 'worldle', direction: 'higher' });
  expect(list.results).toEqual([]);
  expect((await api('/games/worldle/results/me')).status).toBe(200);
  expect(await (await api('/games/worldle/results/me')).json()).toBeNull();
});

it('unlocks with a workout, returns the scheduled opaque id, and resumes canonical index progress', async () => {
  await unlock();
  const day = await current();
  const index = parseInt(WORLDLE_SCHEDULE.slice(0, 2), 36);
  expect(day.access).toMatchObject({ unlocked: true, reason: 'workout' });
  expect(day.shape).toBe(worldleData[index][2]);
  expect(day.shape).toMatch(/^[0-9a-f]{16}$/);
  hidden(day);
  const response = await guess('USA');
  expect(response.status).toBe(200);
  const after = await response.json<WorldleDay>();
  hidden(after);
  expect(after.guesses[0]).toMatchObject({ name: 'United States', correct: false });
  const row = after.guesses[0];
  const usa = worldleData[resolveCountry('USA')!];
  expect(row.km).toBe(Math.round(haversineKm(usa[0], usa[1], country.lat, country.lon)));
  expect(row.bearing).toBe(
    Math.round(initialBearing(usa[0], usa[1], country.lat, country.lon)) % 360,
  );
  expect(row.bearing).toBeGreaterThanOrEqual(0);
  expect(row.bearing).toBeLessThan(360);
  expect(await current()).toEqual(after);
  const stored = await sql((s) =>
    s.sql
      .exec<{ state_json: string }>("SELECT state_json FROM game_progress WHERE game='worldle'")
      .one(),
  );
  expect(JSON.parse(stored.state_json)).toEqual([resolveCountry('USA')]);
});

it('rejects unknown, empty, invalid and duplicate aliases without counting or writing results', async () => {
  await unlock();
  for (const value of ['Atlantis', '', null, 123]) {
    const response = await guess(value);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { message: 'Unknown country' } });
  }
  expect(await rows()).toEqual({ progress: [], results: [] });
  await guess('USA');
  const before = await rows();
  for (const value of ['US', 'America', 'United States of America']) {
    const response = await guess(value);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { message: 'Already guessed' } });
  }
  expect(await rows()).toEqual(before);
  expect((await current()).guesses).toHaveLength(1);
});

it('atomically wins once, persists the authoritative payload, and contributes to boards and streaks', async () => {
  await unlock();
  expect((await api('/games/worldle/leaderboard')).status).toBe(403);
  expect(
    (
      await api('/games/worldle/results', 'POST', {
        payload: { guesses: [country.name] },
        score: 999,
      })
    ).status,
  ).toBe(405);
  await guess(misses[0]);
  const responses = await Promise.all([guess(country.name), guess(country.name)]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  const done = await current();
  expect(done).toMatchObject({
    done: true,
    won: true,
    answer: { name: country.name, lat: country.lat, lon: country.lon },
  });
  expect(done.guesses.at(-1)).toEqual({
    name: country.name,
    km: 0,
    bearing: 0,
    direction: 'N',
    proximity: 100,
    correct: true,
  });
  const result = await (await api('/games/worldle/results/me')).json<GameResult>();
  expect(result).toMatchObject({
    game_id: 'worldle',
    date: DATE,
    user_id: 'w0',
    score: 5,
    payload: {
      guesses: [misses[0], country.name],
      solved: true,
      tries: 2,
      answer: country.name,
      rows: done.guesses.map(({ km, direction, proximity }) => ({ km, direction, proximity })),
    },
  });
  expect((await rows()).results).toHaveLength(1);
  const replay = await guess(misses[1]);
  expect(replay.status).toBe(409);
  expect(await replay.json()).toMatchObject({ error: { code: 'ALREADY_PLAYED' } });
  const dayBoard = await (await api('/games/worldle/leaderboard')).json<GameDayLeaderboard>();
  expect(dayBoard).toMatchObject({
    game_id: 'worldle',
    players: 1,
    rows: [{ score: 5, rank: 1, me: true }],
  });
  const weekBoard = await (await api('/games/leaderboard')).json<GamesWeekLeaderboard>();
  expect(weekBoard.rows).toMatchObject([{ points: 1, days: 1, rank: 1 }]);
  const list = await (await api('/games')).json<GamesToday>();
  expect(list).toMatchObject({
    streak: { current: 1, best: 1 },
    results: [{ game_id: 'worldle', score: 5 }],
  });
});

it('reveals only after the sixth miss and records a zero-score loss', async () => {
  await unlock();
  for (const [i, name] of misses.entries()) {
    const response = await guess(name);
    expect(response.status).toBe(200);
    const day = await response.json<WorldleDay>();
    expect(day.guesses).toHaveLength(i + 1);
    expect(day.done).toBe(i === 5);
    if (i < 5) hidden(day);
  }
  expect(await current()).toMatchObject({ done: true, won: false, answer: { name: country.name } });
  expect(await (await api('/games/worldle/results/me')).json()).toMatchObject({
    score: 0,
    payload: { guesses: misses, solved: false, tries: 6, answer: country.name },
  });
  expect((await guess(country.name)).status).toBe(409);
  expect((await rows()).results).toHaveLength(1);
});

it.each(['coxswain', 'coach', 'admin'])(
  'allows %s without a workout but hides the answer until completion',
  async (role) => {
    await sql((s) => s.sql.exec("UPDATE users SET role=? WHERE id='w0'", role));
    const day = await current();
    expect(day.access).toMatchObject({ unlocked: true, reason: 'staff' });
    expect(day.shape).toBe(country.shape);
    hidden(day);
    await guess(misses[0]);
    hidden(await current());
    expect((await guess(country.name)).status).toBe(200);
    expect(await current()).toMatchObject({
      won: true,
      done: true,
      answer: { name: country.name },
    });
  },
);

it('rejects stale dates before the access gate or any mutation, including a midnight rollover', async () => {
  let response = await guess(country.name, '2026-11-15');
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: { code: 'DAY_CHANGED' } });
  expect(await rows()).toEqual({ progress: [], results: [] });
  await unlock();
  await guess(misses[0], DATE);
  const before = await rows();
  response = await api(
    '/games/worldle/guess',
    'POST',
    { guess: country.name, date: DATE },
    '2026-11-17T09:00:00Z',
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: { code: 'DAY_CHANGED' } });
  expect(await rows()).toEqual(before);
  expect((await guess(country.name, 'not-a-date')).status).toBe(400);
  expect(await rows()).toEqual(before);
});

it('treats a stored result as final even if progress is absent', async () => {
  await unlock();
  await guess(country.name);
  await sql((s) => s.sql.exec("DELETE FROM game_progress WHERE game='worldle'"));
  expect(await current()).toMatchObject({
    done: true,
    won: true,
    answer: { name: country.name },
    guesses: [{ name: country.name, correct: true }],
  });
  expect((await guess(country.name)).status).toBe(409);
  expect((await rows()).results).toHaveLength(1);
});

it('selects cyclic dates before and after the schedule epoch with O(1) packed lookup', () => {
  expect(WORLDLE_START).toBe(DATE);
  expect(dailyIndex(DATE)).toBe(parseInt(WORLDLE_SCHEDULE.slice(0, 2), 36));
  expect(dailyIndex('2026-11-15')).toBe(parseInt(WORLDLE_SCHEDULE.slice(-2), 36));
  const wrap = new Date(Date.parse(DATE + 'T00:00:00Z') + (WORLDLE_SCHEDULE.length / 2) * 86400000)
    .toISOString()
    .slice(0, 10);
  expect(dailyIndex(wrap)).toBe(dailyIndex(DATE));
  const same = guessRow(country.index, country.index);
  expect(same).toMatchObject({ km: 0, bearing: 0, direction: 'N', proximity: 100, correct: true });
});
