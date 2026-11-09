/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import type { Env } from './index';
import type { GameDayLeaderboard, GameResult, GamesToday } from '../../shared/types';
import { sha256 } from './auth/crypto';
import { dailyAnswer } from './games/wordGuess';
import { perceptionPuzzle } from './games/perception';
import { connectionsPuzzleFor } from './games/connectionsPuzzles';
import type {
  ConnectionsDay,
  PerceptionDay,
  PerceptionStart,
  PerceptionStimulus,
} from '../../shared/types';
import { PERCEPTION_ROUNDS } from '../../shared/games/perception';
import { perceptionLineup, perceptionV2Puzzle } from './games/perceptionV2';
import {
  PERCEPTION_POOL,
  PERCEPTION_FIELDS,
  perceptionExposure,
  type PerceptionRoundId,
  type PerceptionRoundAnswer,
} from '../../shared/games/perceptionV2';

const bindings = env as unknown as Env;
const NOW = '2026-03-18T18:00:00Z';
const DATE = '2026-03-18';
const TOKEN = 'games-more-session';

const v2Date = (d: number) => new Date(Date.UTC(2026, 10, 10 + d)).toISOString().slice(0, 10);
const v2At = (date: string, ms = 0) => new Date(Date.parse(`${date}T18:00:00Z`) + ms).toISOString();
function stimulusAnswer(stimulus: PerceptionStimulus): PerceptionRoundAnswer {
  if ('reactionDelayMs' in stimulus) return { reactionMs: 160 };
  if ('countDots' in stimulus) return { count: stimulus.countDots.length };
  if ('endpoints' in stimulus) {
    const [a, b] = stimulus.endpoints;
    return { bisect: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
  }
  if ('contact' in stimulus) return { contactMs: stimulus.contact.hiddenMs };
  if ('angle' in stimulus) return { angle: stimulus.angle };
  if ('shade' in stimulus) return { shade: stimulus.shade };
  return stimulus;
}
function v2Answer(date: string, round: PerceptionRoundId): PerceptionRoundAnswer {
  const p = perceptionV2Puzzle(date);
  const all = {
    ...p,
    reactionMs: 160,
    bisect: [
      (p.endpoints[0][0] + p.endpoints[1][0]) / 2,
      (p.endpoints[0][1] + p.endpoints[1][1]) / 2,
    ],
    contactMs: p.contact.hiddenMs,
  };
  const field = PERCEPTION_FIELDS[round];
  return { [field]: all[field] };
}
async function v2Unlock(date: string) {
  await sql((s) => s.sql.exec("UPDATE sessions SET expires_at='2030-01-01T00:00:00Z'"));
  expect(
    (
      await api(
        '/entries',
        'POST',
        {
          date,
          modality: 'erg',
          zone: 'E',
          distance_m: 1000,
          title: '',
          notes: '',
          visibility: 'team',
        },
        v2At(date),
      )
    ).status,
  ).toBe(201);
}

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
const submit = (game: string, payload: unknown) =>
  api(`/games/${game}/results`, 'POST', { payload, score: 999_999 });

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

it.each(['/games/perception/start', '/games/perception/answer'])(
  'rejects a stale date on %s before consuming a new-day round',
  async (path) => {
    await v2Unlock('2026-11-10');
    const response = await api(
      path,
      'POST',
      { date: '2026-11-09', round: 0, answer: { clockMs: 3300 } },
      '2026-11-10T08:00:01Z',
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: 'DAY_CHANGED' } });
    const state = await (
      await api('/games/perception/today', 'GET', undefined, '2026-11-10T08:00:02Z')
    ).json();
    expect(state).toMatchObject({ date: '2026-11-10', round: 0, scores: {}, done: false });
    expect(
      (
        await api(
          '/games/perception/start',
          'POST',
          { date: '2026-11-10', round: 0 },
          '2026-11-10T08:00:03Z',
        )
      ).status,
    ).toBe(200);
  },
);

it('rejects malformed expected dates without changing progress', async () => {
  await v2Unlock('2026-11-10');
  const response = await api(
    '/games/perception/start',
    'POST',
    { date: '', round: 0 },
    v2At('2026-11-10'),
  );
  expect(response.status).toBe(400);
  expect(
    await (await api('/games/perception/today', 'GET', undefined, v2At('2026-11-10'))).json(),
  ).toMatchObject({ round: 0, scores: {} });
});

