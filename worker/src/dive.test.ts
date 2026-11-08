/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import { normalizeAnswer } from '../../shared/games/dive';
import type { DiveAnswerResult, DiveDay, DiveReveal, GameDayLeaderboard } from '../../shared/types';
import type { Env } from './index';
import { sha256 } from './auth/crypto';
import { divePromptsFor, diveSelectionFor } from './games/divePrompts';
import { answerSet } from './games/dive/sets';
import { accountExport, removeAccount } from './db/account';
import { byId } from './db/users';

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
  for (let i = 0; i < 7; i++)
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
it('accepts unknown, empty and timeout misses while rejecting malformed writes', async () => {
  await rest();
  for (const answer of [null, 5, 'x'.repeat(41), 'a\nb', '\ta', 'a\u0000b', 'a\u007fb'])
    expect((await api('/answers', 'POST', { prompt_index: 0, answer })).status).toBe(400);
  for (const index of [-1, 7, 0.5, '0', null])
    expect((await api('/answers', 'POST', { prompt_index: index, answer: 'hi' })).status).toBe(400);
  for (const [index, answer] of [
    '',
    '   ',
    '!!!',
    'idk',
    'none',
    'zzzzzzzzzzzzzzzzzzzz',
  ].entries()) {
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
  expect((await api('/days/' + DATE, 'GET', undefined, 59)).status).toBe(200);
  const answer = (await set()).gem.answer;
  await submit(0, answer);
  await submit(0, `THE ${answer.toUpperCase()}`, 1);
  await submit(1, '  THE zzzzzy  ');
  await submit(1, 'zzzzzy!', 1);
  for (let i = 2; i < 7; i++) expect((await submit(i, (await set(i)).gem.answer)).status).toBe(201);
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
  expect((await api('/days/2026-03-17')).status).toBe(200);
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
  expect((await board(NOW)).rows[0]).toMatchObject({ rank: 1, score: 600 });
});
it('moderates display only, preserves all stored scores, hides other members, and audits hide/unhide', async () => {
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
  expect((await current()).score).toBe(700);
  expect((await current(1)).score).toBe(100);
  const unhidden = await api('/answers', 'PATCH', { ...body, hidden: false }, 59);
  expect(unhidden.status).toBe(200);
  expect((await unhidden.json<DiveReveal>()).groups[0]).toMatchObject({ count: 3, hidden: false });
  expect((await current()).score).toBe(700);
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
it('stores correct immutable running sums for a 60-player seven-prompt burst', async () => {
  await Promise.all(Array.from({ length: 59 }, (_, i) => rest(i)));
  for (let index = 0; index < 7; index++) {
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
    expect(exported.dive_answers).toHaveLength(7);
    expect(exported.dive_answers[0]).toMatchObject({
      tier: 'gem',
      points: 100,
      canonical: expect.any(String),
    });
    expect(exported.game_results[0].score).toBe(700);
    s.transactionSync(() => removeAccount(s, byId(s, 'u0')!));
    expect(s.sql.exec('SELECT * FROM dive_answers').toArray()).toHaveLength(0);
    expect(s.sql.exec('SELECT * FROM game_results').toArray()).toHaveLength(0);
  });
});
it('measures end-to-end submit wall time in the Vitest Worker pool', async () => {
  const times: number[] = [];
  for (let index = 0; index < 7; index++) {
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
