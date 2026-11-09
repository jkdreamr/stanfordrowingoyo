/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import { DIVE_MAX_SCORE, DIVE_PROMPTS_PER_DAY, normalizeAnswer } from '../../shared/games/dive';
import type { DiveAnswerResult, DiveDay, DiveReveal, GameDayLeaderboard } from '../../shared/types';
import type { Env } from './index';
import { sha256 } from './auth/crypto';
import { divePromptsFor, diveSelectionFor } from './games/divePrompts';
import { answerSet } from './games/dive/sets';
import { accountExport, removeAccount } from './db/account';
import { byId } from './db/users';
import { matchAnswer, suggestAnswer } from './games/dive/matcher';

const bindings = env as unknown as Env;
const NOW = '2026-03-18T18:00:00Z',
  DATE = '2026-03-18';
function sql<T>(callback: (storage: DurableObjectStorage) => T | Promise<T>) {
  return runInDurableObject(bindings.TEAM.get(bindings.TEAM.idFromName('stanford')), (_, state) =>
    callback(state.storage),
  );
}
function api(path = '/today', method = 'GET', body?: unknown, user = 0, now = NOW) {
  return SELF.fetch('https://oyo.test/api/games/dive' + path, {
    method,
    headers: {
      Cookie: `oyo_session=dive-${user}`,
      'X-OYO-Test-Now': now,
      'X-OYO-CSRF': '1',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function submit(index: number, answer = '', user = 0) {
  return api('/answers', 'POST', { prompt_index: index, answer }, user);
}
async function rest(user = 0) {
  await sql((s) =>
    s.sql
      .exec(
        'INSERT INTO my_plans VALUES (?,?,?,?)',
        `u${user}`,
        '2026-03-16',
        '[{"week":1,"day":2}]',
        NOW,
      )
      .toArray(),
  );
}
async function set(index = 0) {
  return answerSet(diveSelectionFor(DATE)[index].id);
}
async function complete(user = 0, miss = false) {
  for (let i = 0; i < DIVE_PROMPTS_PER_DAY; i++)
    expect(
      (await submit(i, miss ? 'zzzzzzzzzzzzzzzzzzzz' : (await set(i)).gem.answer, user)).status,
    ).toBe(201);
}
async function current(user = 0) {
  return (await api('/today', 'GET', undefined, user)).json<DiveDay>();
}
beforeEach(async () => {
  await SELF.fetch('https://oyo.test/api/health');
  const hashes = await Promise.all(Array.from({ length: 60 }, (_, i) => sha256(`dive-${i}`)));
  await sql((s) => {
    for (const table of [
      'dive_answers',
      'dive_attempts',
      'game_results',
      'audit_log',
      'my_plan_sessions',
      'my_plans',
      'entries',
      'roster',
      'sessions',
      'users',
    ])
      s.sql.exec(`DELETE FROM ${table}`);
    for (let i = 0; i < 60; i++) {
      s.sql.exec(
        "INSERT INTO users (id,email,name,password_hash,password_salt,role,group_key,active,created_at,updated_at) VALUES (?,?,?,'unused','unused',?,'normal',1,?,?)",
        `u${i}`,
        `u${i}@example.com`,
        `Rower ${i}`,
        i === 59 ? 'coach' : 'rower',
        NOW,
        NOW,
      );
      s.sql.exec(
        'INSERT INTO sessions VALUES (?,?,?,?)',
        hashes[i],
        `u${i}`,
        '2026-05-01T00:00:00Z',
        NOW,
      );
    }
  });
});

it('keeps locked reads empty and rechecks the unchanged gate for every write', async () => {
  expect(await current()).toMatchObject({
    date: DATE,
    access: { unlocked: false },
    prompts: [],
    answers: [],
    score: 0,
    complete: false,
    reveal: null,
    result: null,
  });
  expect((await submit(0)).status).toBe(403);
  await rest();
  expect((await current()).prompts).toEqual(divePromptsFor(DATE));
  expect((await submit(0)).status).toBe(201);
  await sql((s) => s.sql.exec("DELETE FROM my_plans WHERE user_id='u0'").toArray());
  expect((await submit(1)).status).toBe(403);
  expect((await submit(0, (await set()).gem.answer, 59)).status).toBe(201);
});
it('scores the first player immediately, returning only the answered prompt reveal', async () => {
  await rest();
  const chosen = await set();
  const response = await submit(0, chosen.gem.answer);
  expect(response.status).toBe(201);
  const result = await response.json<DiveAnswerResult>();
  expect(result).toMatchObject({
    canonical: chosen.gem.answer,
    tier: 'gem',
    points: 100,
    hidden: false,
    gem: chosen.gem,
  });
  expect(result.notable).toHaveLength(5);
  expect(Object.keys(result)).not.toContain('keys');
  expect(Object.keys(result)).not.toContain('aliases');
  const day = await current();
  expect(day.answers).toEqual([result]);
  expect(day.reveal).toBeNull();
  expect(day.result).toMatchObject({ game_id: 'dive', score: 100, payload: { answered: 1 } });
  expect(day.score).toBe(100);
  expect((await current(59)).reveal).toBeNull();
  await Promise.all([1, 2].map(rest));
  await submit(0, chosen.gem.answer, 1);
  await submit(0, chosen.notable[0].answer, 2);
  expect((await current()).answers[0]).toMatchObject({
    canonical: chosen.gem.answer,
    tier: 'gem',
    points: 100,
    count: 2,
  });
  expect((await current()).score).toBe(100);
});
it('requires sequential indexes, rejects racing duplicates once, and ignores client score/date fields', async () => {
  await rest();
  expect(await (await submit(1)).json()).toMatchObject({ error: { code: 'OUT_OF_ORDER' } });
  const gem = (await set()).gem.answer;
  const responses = await Promise.all(
    [0, 1].map(() =>
      api('/answers', 'POST', {
        prompt_index: 0,
        answer: `  ${gem}  `,
        date: '2020-01-01',
        points: 9999,
        tier: 'surface',
      }),
    ),
  );
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(await responses.find((r) => r.status === 409)!.json()).toMatchObject({
    error: { code: 'ALREADY_ANSWERED' },
  });
  expect(
    await sql((s) => s.sql.exec('SELECT date,score,payload_json FROM game_results').toArray()),
  ).toEqual([{ date: DATE, score: 100, payload_json: '{"answered":1}' }]);
  expect(await sql((s) => s.sql.exec('SELECT COUNT(*) AS n FROM dive_answers').toArray())).toEqual([
    { n: 1 },
  ]);
});
it.each(['/answers', '/guesses'])('accepts 60 characters and rejects 61 on %s', async (path) => {
  await rest();
  if (path === '/guesses')
    expect((await api('/start', 'POST', { prompt_index: 0 })).status).toBe(200);
  expect((await api(path, 'POST', { prompt_index: 0, answer: 'z'.repeat(61) })).status).toBe(400);
  const response = await api(path, 'POST', { prompt_index: 0, answer: 'z'.repeat(60) });
  expect(response.status).toBe(path === '/answers' ? 201 : 200);
  expect(await response.json()).toMatchObject(
    path === '/answers'
      ? { answer: 'z'.repeat(60), tier: 'miss' }
      : { outcome: 'not_an_answer', attempts_left: 14 },
  );
});
it('accepts unknown, empty and timeout misses while rejecting malformed writes', async () => {
  await rest();
  for (const answer of [null, 5, 'x'.repeat(61), 'a\nb', '\ta', 'a\u0000b', 'a\u007fb'])
    expect((await api('/answers', 'POST', { prompt_index: 0, answer })).status).toBe(400);
  for (const index of [-1, DIVE_PROMPTS_PER_DAY, 6, 0.5, '0', null])
    expect((await api('/answers', 'POST', { prompt_index: index, answer: 'hi' })).status).toBe(400);
  for (const [index, answer] of ['', '   ', '!!!', 'idk', 'zzzzzzzzzzzzzzzzzzzz'].entries()) {
    const response = await submit(index, answer);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ canonical: null, tier: 'miss', points: 0 });
  }
  expect((await current()).score).toBe(0);
});
it('reveals team answers only on completion, groups matched aliases and normalized misses, and supplies names/only_you', async () => {
  await rest();
  await rest(1);
  expect((await api('/days/' + DATE)).status).toBe(403);
  expect((await api('/days/' + DATE, 'GET', undefined, 59)).status).toBe(403);
  const answer = (await set()).gem.answer;
  await submit(0, answer);
  await submit(0, `THE ${answer.toUpperCase()}`, 1);
  await submit(1, '  THE zzzzzy  ');
  await submit(1, 'zzzzzy!', 1);
  for (let i = 2; i < DIVE_PROMPTS_PER_DAY; i++)
    expect((await submit(i, (await set(i)).gem.answer)).status).toBe(201);
  const day = await current();
  expect(day.complete).toBe(true);
  expect(day.reveal![0].groups).toHaveLength(1);
  expect(day.reveal![0].groups[0]).toMatchObject({
    canonical: answer,
    count: 2,
    mine: true,
    only_you: false,
    teammates: expect.arrayContaining([
      { user_id: 'u0', name: 'Rower 0' },
      { user_id: 'u1', name: 'Rower 1' },
    ]),
  });
  expect(day.reveal![1].groups[0]).toMatchObject({
    canonical: null,
    normalized: 'zzzzzy',
    count: 2,
    points: 0,
  });
  expect(day.reveal![2].groups[0]).toMatchObject({ count: 1, only_you: true });
  expect((await current(1)).reveal).toBeNull();
  expect((await api('/days/2026-03-17')).status).toBe(403);
  expect((await api('/days/2026-03-19')).status).toBe(400);
  expect((await api('/days/not-a-date')).status).toBe(400);
  const board = async (now: string) =>
    (
      await SELF.fetch('https://oyo.test/api/games/dive/leaderboard?date=' + DATE, {
        headers: { Cookie: 'oyo_session=dive-0', 'X-OYO-Test-Now': now },
      })
    ).json<GameDayLeaderboard>();
  expect((await board(NOW)).final).toBe(false);
  expect((await board('2026-03-19T07:00:00Z')).final).toBe(true);
  expect((await board(NOW)).rows[0]).toMatchObject({
    rank: 1,
    score: (DIVE_PROMPTS_PER_DAY - 1) * 100,
  });
});
it('moderates display only, preserves all stored scores, hides other members, and audits hide/unhide', async () => {
  await sql((s) => s.sql.exec("UPDATE users SET role='admin' WHERE id='u59'"));
  await Promise.all([0, 1, 2, 3].map(rest));
  await complete();
  const gem = (await set()).gem.answer,
    normalized = normalizeAnswer(gem);
  await submit(0, gem, 1);
  const before = await sql((s) =>
    s.sql.exec('SELECT * FROM game_results ORDER BY user_id').toArray(),
  );
  const body = { date: DATE, prompt_index: 0, normalized, hidden: true };
  expect((await api('/answers', 'PATCH', body)).status).toBe(403);
  expect(
    (await api('/answers', 'PATCH', { ...body, normalized: 'never submitted' }, 59)).status,
  ).toBe(404);
  expect((await api('/answers', 'PATCH', { ...body, normalized: 'Invalid!' }, 59)).status).toBe(
    400,
  );
  const hidden = await api('/answers', 'PATCH', body, 59);
  expect(hidden.status).toBe(200);
  expect((await hidden.json<DiveReveal>()).groups[0]).toMatchObject({
    hidden: true,
    points: 100,
    count: 2,
  });
  expect(
    await sql((s) => s.sql.exec('SELECT * FROM game_results ORDER BY user_id').toArray()),
  ).toEqual(before);
  expect((await current()).answers[0]).toMatchObject({ hidden: true, tier: 'gem', points: 100 });
  expect((await current()).reveal![0].groups[0]).toMatchObject({
    hidden: true,
    count: 1,
    only_you: false,
    teammates: [{ user_id: 'u0', name: 'Rower 0' }],
  });
  await complete(2, true);
  expect((await current(2)).reveal![0].groups.some((g) => g.normalized === normalized)).toBe(false);
  expect(await (await submit(0, gem, 3)).json()).toMatchObject({
    hidden: true,
    points: 100,
    tier: 'gem',
  });
  expect((await current()).score).toBe(DIVE_MAX_SCORE);
  expect((await current(1)).score).toBe(100);
  const unhidden = await api('/answers', 'PATCH', { ...body, hidden: false }, 59);
  expect(unhidden.status).toBe(200);
  expect((await unhidden.json<DiveReveal>()).groups[0]).toMatchObject({ count: 3, hidden: false });
  expect((await current()).score).toBe(DIVE_MAX_SCORE);
  expect((await current(3)).score).toBe(100);
  expect(
    await sql((s) =>
      s.sql.exec('SELECT action,target,actor_id FROM audit_log ORDER BY rowid').toArray(),
    ),
  ).toEqual([
    { action: 'dive.hide', target: `${DATE}:0:${normalized}`, actor_id: 'u59' },
    { action: 'dive.unhide', target: `${DATE}:0:${normalized}`, actor_id: 'u59' },
  ]);
});
it('stores correct immutable running sums for a 60-player full-day burst', async () => {
  await Promise.all(Array.from({ length: 59 }, (_, i) => rest(i)));
  for (let index = 0; index < DIVE_PROMPTS_PER_DAY; index++) {
    const chosen = await set(index);
    const responses = await Promise.all(
      Array.from({ length: 60 }, (_, user) =>
        submit(
          index,
          user % 3 === 0 ? chosen.gem.answer : user % 3 === 1 ? chosen.notable[0].answer : '',
          user,
        ),
      ),
    );
    expect(responses.every((r) => r.status === 201)).toBe(true);
    const rows = await sql((s) =>
      s.sql
        .exec<{ score: number; payload_json: string; user_id: string }>(
          'SELECT score,payload_json,user_id FROM game_results',
        )
        .toArray(),
    );
    expect(rows).toHaveLength(60);
    for (const row of rows) {
      expect(row.score).toBe((index + 1) * [100, 10, 0][Number(row.user_id.slice(1)) % 3]);
      expect(JSON.parse(row.payload_json).answered).toBe(index + 1);
    }
  }
});
it('exports canonical/tier/points and removes Dive rows with personal game data', async () => {
  await rest();
  await complete();
  await sql((s) => {
    const exported = accountExport(s, byId(s, 'u0')!, NOW);
    expect(exported.dive_answers).toHaveLength(DIVE_PROMPTS_PER_DAY);
    expect(exported.dive_answers[0]).toMatchObject({
      tier: 'gem',
      points: 100,
      canonical: expect.any(String),
    });
    expect(exported.game_results[0].score).toBe(DIVE_MAX_SCORE);
    s.transactionSync(() => removeAccount(s, byId(s, 'u0')!));
    expect(s.sql.exec('SELECT * FROM dive_answers').toArray()).toHaveLength(0);
    expect(s.sql.exec('SELECT * FROM game_results').toArray()).toHaveLength(0);
  });
});
function at(ms: number) {
  return new Date(Date.parse(NOW) + ms).toISOString();
}
let nearMiss:
  Promise<{ typed: string; canonical: string; tier: string; points: number }> | undefined;
function candidate() {
  return (nearMiss ??= (async () => {
    const chosen = await set();
    for (const line of chosen.answers.trimEnd().split('\n')) {
      const canonical = line.slice(2),
        key = normalizeAnswer(canonical);
      if (key.length < 10 || key.length > 35) continue;
      const chars = [...key];
      for (const i of [1, key.length - 3]) [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
      const typed = chars.join('');
      if (matchAnswer(typed, chosen).canonical) continue;
      const suggestion = suggestAnswer(typed, chosen);
      if (suggestion?.canonical === canonical)
        return { typed, canonical, tier: suggestion.tier, points: suggestion.points };
    }
    throw new Error('Expected a real near-miss fixture for today’s active prompt.');
  })());
}
it('starts idempotently, resumes only the active prompt and keeps guessing until a hit', async () => {
  expect((await api('/start', 'POST', { prompt_index: 0 })).status).toBe(403);
  await rest();
  expect(await (await api('/start', 'POST', { prompt_index: 0 })).json()).toEqual({
    prompt_index: 0,
    deadline_ms_remaining: 25000,
  });
  expect(await (await api('/start', 'POST', { prompt_index: 0 }, 0, at(5000))).json()).toEqual({
    prompt_index: 0,
    deadline_ms_remaining: 20000,
  });
  expect((await current()).pending).toMatchObject({
    prompt_index: 0,
    attempts_left: 15,
    suggestion: null,
  });
  expect(
    await (await api('/guesses', 'POST', { prompt_index: 0, answer: 'zzzzzzzzzzzzzz' })).json(),
  ).toEqual({ outcome: 'not_an_answer', attempts_left: 14 });
  expect((await current()).answers).toEqual([]);
  expect((await current()).result).toBeNull();
  const hit = (await set()).gem.answer;
  const response = await api('/guesses', 'POST', { prompt_index: 0, answer: hit }, 0, at(400));
  expect(await response.json()).toMatchObject({
    outcome: 'scored',
    answer: { canonical: hit, tier: 'gem', points: 100 },
  });
  expect((await current()).pending).toBeNull();
  expect((await current()).score).toBe(100);
  expect(await (await api('/start', 'POST', { prompt_index: 0 })).json()).toMatchObject({
    error: { code: 'ALREADY_ANSWERED' },
  });
});
it('offers one stored suggestion, accepts its true score and original text, and rejects replays', async () => {
  await rest();
  const c = await candidate();
  await api('/start', 'POST', { prompt_index: 0 });
  const offered = await api('/guesses', 'POST', { prompt_index: 0, answer: c.typed });
  expect(await offered.json()).toEqual({
    outcome: 'suggestion',
    prompt_index: 0,
    deadline_ms_remaining: 25000,
    suggestion: c.canonical,
    attempts_left: 15,
  });
  const day = await current();
  expect(day.answers).toEqual([]);
  expect(day.pending?.suggestion).toBe(c.canonical);
  expect(day.reveal).toBeNull();
  expect((await current(1)).pending).toBeNull();
  const accepted = await api('/suggestion', 'POST', {
    prompt_index: 0,
    accept: true,
    answer: 'arbitrary injected answer',
  });
  expect(await accepted.json()).toMatchObject({
    outcome: 'scored',
    answer: { answer: c.typed, canonical: c.canonical, tier: c.tier, points: c.points },
  });
  expect((await current()).score).toBe(c.points);
  expect(
    await (await api('/suggestion', 'POST', { prompt_index: 0, accept: true })).json(),
  ).toMatchObject({ error: { code: 'ALREADY_ANSWERED' } });
});
it('rejects a suggestion once, never issues another, and forbids confirming absent or foreign pending state', async () => {
  await rest();
  await rest(1);
  const c = await candidate();
  await api('/start', 'POST', { prompt_index: 0 });
  expect(
    await (await api('/suggestion', 'POST', { prompt_index: 0, accept: true })).json(),
  ).toMatchObject({ error: { code: 'NO_SUGGESTION' } });
  await api('/guesses', 'POST', { prompt_index: 0, answer: c.typed });
  expect(
    await (await api('/suggestion', 'POST', { prompt_index: 1, accept: true })).json(),
  ).toMatchObject({ error: { code: 'OUT_OF_ORDER' } });
  expect(
    await (await api('/suggestion', 'POST', { prompt_index: 0, accept: true }, 1)).json(),
  ).toMatchObject({ error: { code: 'NO_SUGGESTION' } });
  expect(
    await (await api('/suggestion', 'POST', { prompt_index: 0, accept: false })).json(),
  ).toEqual({ outcome: 'not_an_answer', attempts_left: 14 });
  expect(
    await (await api('/suggestion', 'POST', { prompt_index: 0, accept: true })).json(),
  ).toMatchObject({ error: { code: 'NO_SUGGESTION' } });
  expect(
    await (await api('/guesses', 'POST', { prompt_index: 0, answer: c.typed }, 0, at(400))).json(),
  ).toEqual({ outcome: 'not_an_answer', attempts_left: 13 });
  expect((await current()).pending?.suggestion).toBeNull();
});
it('implicitly rejects pending suggestions on the next guess and cannot reuse them', async () => {
  await rest();
  const c = await candidate();
  await api('/start', 'POST', { prompt_index: 0 });
  await api('/guesses', 'POST', { prompt_index: 0, answer: c.typed });
  expect(
    await (await api('/guesses', 'POST', { prompt_index: 0, answer: c.typed }, 0, at(400))).json(),
  ).toEqual({ outcome: 'not_an_answer', attempts_left: 13 });
  expect(
    await (await api('/suggestion', 'POST', { prompt_index: 0, accept: true })).json(),
  ).toMatchObject({ error: { code: 'NO_SUGGESTION' } });
});
it.each(['/guesses', '/suggestion', '/answers'])(
  'locks a timed-out pending suggestion into a miss via %s',
  async (path) => {
    await rest();
    const c = await candidate();
    await api('/start', 'POST', { prompt_index: 0 });
    await api('/guesses', 'POST', { prompt_index: 0, answer: c.typed });
    const lateDay = await (await api('/today', 'GET', undefined, 0, at(27001))).json<DiveDay>();
    expect(lateDay.pending).toMatchObject({ deadline_ms_remaining: 0, suggestion: null });
    const response = await api(
      path,
      'POST',
      { prompt_index: 0, answer: c.canonical, accept: true },
      0,
      at(27001),
    );
    const body = await response.json();
    if (path === '/answers')
      expect(body).toMatchObject({ answer: '', canonical: null, tier: 'miss', points: 0 });
    else
      expect(body).toMatchObject({
        outcome: 'scored',
        answer: { answer: '', canonical: null, tier: 'miss', points: 0 },
      });
    expect((await current()).score).toBe(0);
    expect((await current()).answers).toHaveLength(1);
  },
);
it('allows latency grace, requires start/order, validates inputs, and gives up on empty guesses', async () => {
  await rest();
  expect(
    await (await api('/guesses', 'POST', { prompt_index: 0, answer: 'hello' })).json(),
  ).toMatchObject({ error: { code: 'NOT_STARTED' } });
  for (const path of ['/start', '/guesses', '/suggestion']) {
    expect(
      await (await api(path, 'POST', { prompt_index: 1, answer: 'hello', accept: true })).json(),
    ).toMatchObject({ error: { code: 'OUT_OF_ORDER' } });
    expect(
      (await api(path, 'POST', { prompt_index: -1, answer: 'hello', accept: true })).status,
    ).toBe(400);
  }
  await api('/start', 'POST', { prompt_index: 0 });
  for (const answer of [null, 3, 'x'.repeat(61), 'a\nb'])
    expect((await api('/guesses', 'POST', { prompt_index: 0, answer })).status).toBe(400);
  expect((await api('/suggestion', 'POST', { prompt_index: 0, accept: 'yes' })).status).toBe(400);
  const hit = (await set()).gem.answer;
  expect(
    await (await api('/guesses', 'POST', { prompt_index: 0, answer: hit }, 0, at(27000))).json(),
  ).toMatchObject({ outcome: 'scored', answer: { canonical: hit } });
  await api('/start', 'POST', { prompt_index: 1 });
  expect(
    await (await api('/guesses', 'POST', { prompt_index: 1, answer: '   ' })).json(),
  ).toMatchObject({ outcome: 'scored', answer: { answer: '', points: 0 } });
});
it('rate-limits without consuming attempts and locks a miss on the fifteenth wrong attempt', async () => {
  await rest();
  await api('/start', 'POST', { prompt_index: 0 });
  const guess = { prompt_index: 0, answer: 'zzzzzzzzzzzzzz' };
  expect(await (await api('/guesses', 'POST', guess)).json()).toEqual({
    outcome: 'not_an_answer',
    attempts_left: 14,
  });
  const fast = await api('/guesses', 'POST', guess, 0, at(399));
  expect(fast.status).toBe(429);
  expect(fast.headers.get('Retry-After')).toBe('1');
  expect(await fast.json()).toMatchObject({ error: { code: 'TOO_FAST' } });
  expect((await current()).pending?.attempts_left).toBe(14);
  for (let i = 1; i < 15; i++) {
    const response = await api('/guesses', 'POST', guess, 0, at(i * 400));
    expect(await response.json()).toMatchObject(
      i === 14
        ? { outcome: 'scored', answer: { answer: '', tier: 'miss', points: 0 } }
        : { outcome: 'not_an_answer', attempts_left: 14 - i },
    );
  }
  expect((await current()).answers).toHaveLength(1);
  expect(await sql((s) => s.sql.exec('SELECT wrong_count FROM dive_attempts').toArray())).toEqual([
    { wrong_count: 15 },
  ]);
});
it('exports and removes private attempt state with the account', async () => {
  await rest();
  await api('/start', 'POST', { prompt_index: 0 });
  await sql((s) => {
    expect(accountExport(s, byId(s, 'u0')!, NOW).dive_attempts).toMatchObject([
      { prompt_index: 0, started_at: at(0), wrong_count: 0 },
    ]);
    s.transactionSync(() => removeAccount(s, byId(s, 'u0')!));
    expect(s.sql.exec('SELECT * FROM dive_attempts').toArray()).toEqual([]);
  });
});

it('measures end-to-end submit wall time in the Vitest Worker pool', async () => {
  const times: number[] = [];
  for (let index = 0; index < DIVE_PROMPTS_PER_DAY; index++) {
    const start = performance.now();
    const response = await submit(index, '', 59);
    await response.arrayBuffer();
    times.push(performance.now() - start);
    expect(response.status).toBe(201);
  }
  console.log(
    `Dive Worker submit wall ms: first=${times[0].toFixed(3)}, mean=${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(3)}, max=${Math.max(...times).toFixed(3)} (7 sequential requests, includes HTTP/storage/reveal)`,
  );
});

it.each(['coxswain', 'coach'] as const)(
  'keeps %s spoilers and moderation locked until all prompts are answered',
  async (role) => {
    await sql((s) => s.sql.exec("UPDATE users SET role=? WHERE id='u59'", role));
    await rest();
    await complete();
    const body = {
      date: DATE,
      prompt_index: 0,
      normalized: normalizeAnswer((await set()).gem.answer),
      hidden: true,
    };
    expect((await current(59)).access).toMatchObject({ unlocked: true, reason: 'staff' });
    expect((await current(59)).reveal).toBeNull();
    expect((await api('/days/' + DATE, 'GET', undefined, 59)).status).toBe(403);
    expect((await api('/days/2026-03-17', 'GET', undefined, 59)).status).toBe(403);
    expect((await api('/answers', 'PATCH', body, 59)).status).toBe(403);
    const board = () =>
      SELF.fetch('https://oyo.test/api/games/dive/leaderboard', {
        headers: { Cookie: 'oyo_session=dive-59', 'X-OYO-Test-Now': NOW },
      });
    expect((await board()).status).toBe(403);
    await submit(0, '', 59);
    expect((await board()).status).toBe(403);
    for (let i = 1; i < DIVE_PROMPTS_PER_DAY; i++) await submit(i, '', 59);
    expect((await current(59)).reveal).not.toBeNull();
    expect((await api('/days/' + DATE, 'GET', undefined, 59)).status).toBe(200);
    expect((await board()).status).toBe(200);
    expect((await api('/answers', 'PATCH', body, 59)).status).toBe(200);
    expect((await api('/days/' + DATE, 'GET', undefined, 59, '2026-03-19T18:00:00Z')).status).toBe(
      200,
    );
    const tomorrow = '2026-03-19T18:00:00Z';
    expect((await api('/answers', 'PATCH', body, 59, tomorrow)).status).toBe(403);
    for (let i = 0; i < DIVE_PROMPTS_PER_DAY; i++)
      expect(
        (await api('/answers', 'POST', { prompt_index: i, answer: '' }, 59, tomorrow)).status,
      ).toBe(201);
    expect((await api('/answers', 'PATCH', body, 59, tomorrow)).status).toBe(200);
  },
);

it('allows admins to reveal, moderate and read current/past boards without playing', async () => {
  await sql((s) => s.sql.exec("UPDATE users SET role='admin' WHERE id='u59'"));
  await rest();
  await submit(0, (await set()).gem.answer);
  expect((await current(59)).reveal![0].groups).toHaveLength(1);
  expect((await api('/days/' + DATE, 'GET', undefined, 59)).status).toBe(200);
  expect((await api('/days/2026-03-17', 'GET', undefined, 59)).status).toBe(200);
  const response = await SELF.fetch('https://oyo.test/api/games/dive/leaderboard', {
    headers: { Cookie: 'oyo_session=dive-59', 'X-OYO-Test-Now': NOW },
  });
  expect(response.status).toBe(200);
  expect(
    (
      await api(
        '/answers',
        'PATCH',
        {
          date: DATE,
          prompt_index: 0,
          normalized: normalizeAnswer((await set()).gem.answer),
          hidden: true,
        },
        59,
      )
    ).status,
  ).toBe(200);
});