it.each(Array.from({ length: 7 }, (_, i) => v2Date(i)))(
  'plays a complete v2 lineup on %s with an atomic immutable 500 result',
  async (date) => {
    await v2Unlock(date);
    const rounds = perceptionLineup(date);
    expect(
      await (await api('/games/perception/today', 'GET', undefined, v2At(date))).json(),
    ).toMatchObject({ rounds, round: 0, scores: {}, done: false });
    expect((await api('/games/perception/start', 'POST', { round: 1 }, v2At(date))).status).toBe(
      409,
    );
    for (let round = 0; round < 5; round++) {
      const at = v2At(date, round * 60000);
      expect(
        (
          await api(
            '/games/perception/answer',
            'POST',
            { round, answer: v2Answer(date, rounds[round]) },
            at,
          )
        ).status,
      ).toBe(409);
      const started = await api('/games/perception/start', 'POST', { round }, at);
      expect(started.status).toBe(200);
      const body = await started.json<PerceptionStart>();
      const answerFromStimulus = stimulusAnswer(body.stimulus);
      const p = perceptionV2Puzzle(date),
        id = rounds[round];
      const expected =
        id === 'angle'
          ? { angle: p.angle, rotation: p.rotation }
          : id === 'count'
            ? { countDots: p.countDots }
            : id === 'shade'
              ? { shade: p.shade, shadeBackgrounds: p.shadeBackgrounds }
              : id === 'bisect'
                ? { endpoints: p.endpoints }
                : id === 'contact'
                  ? { contact: p.contact }
                  : id === 'reaction'
                    ? { reactionDelayMs: p.reactionDelayMs }
                    : v2Answer(date, id);
      expect(body.stimulus).toEqual(expected);
      expect((await api('/games/perception/start', 'POST', { round }, at)).status).toBe(409);
      for (const answer of [{}, { wrong: 1 }, { ...answerFromStimulus, extra: 1 }])
        expect((await api('/games/perception/answer', 'POST', { round, answer }, at)).status).toBe(
          400,
        );
      const answered = await api(
        '/games/perception/answer',
        'POST',
        { round, answer: answerFromStimulus },
        v2At(date, round * 60000 + 20000),
      );
      expect(answered.status).toBe(200);
      expect(await answered.json()).toMatchObject({
        round: round + 1,
        scores: { [id]: 100 },
        done: round === 4,
      });
      expect(
        (
          await api(
            '/games/perception/answer',
            'POST',
            { round, answer: answerFromStimulus },
            v2At(date, round * 60000 + 21000),
          )
        ).status,
      ).toBe(409);
    }
    const result = await (
      await api('/games/perception/results/me', 'GET', undefined, v2At(date))
    ).json<GameResult>();
    expect(result).toMatchObject({ score: 500, payload: { rounds } });
    await api('/games/perception/today', 'GET', undefined, v2At(date));
    expect(
      await sql((s) =>
        s.sql.exec("SELECT * FROM game_results WHERE game_id='perception'").toArray(),
      ),
    ).toHaveLength(1);
  },
);

it.each(PERCEPTION_ROUNDS)(
  'scores the returned v2 %s stimulus without generator-derived answers',
  async (id) => {
    const date = Array.from({ length: 5 }, (_, i) => v2Date(i)).find((date) =>
      perceptionLineup(date).includes(id),
    )!;
    await v2Unlock(date);
    const day = await (
      await api('/games/perception/today', 'GET', undefined, v2At(date))
    ).json<PerceptionDay>();
    const round = day.rounds.indexOf(id);
    expect(round).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < round; i++) {
      expect((await api('/games/perception/start', 'POST', { round: i }, v2At(date))).status).toBe(
        200,
      );
      await api('/games/perception/today', 'GET', undefined, v2At(date));
    }
    const response = await api('/games/perception/start', 'POST', { round }, v2At(date));
    expect(response.status).toBe(200);
    const { stimulus } = await response.json<PerceptionStart>();
    const answer = stimulusAnswer(stimulus);
    if ('cells' in stimulus) expect(stimulus.cells).toHaveLength(9);
    let elapsed = 20000;
    if ('reactionDelayMs' in stimulus) {
      const rejected = await api(
        '/games/perception/answer',
        'POST',
        { round, answer },
        v2At(date, stimulus.reactionDelayMs - 1),
      );
      expect(rejected.status).toBe(400);
      expect(await rejected.text()).toContain('Timing is not plausible');
      const upperBound = await api(
        '/games/perception/answer',
        'POST',
        { round, answer: { reactionMs: 1161 } },
        v2At(date, stimulus.reactionDelayMs + 160),
      );
      expect(upperBound.status).toBe(400);
      elapsed = stimulus.reactionDelayMs + 160;
    }
    if ('clockMs' in stimulus) {
      expect(
        (
          await api(
            '/games/perception/answer',
            'POST',
            { round, answer },
            v2At(date, stimulus.clockMs - 1001),
          )
        ).status,
      ).toBe(400);
      elapsed = stimulus.clockMs;
    }
    const answered = await api(
      '/games/perception/answer',
      'POST',
      { round, answer },
      v2At(date, elapsed),
    );
    expect(answered.status).toBe(200);
    expect(await answered.json()).toMatchObject({ scores: { [id]: 100 }, round: round + 1 });
  },
);

