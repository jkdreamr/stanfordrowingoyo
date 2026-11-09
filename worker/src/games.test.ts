/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import type { Env } from './index';
import type { Context } from './context';
import type { GameDayLeaderboard, GamesWeekLeaderboard } from '../../shared/types';
import { sha256 } from './auth/crypto';
import { byId } from './db/users';
import { migrateLegacyFixture as migrate } from './migrationFixture';
import { accountExport, removeAccount } from './db/account';
import { oyoGameAccess } from './games/access';
import { getMyPlan } from './db/myPlan';
import { GAMES } from './games/registry';
import { gameRoutes } from './routes/games';
import { errorResponse } from './http';
import * as v from './validate';

const bindings = env as unknown as Env;
const NOW = '2026-03-18T18:00:00Z';
const DATE = '2026-03-18';
const TOKEN = 'games-test-session';
let hash: string;
const handlers = gameRoutes({
  ...GAMES,
  sprint: {
    id: 'sprint',
    direction: 'lower',
    score: (payload) => ({ score: v.int(payload, 'Time', 1, 10000), payload }),
  },
  distance: {
    id: 'distance',
    direction: 'higher',
    score: (payload) => ({ score: v.int(payload, 'Distance', 0, 10000), payload }),
  },
});
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
async function call(
  handler: keyof typeof handlers,
  game = 'distance',
  query = '',
  payload: unknown = 50,
) {
  return sql(async (storage) => {
    const ctx: Context = {
      storage,
      env: bindings,
      now: new Date(NOW),
      params: { game },
      tokenHash: hash,
      request: new Request(
        'https://oyo.test/api/games' + query,
        handler === 'submit'
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ payload }),
            }
          : undefined,
      ),
    };
    let response: Response;
    try {
      response = await handlers[handler](ctx);
    } catch (error) {
      response = errorResponse(error);
    }
    return { status: response.status, body: await response.json() };
  });
}
function result(s: DurableObjectStorage, user: string, game: string, date: string, score: number) {
  s.sql.exec(
    'INSERT INTO game_results VALUES (?,?,?,?,?,?,?)',
    game,
    date,
    user,
    score,
    '{}',
    NOW,
    NOW,
  );
}
beforeEach(async () => {
  await SELF.fetch('https://oyo.test/api/health');
  hash = await sha256(TOKEN);
  await sql((s) => {
    for (const table of [
      'game_results',
      'dive_answers',
      'my_plan_sessions',
      'my_plans',
      'entries',
      'roster',
      'sessions',
      'users',
    ])
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
    s.sql.exec('INSERT INTO sessions VALUES (?,?,?,?)', hash, 'u0', '2026-05-01T00:00:00Z', NOW);
  });
});
async function rest() {
  await sql((s) =>
    s.sql
      .exec("INSERT INTO my_plans VALUES ('u0','2026-03-16','[{\"week\":1,\"day\":2}]',?)", NOW)
      .toArray(),
  );
}
it.each([
  [[], 0, 0],
  [['2026-03-18'], 1, 1],
  [['2026-03-16', '2026-03-17'], 2, 2],
  [['2026-03-14', '2026-03-15'], 0, 2],
  [['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-18'], 1, 3],
] as [string[], number, number][])('computes streak for %j', async (dates, current, best) => {
  await sql((s) => {
    for (const date of dates) {
      result(s, 'u0', 'wordguess', date, 1);
      result(s, 'u0', 'perception', date, 50);
    }
    result(s, 'u1', 'wordguess', DATE, 1);
    result(s, 'u0', 'unregistered', '2026-03-13', 1);
  });
  expect(await (await api('/games')).json()).toMatchObject({ streak: { current, best } });
});
it.each(['rower', 'coxswain', 'coach', 'admin'])(
  'returns 404 for all disabled Dive endpoints for %s without changing data',
  async (role) => {
    await sql((s) => {
      s.sql.exec('UPDATE users SET role=? WHERE id=?', role, 'u0');
      result(s, 'u0', 'dive', DATE, 100);
    });
    for (const [path, method] of [
      ['/today', 'GET'],
      ['/days/2026-03-17', 'GET'],
      ['/answers', 'POST'],
      ['/answers', 'PATCH'],
      ['/results', 'POST'],
      ['/results/me', 'GET'],
      ['/leaderboard', 'GET'],
    ]) {
      expect(
        (
          await api(
            '/games/dive' + path,
            method,
            method === 'POST' || method === 'PATCH' ? { prompt_index: 0, answer: '' } : undefined,
          )
        ).status,
      ).toBe(404);
    }
    expect(
      await sql((s) => s.sql.exec("SELECT score FROM game_results WHERE game_id='dive'").toArray()),
    ).toEqual([{ score: 100 }]);
  },
);
it('excludes existing Dive results from played today, weekly points and game streaks', async () => {
  await sql((s) => {
    result(s, 'u0', 'wordguess', '2026-03-16', 4);
    result(s, 'u0', 'dive', '2026-03-17', 100);
    result(s, 'u1', 'dive', DATE, 100);
    result(s, 'u0', 'perception', DATE, 300);
  });
  const list = await (
    await api('/games')
  ).json<{
    games: { id: string }[];
    results: { game_id: string }[];
    streak: { current: number; best: number };
  }>();
  expect(list.games.map((game) => game.id)).toEqual(['wordguess', 'perception', 'connections']);
  expect(list.results.map((row) => row.game_id)).toEqual(['perception']);
  expect(list.streak).toEqual({ current: 1, best: 1 });
  const week = (await call('week')).body as GamesWeekLeaderboard;
  expect(week.rows.map((row) => [row.user.id, row.points, row.days])).toEqual([['u0', 2, 2]]);
});
it('uses the same latest covering Fortnight rest day as My Plan, including overlap and expiry', async () => {
  await sql((s) => {
    s.sql.exec("INSERT INTO my_plans VALUES ('u0','2026-03-09','[{\"week\":2,\"day\":2}]',?)", NOW);
    s.sql.exec("INSERT INTO my_plans VALUES ('u0','2026-03-16','[]',?)", NOW);
    s.sql.exec("INSERT INTO my_plans VALUES ('u0','2026-03-23','[{\"week\":1,\"day\":2}]',?)", NOW);
    const user = byId(s, 'u0')!;
    expect(getMyPlan(s, user.id, DATE)?.start_date).toBe('2026-03-16');
    expect(oyoGameAccess(s, user, DATE).reason).toBe('locked');
    s.sql.exec(
      'UPDATE my_plans SET rest_days_json=\'[{"week":1,"day":2},{"week":2,"day":6}]\' WHERE start_date=\'2026-03-16\'',
    );
    expect(getMyPlan(s, user.id, DATE)?.rest_days).toContainEqual({ week: 1, day: 2 });
    expect(oyoGameAccess(s, user, DATE).reason).toBe('rest_day');
    s.sql.exec("DELETE FROM my_plans WHERE start_date='2026-03-23'");
    expect(getMyPlan(s, user.id, '2026-03-29')?.rest_days).toContainEqual({ week: 2, day: 6 });
    expect(oyoGameAccess(s, user, '2026-03-29').reason).toBe('rest_day');
    expect(getMyPlan(s, user.id, '2026-03-30')).toBeNull();
    expect(oyoGameAccess(s, user, '2026-03-30').reason).toBe('locked');
  });
});
it('uses the team-local gate for empty, today, yesterday, deleted workouts, rest days and every staff role', async () => {
  expect(await (await api('/games/access')).json()).toEqual({
    date: DATE,
    unlocked: false,
    reason: 'locked',
  });
  expect((await call('submit')).status).toBe(403);
  const yesterday = await api('/entries', 'POST', {
    date: '2026-03-17',
    modality: 'erg',
    zone: 'E',
    distance_m: 1000,
    title: '',
    notes: '',
    visibility: 'team',
  });
  expect(yesterday.status).toBe(201);
  expect((await (await api('/games/access')).json<{ unlocked: boolean }>()).unlocked).toBe(false);
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
  expect((await (await api('/games/access')).json<{ reason: string }>()).reason).toBe('workout');
  const entry = await workout.json<{ id: string }>();
  expect((await api(`/entries/${entry.id}`, 'DELETE')).status).toBe(204);
  expect((await call('submit')).status).toBe(403);
  await rest();
  expect((await (await api('/games/access')).json<{ reason: string }>()).reason).toBe('rest_day');
  await sql((s) => {
    expect(oyoGameAccess(s, byId(s, 'u0')!, '2026-03-19').unlocked).toBe(false);
    for (const role of ['admin', 'coach', 'coxswain'] as const)
      expect(oyoGameAccess(s, { ...byId(s, 'u0')!, role }, DATE).reason).toBe('staff');
  });
});
it('submits once, validates payload, reads own results and leaves Dive without a generic scorer', async () => {
  await rest();
  expect(await call('me')).toEqual({ status: 200, body: null });
  expect((await call('submit', 'distance', '', 'bad')).status).toBe(400);
  expect((await call('submit')).status).toBe(201);
  expect((await call('submit')).status).toBe(409);
  expect((await call('me')).body).toMatchObject({
    date: DATE,
    user_id: 'u0',
    score: 50,
    payload: 50,
  });
  expect((await call('list')).body).toMatchObject({ results: [{ game_id: 'distance' }] });
  expect((await api('/games')).status).toBe(200);
  expect((await api('/games/dive/results', 'POST', { payload: 12 })).status).toBe(404);
  expect((await api('/games/nope/results', 'POST', { payload: 12 })).status).toBe(404);
  expect((await call('day', 'constructor')).status).toBe(404);
  expect((await call('me', 'distance', '?date=2026-02-30')).status).toBe(400);
  expect((await call('day', 'distance', '?date=2026-03-19')).status).toBe(400);
});
it('enforces PLAY_FIRST, ranks ties in both directions, excludes inactive players and finalizes past boards', async () => {
  expect((await call('day')).status).toBe(403);
  await sql((s) => {
    for (const game of ['distance', 'sprint']) {
      result(s, 'u0', game, DATE, 20);
      result(s, 'u1', game, DATE, 10);
      result(s, 'u2', game, DATE, 10);
      result(s, 'u3', game, DATE, 100);
    }
    s.sql.exec("UPDATE users SET active=0 WHERE id='u3'");
  });
  const high = (await call('day')).body as GameDayLeaderboard;
  expect(high.rows.map((r) => [r.user.id, r.rank])).toEqual([
    ['u0', 1],
    ['u1', 2],
    ['u2', 2],
  ]);
  expect(high).toMatchObject({ players: 3, final: false });
  const low = (await call('day', 'sprint')).body as GameDayLeaderboard;
  expect(low.rows.map((r) => [r.user.id, r.rank])).toEqual([
    ['u1', 1],
    ['u2', 1],
    ['u0', 3],
  ]);
  expect((await call('day', 'distance', '?date=2026-03-17')).status).toBe(403);
  await sql((s) => result(s, 'u0', 'distance', '2026-03-17', 20));
  expect((await call('day', 'distance', '?date=2026-03-17')).body).toMatchObject({
    players: 1,
    final: true,
  });
  await sql((s) => {
    s.sql.exec('DELETE FROM game_results');
    s.sql.exec("UPDATE users SET role='coach' WHERE id='u0'");
  });
  expect((await call('day')).status).toBe(403);
  await sql((s) => s.sql.exec("UPDATE users SET role='coxswain' WHERE id='u0'"));
  expect((await call('day')).status).toBe(403);
  await sql((s) => result(s, 'u0', 'distance', DATE, 10));
  expect((await call('day')).status).toBe(200);
  await sql((s) => {
    s.sql.exec('DELETE FROM game_results');
    s.sql.exec("UPDATE users SET role='admin' WHERE id='u0'");
  });
  expect((await call('day')).status).toBe(200);
});
it('sums weekly placement points across games with competition ties and distinct days', async () => {
  await sql((s) => {
    result(s, 'u0', 'distance', DATE, 20);
    result(s, 'u1', 'distance', DATE, 10);
    result(s, 'u2', 'distance', DATE, 10);
    result(s, 'u0', 'sprint', DATE, 20);
    result(s, 'u1', 'sprint', DATE, 10);
    result(s, 'u2', 'sprint', DATE, 10);
    result(s, 'u0', 'distance', '2026-03-17', 5);
    result(s, 'u3', 'distance', '2026-03-15', 999);
    result(s, 'u3', 'unregistered', DATE, 999);
  });
  const board = (await call('week')).body as GamesWeekLeaderboard;
  expect(board.week_start).toBe('2026-03-16');
  expect(board.rows.map((r) => [r.user.id, r.points, r.days, r.rank])).toEqual([
    ['u0', 5, 2, 1],
    ['u1', 5, 1, 1],
    ['u2', 5, 1, 1],
  ]);
  expect((await call('week', '', '?week=2026-03-23')).status).toBe(400);
});
it('handles over 100 players and registry ids with JSON lists, not expanding SQL bindings', async () => {
  await sql((s) => {
    const registry = { ...GAMES };
    for (let i = 0; i < 125; i++) {
      const id = `player${i}`,
        game = `game${i}`;
      s.sql.exec(
        "INSERT INTO users (id,email,name,password_hash,password_salt,role,group_key,active,created_at,updated_at) VALUES (?,?,?,'unused','unused','rower','normal',1,?,?)",
        id,
        `${id}@example.com`,
        id,
        NOW,
        NOW,
      );
      registry[game] = { id: game, direction: i % 2 ? 'higher' : 'lower' };
      result(s, id, game, DATE, i);
      result(s, id, 'dive', DATE, i);
    }
    const ctx: Context = {
      storage: s,
      env: bindings,
      now: new Date(NOW),
      params: {},
      tokenHash: hash,
      request: new Request('https://oyo.test/api/games/leaderboard'),
    };
    expect(gameRoutes(registry).week(ctx).status).toBe(200);
  });
});
it('migrates v19 idempotently and exports/deletes personal game data', async () => {
  await sql((s) => {
    s.sql.exec("UPDATE settings SET value_json='15' WHERE key='schema_version'");
    migrate(s, 'team-code');
    migrate(s, 'team-code');
    expect(
      s.sql
        .exec<{ value_json: string }>("SELECT value_json FROM settings WHERE key='schema_version'")
        .one().value_json,
    ).toBe('20');
    s.sql.exec(
      'INSERT INTO game_progress VALUES (?,?,?,?,?)',
      'u0',
      'wordguess',
      DATE,
      '["crane"]',
      NOW,
    );
    result(s, 'u0', 'dive', DATE, 5);
    s.sql.exec(
      "INSERT INTO dive_answers VALUES (?,?,0,?,?,NULL,'miss',0,NULL,NULL,?)",
      DATE,
      'u0',
      'Boat',
      'boat',
      NOW,
    );
    const exported = accountExport(s, byId(s, 'u0')!, NOW);
    expect(exported.game_results).toHaveLength(1);
    expect(exported.dive_answers).toHaveLength(1);
    s.transactionSync(() => removeAccount(s, byId(s, 'u0')!));
    expect(s.sql.exec('SELECT * FROM game_results').toArray()).toHaveLength(0);
    expect(s.sql.exec('SELECT * FROM dive_answers').toArray()).toHaveLength(0);
    expect(s.sql.exec('SELECT * FROM game_progress').toArray()).toHaveLength(0);
  });
});

it('upgrades v16 to generic v17 progress without changing existing results', async () => {
  await sql((s) => {
    result(s, 'u0', 'wordguess', DATE, 6);
    s.sql.exec('DROP TABLE game_progress');
    s.sql.exec("UPDATE settings SET value_json='16' WHERE key='schema_version'");
    migrate(s, 'team-code');
    s.sql.exec('INSERT INTO game_progress VALUES (?,?,?,?,?)', 'u0', 'wordguess', DATE, '[]', NOW);
    migrate(s, 'team-code');
    expect(s.sql.exec('SELECT * FROM game_progress').toArray()).toHaveLength(1);
    expect(s.sql.exec('SELECT * FROM game_results').toArray()).toHaveLength(1);
  });
});