it.each(PERCEPTION_POOL)('enforces v2 timing and abandonment for %s', async (id) => {
  const date = Array.from({ length: 30 }, (_, i) => v2Date(i)).find((d) =>
    perceptionLineup(d).includes(id),
  )!;
  await v2Unlock(date);
  const rounds = perceptionLineup(date),
    round = rounds.indexOf(id),
    p = perceptionV2Puzzle(date);
  for (let i = 0; i < round; i++) {
    expect((await api('/games/perception/start', 'POST', { round: i }, v2At(date))).status).toBe(
      200,
    );
    const day = await (
      await api('/games/perception/today', 'GET', undefined, v2At(date))
    ).json<PerceptionDay>();
    expect(day.scores[rounds[i]]).toBe(0);
  }
  expect((await api('/games/perception/start', 'POST', { round }, v2At(date))).status).toBe(200);
  const exposure = perceptionExposure(id, p);
  const min =
    id === 'contact' ? p.contact.visibleMs : id === 'reaction' ? p.reactionDelayMs : exposure;
  if (min > 0) {
    const tooEarly = await api(
      '/games/perception/answer',
      'POST',
      { round, answer: v2Answer(date, id) },
      v2At(date, min - 1),
    );
    expect(tooEarly.status).toBe(400);
    expect(await tooEarly.text()).toContain('Timing is not plausible');
  }
  if (id === 'clock' || id === 'contact' || id === 'reaction') {
    const field = PERCEPTION_FIELDS[id];
    const response = await api(
      '/games/perception/answer',
      'POST',
      { round, answer: { [field]: id === 'clock' ? 30000 : id === 'contact' ? 6000 : 3000 } },
      v2At(date, min),
    );
    expect(response.status).toBe(400);
    expect(await response.text()).toContain('Timing is not plausible');
  }
  // A resume consumes only the started round, and another read cannot skip again.
  for (let n = 0; n < 2; n++)
    expect(
      await (await api('/games/perception/today', 'GET', undefined, v2At(date, 20000))).json(),
    ).toMatchObject({ round: round + 1, scores: { [id]: 0 } });
});

it('gates v2 Perception writes without leaking any stimulus', async () => {
  const date = v2Date(7);
  await sql((s) => s.sql.exec("UPDATE sessions SET expires_at='2030-01-01T00:00:00Z'"));
  for (const action of ['start', 'answer'])
    expect(
      (await api(`/games/perception/${action}`, 'POST', { round: 0, answer: {} }, v2At(date)))
        .status,
    ).toBe(403);
  const day = await (
    await api('/games/perception/today', 'GET', undefined, v2At(date))
  ).json<PerceptionDay>();
  expect(day).toMatchObject({
    access: { unlocked: false },
    rounds: perceptionLineup(date),
    scores: {},
  });
  expect(day).not.toHaveProperty('stimulus');
});

it('registers Word Guess, Perception and Connections behind the OYO gate', async () => {
  const list = (await (await api('/games')).json()) as GamesToday;
  expect(list.games.map((g) => g.id)).toEqual([
    'pinpoint',
    'wordguess',
    'perception',
    'connections',
  ]);
  expect(list.games.every((g) => g.direction === 'higher')).toBe(true);
  expect((await submit('wordguess', { guesses: [dailyAnswer(DATE)] })).status).toBe(403);
  const day = (await (await api('/games/connections/today')).json()) as ConnectionsDay;
  expect(day.words).toEqual([]);
  expect((await api('/games/connections/guess', 'POST', { guess: [] })).status).toBe(403);
});

it('keeps Word Guess progress server-side, hides the answer and atomically awards a win', async () => {
  await unlock();
  const answer = dailyAnswer(DATE);
  const other = answer === 'crane' ? 'slate' : 'crane';
  expect(await (await api('/games/wordguess/today')).json()).toMatchObject({
    guesses: [],
    answer: null,
    done: false,
    won: false,
  });
  for (const guess of ['zzzzz', '', 'CRANE', 123, other + 'x'])
    expect((await api('/games/wordguess/guess', 'POST', { guess })).status).toBe(400);
  expect(await (await api('/games/wordguess/today')).json()).toMatchObject({ guesses: [] });
  const miss = await api('/games/wordguess/guess', 'POST', { guess: other });
  expect(miss.status).toBe(200);
  expect(await miss.json()).toMatchObject({
    guesses: [{ word: other }],
    answer: null,
    done: false,
  });
  expect(await (await api('/games/wordguess/results/me')).json()).toBeNull();
  expect(await (await api('/games/wordguess/today')).json()).toMatchObject({
    guesses: [{ word: other }],
    answer: null,
  });
  expect((await submit('wordguess', { guesses: [answer] })).status).toBe(405);
  const ok = await api('/games/wordguess/guess', 'POST', { guess: answer, score: 999999 });
  expect(ok.status).toBe(200);
  expect(await ok.json()).toMatchObject({
    done: true,
    won: true,
    answer,
    guesses: [{ word: other }, { word: answer, marks: Array(5).fill('correct') }],
  });
  const result = (await (await api('/games/wordguess/results/me')).json()) as GameResult;
  expect(result).toMatchObject({
    game_id: 'wordguess',
    date: DATE,
    score: 5,
    payload: { guesses: [other, answer], solved: true, tries: 2 },
  });
  expect((await api('/games/wordguess/guess', 'POST', { guess: answer })).status).toBe(409);
  expect((await submit('wordguess', { guesses: [answer] })).status).toBe(405);
  const board = (await (await api('/games/wordguess/leaderboard')).json()) as GameDayLeaderboard;
  expect(board.rows).toMatchObject([{ rank: 1, score: 5, me: true }]);
});

it('scores an unsolved six-guess Word Guess board as zero', async () => {
  await unlock();
  const answer = dailyAnswer(DATE);
  const guesses = ['crane', 'slate', 'pious', 'dough', 'lymph', 'twerk', 'fizzy']
    .filter((g) => g !== answer)
    .slice(0, 6);
  for (let i = 0; i < guesses.length; i++) {
    const res = await api('/games/wordguess/guess', 'POST', { guess: guesses[i] });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      done: i === 5,
      won: false,
      answer: i === 5 ? answer : null,
    });
  }
  expect((await api('/games/wordguess/guess', 'POST', { guess: answer })).status).toBe(409);
  expect(((await (await api('/games/wordguess/results/me')).json()) as GameResult).score).toBe(0);
});

it('gates Word Guess guesses and exposes only an empty locked state', async () => {
  expect(await (await api('/games/wordguess/today')).json()).toMatchObject({
    access: { unlocked: false },
    guesses: [],
    answer: null,
  });
  expect((await api('/games/wordguess/guess', 'POST', { guess: dailyAnswer(DATE) })).status).toBe(
    403,
  );
});

it('caps concurrent Word Guess guesses at six', async () => {
  await unlock();
  const guess = dailyAnswer(DATE) === 'crane' ? 'slate' : 'crane';
  const replies = await Promise.all(
    Array.from({ length: 8 }, () => api('/games/wordguess/guess', 'POST', { guess })),
  );
  expect(replies.filter((res) => res.status === 200)).toHaveLength(6);
  expect(replies.filter((res) => res.status === 409)).toHaveLength(2);
});

it('resumes legacy completed Word Guess results without progress and prevents replay', async () => {
  await unlock();
  const answer = dailyAnswer(DATE);
  await sql((s) =>
    s.sql.exec(
      'INSERT INTO game_results VALUES (?,?,?,?,?,?,?)',
      'wordguess',
      DATE,
      'u0',
      6,
      JSON.stringify({ guesses: [answer], solved: true, tries: 1 }),
      NOW,
      NOW,
    ),
  );
  expect(await (await api('/games/wordguess/today')).json()).toMatchObject({
    done: true,
    won: true,
    answer,
  });
  expect(await (await api('/games/wordguess/results/me')).json()).toMatchObject({
    payload: { answer, marks: [Array(5).fill('correct')] },
  });
  expect((await api('/games/wordguess/guess', 'POST', { guess: answer })).status).toBe(409);
});

const at = (ms: number) => new Date(Date.parse(NOW) + ms).toISOString();

it('requires ordered Perception starts, hides future targets and validates elapsed time', async () => {
  await unlock();
  expect(await (await api('/games/perception/today')).json()).toMatchObject({
    round: 0,
    scores: {},
    done: false,
  });
  expect((await api('/games/perception/start', 'POST', { round: 1 })).status).toBe(409);
  expect(
    (await api('/games/perception/answer', 'POST', { round: 0, answer: { clockMs: 100 } })).status,
  ).toBe(409);
  const start = await api('/games/perception/start', 'POST', { round: 0 });
  expect(await start.json()).toMatchObject({
    round: 0,
    stimulus: { clockMs: perceptionPuzzle(DATE).clockMs },
  });
  expect((await api('/games/perception/start', 'POST', { round: 0 })).status).toBe(409);
  expect(
    (
      await api('/games/perception/answer', 'POST', {
        round: 0,
        answer: { clockMs: perceptionPuzzle(DATE).clockMs },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await api(
        '/games/perception/answer',
        'POST',
        { round: 0, answer: { clockMs: 31000 } },
        at(10000),
      )
    ).status,
  ).toBe(400);
  const answer = await api(
    '/games/perception/answer',
    'POST',
    { round: 0, answer: { clockMs: perceptionPuzzle(DATE).clockMs } },
    at(10000),
  );
  expect(await answer.json()).toMatchObject({ round: 1, scores: { clock: 100 }, done: false });
  expect(
    (
      await api(
        '/games/perception/answer',
        'POST',
        { round: 0, answer: { clockMs: 100 } },
        at(10001),
      )
    ).status,
  ).toBe(409);
  const resumed = await (await api('/games/perception/today')).json<PerceptionDay>();
  expect(resumed).toMatchObject({ round: 1, scores: { clock: 100 } });
  expect(JSON.stringify(resumed)).not.toMatch(/clockMs|hue|cells|reactionDelay/);
  expect((await submit('perception', { answer: {} })).status).toBe(405);
  expect(await (await api('/games/perception/results/me')).json()).toBeNull();
});

it('scores all five Perception rounds and writes exactly one immutable result', async () => {
  await unlock();
  const p = perceptionPuzzle(DATE);
  const fields = ['clockMs', 'hue', 'dot', 'cells', 'reactionMs'] as const;
  const values = [p.clockMs, p.hue, p.dot, p.cells, 150];
  for (let round = 0; round < 5; round++) {
    const started = await (
      await api('/games/perception/start', 'POST', { round }, at(round * 60000))
    ).json<{ stimulus: object }>();
    expect(Object.keys(started.stimulus)).toEqual([
      round === 4 ? 'reactionDelayMs' : fields[round],
    ]);
    if (round === 4) {
      expect(
        (
          await api(
            '/games/perception/answer',
            'POST',
            { round, answer: { reactionMs: 150 } },
            at(round * 60000 + 10),
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await api(
            '/games/perception/answer',
            'POST',
            { round, answer: { reactionMs: 3000 } },
            at(round * 60000 + p.reactionDelayMs),
          )
        ).status,
      ).toBe(400);
    }
    const res = await api(
      '/games/perception/answer',
      'POST',
      { round, answer: { [fields[round]]: values[round] } },
      at(round * 60000 + 10000),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ round: round + 1, done: round === 4 });
  }
  const result = await (await api('/games/perception/results/me')).json<GameResult>();
  expect(result.score).toBe(500);
  expect((await api('/games/perception/start', 'POST', { round: 4 })).status).toBe(409);
  expect(
    (await api('/games/perception/answer', 'POST', { round: 4, answer: { reactionMs: 150 } }))
      .status,
  ).toBe(409);
  await api('/games/perception/today');
  await sql((s) =>
    expect(
      s.sql.exec("SELECT * FROM game_results WHERE game_id='perception'").toArray(),
    ).toHaveLength(1),
  );
});

it('abandons each started Perception round as zero on resume, without skipping unstarted rounds', async () => {
  await unlock();
  for (let round = 0; round < 5; round++) {
    for (let read = 0; read < 2; read++)
      expect(await (await api('/games/perception/today')).json()).toMatchObject({ round });
    expect((await api('/games/perception/start', 'POST', { round })).status).toBe(200);
    const day = await (await api('/games/perception/today')).json<PerceptionDay>();
    expect(day.round).toBe(round + 1);
    expect(Object.values(day.scores)).toEqual(Array(round + 1).fill(0));
    expect((await api('/games/perception/answer', 'POST', { round, answer: {} })).status).toBe(409);
  }
  expect(await (await api('/games/perception/results/me')).json()).toMatchObject({ score: 0 });
  expect(await (await api('/games/perception/today')).json()).toMatchObject({
    round: 5,
    done: true,
  });
});

it('gates Perception starts and answers', async () => {
  expect((await api('/games/perception/start', 'POST', { round: 0 })).status).toBe(403);
  expect(
    (await api('/games/perception/answer', 'POST', { round: 0, answer: { clockMs: 0 } })).status,
  ).toBe(403);
  expect(await (await api('/games/perception/today')).json()).toMatchObject({
    scores: {},
    access: { unlocked: false },
  });
});

it('persists Connections guesses, rejects invalid guesses without counting, and finishes once', async () => {
  await unlock();
  const puzzle = connectionsPuzzleFor(DATE),
    [a, b, c, d] = puzzle.groups.map((g) => g.words);
  const guess = (value: string[]) => api('/games/connections/guess', 'POST', { guess: value });
  const initial = await (await api('/games/connections/today')).json<ConnectionsDay>();
  expect(initial.guesses).toEqual([]);
  expect(initial.groups).toBeNull();
  expect(JSON.stringify(initial)).not.toContain(puzzle.groups[0].name);
  expect((await api('/games/connections/check', 'POST', { guesses: [a, b, c, d] })).status).toBe(
    405,
  );
  const near = [a[0], a[1], a[2], b[0]];
  expect(await (await guess(near)).json()).toMatchObject({
    outcome: 'one_away',
    mistakes: 1,
    groups: null,
  });
  expect((await guess([...near].reverse())).status).toBe(400);
  expect((await guess(['Nope', a[0], a[1], a[2]])).status).toBe(400);
  expect((await guess([a[0], a[0], a[1], a[2]])).status).toBe(400);
  expect(await (await api('/games/connections/today')).json()).toMatchObject({
    guesses: [near],
    outcomes: ['one_away'],
    mistakes: 1,
  });
  expect(await (await guess(a)).json()).toMatchObject({ solved: [puzzle.groups[0]], groups: null });
  expect((await submit('connections', { guesses: [a, b, c, d] })).status).toBe(405);
  await guess(b);
  await guess(c);
  const replies = await Promise.all([guess(d), guess(d)]);
  expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await (await api('/games/connections/today')).json()).toMatchObject({
    finished: true,
    won: true,
    groups: puzzle.groups,
    mistakes: 1,
  });
  const result = await (await api('/games/connections/results/me')).json<GameResult>();
  expect(result.score).toBe(7);
  expect((await guess(a)).status).toBe(409);
  await sql((s) =>
    expect(
      s.sql.exec("SELECT * FROM game_results WHERE game_id='connections'").toArray(),
    ).toHaveLength(1),
  );
});

it('cannot reset a lost Connections board after its groups are revealed', async () => {
  await unlock();
  const [a, b] = connectionsPuzzleFor(DATE).groups.map((g) => g.words);
  for (const guess of [
    [a[0], a[1], b[0], b[1]],
    [a[0], a[2], b[0], b[2]],
    [a[0], a[3], b[0], b[3]],
    [a[1], a[2], b[1], b[2]],
  ])
    expect((await api('/games/connections/guess', 'POST', { guess })).status).toBe(200);
  expect(await (await api('/games/connections/today')).json()).toMatchObject({
    finished: true,
    won: false,
    mistakes: 4,
  });
  expect((await api('/games/connections/guess', 'POST', { guess: a })).status).toBe(409);
  expect(
    (
      await submit('connections', {
        guesses: connectionsPuzzleFor(DATE).groups.map((g) => g.words),
      })
    ).status,
  ).toBe(405);
  expect(await (await api('/games/connections/results/me')).json()).toMatchObject({ score: 0 });
});

it.each(['coxswain', 'coach'] as const)(
  'lets %s play without OYO but not read spoilers or boards before completion',
  async (role) => {
    await sql((s) => s.sql.exec("UPDATE users SET role=? WHERE id='u0'", role));
    expect(await (await api('/games/access')).json()).toMatchObject({
      unlocked: true,
      reason: 'staff',
    });
    expect(await (await api('/games/wordguess/today')).json()).toMatchObject({
      answer: null,
      done: false,
    });
    expect(await (await api('/games/connections/today')).json()).toMatchObject({
      groups: null,
      finished: false,
    });
    expect(await (await api('/games/perception/today')).json()).toMatchObject({
      round: 0,
      scores: {},
      done: false,
    });
    for (const game of ['wordguess', 'connections', 'perception']) {
      expect((await api('/games/' + game + '/leaderboard')).status).toBe(403);
      expect((await api('/games/' + game + '/leaderboard?date=2026-03-17')).status).toBe(403);
    }
    expect((await api('/games/perception/start', 'POST', { round: 4 })).status).toBe(409);
    await api('/games/wordguess/guess', 'POST', { guess: dailyAnswer(DATE) });
    for (const group of connectionsPuzzleFor(DATE).groups)
      await api('/games/connections/guess', 'POST', { guess: group.words });
    for (let round = 0; round < 5; round++) {
      await api('/games/perception/start', 'POST', { round });
      await api('/games/perception/today');
    }
    expect(await (await api('/games/wordguess/today')).json()).toMatchObject({
      answer: dailyAnswer(DATE),
      done: true,
    });
    expect(await (await api('/games/connections/today')).json()).toMatchObject({
      finished: true,
      groups: connectionsPuzzleFor(DATE).groups,
    });
    for (const game of ['wordguess', 'connections', 'perception'])
      expect((await api('/games/' + game + '/leaderboard')).status).toBe(200);
  },
);
it('lets admins see every daily board before playing', async () => {
  await sql((s) => s.sql.exec("UPDATE users SET role='admin' WHERE id='u0'"));
  for (const game of ['wordguess', 'connections', 'perception']) {
    expect((await api('/games/' + game + '/leaderboard')).status).toBe(200);
    expect((await api('/games/' + game + '/leaderboard?date=2026-03-17')).status).toBe(200);
  }
});

it('counts authoritative completions in both streaks and recap highlights', async () => {
  await unlock();
  expect(await (await api('/games')).json()).toMatchObject({ streak: { current: 0, best: 0 } });
  expect((await api('/games/wordguess/guess', 'POST', { guess: 'zzzzz' })).status).toBe(400);
  expect(await (await api('/games')).json()).toMatchObject({ streak: { current: 0, best: 0 } });
  expect((await api('/games/wordguess/guess', 'POST', { guess: dailyAnswer(DATE) })).status).toBe(
    200,
  );
  for (const group of connectionsPuzzleFor(DATE).groups)
    expect((await api('/games/connections/guess', 'POST', { guess: group.words })).status).toBe(
      200,
    );
  expect(await (await api('/games')).json()).toMatchObject({ streak: { current: 1, best: 1 } });
  await sql((s) => s.sql.exec("UPDATE users SET role='coach' WHERE id='u0'"));
  expect(
    (
      await api(
        '/games/wordguess/guess',
        'POST',
        { guess: dailyAnswer('2026-03-22') },
        '2026-03-22T18:00:00Z',
      )
    ).status,
  ).toBe(200);
  expect(
    await (
      await api('/stats/recap?week=2026-03-16', 'GET', undefined, '2026-03-23T18:00:00Z')
    ).json(),
  ).toMatchObject({
    games: { played: 3, days: 2, best_dive: null, word_guess_solves: 2, streak: 1 },
  });
});
