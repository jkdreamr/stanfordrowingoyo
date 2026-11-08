/// <reference types="@cloudflare/vitest-plugin/types" />
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import { addDays } from '../../shared/dates';
import { divePoints, normalizeAnswer } from '../../shared/games/dive';
import type { DiveAnswerResult, DiveDay, DiveReveal, GameDayLeaderboard } from '../../shared/types';
import type { Env } from './index';
import { sha256 } from './auth/crypto';
import { DIVE_PROMPTS, divePromptsFor } from './games/divePrompts';
import { recomputeDive } from './db/dive';
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
async function submit(index: number, answer = 'Oars', user = 0) {
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
async function complete(user = 0) {
  for (let i = 0; i < 7; i++) expect((await submit(i, `Answer ${i}`, user)).status).toBe(201);
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

it('has at least 420 original unique prompts in whole seven-day blocks', () => {
  expect(DIVE_PROMPTS.length).toBeGreaterThanOrEqual(420);
  expect(DIVE_PROMPTS.length % 7).toBe(0);
  expect(new Set(DIVE_PROMPTS.map(normalizeAnswer)).size).toBe(DIVE_PROMPTS.length);
  expect(DIVE_PROMPTS.every((prompt) => /^Name (a|an) /.test(prompt))).toBe(true);
});
it('uses a deterministic date permutation without repeats over a full cycle, including wraparound', () => {
  for (const start of ['2026-01-01', '2025-12-20', '2026-07-03']) {
    const selected = Array.from({ length: DIVE_PROMPTS.length / 7 }, (_, i) =>
      divePromptsFor(addDays(start, i)),
    ).flat();
    expect(new Set(selected).size).toBe(DIVE_PROMPTS.length);
    expect(divePromptsFor(start)).toEqual(divePromptsFor(start));
    expect(divePromptsFor(start)).toEqual(divePromptsFor(addDays(start, DIVE_PROMPTS.length / 7)));
  }
});
it('does not leak prompts while locked and enforces the gate inside a write', async () => {
  const locked = await (await api()).json<DiveDay>();
  expect(locked).toMatchObject({
    date: DATE,
    access: { unlocked: false },
    prompts: [],
    answers: [],
    score: 0,
    complete: false,
    reveal: null,
  });
  const response = await submit(0);
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ error: { code: 'GAME_LOCKED' } });
  await rest();
  expect((await (await api()).json<DiveDay>()).prompts).toEqual(divePromptsFor(DATE));
  expect((await submit(0)).status).toBe(201);
  await sql((s) => s.sql.exec("DELETE FROM my_plans WHERE user_id='u0'").toArray());
  expect((await submit(1)).status).toBe(403);
  expect((await submit(0, 'Shell', 59)).status).toBe(201);
});
it('requires sequential indexes, rejects duplicates and ignores client dates', async () => {
  await rest();
  const skipped = await submit(1);
  expect(skipped.status).toBe(409);
  expect(await skipped.json()).toMatchObject({ error: { code: 'OUT_OF_ORDER' } });
  const response = await api('/answers', 'POST', {
    prompt_index: 0,
    answer: '  The Oars  ',
    date: '2020-01-01',
  });
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({
    prompt_index: 0,
    answer: 'The Oars',
    points: 100,
    tier: 'Lone Oar',
    count: 1,
    total: 1,
    hidden: false,
  });
  const duplicate = await submit(0);
  expect(duplicate.status).toBe(409);
  expect(await duplicate.json()).toMatchObject({ error: { code: 'ALREADY_ANSWERED' } });
  expect(
    await sql((s) => s.sql.exec('SELECT date,payload_json,score FROM game_results').toArray()),
  ).toEqual([{ date: DATE, payload_json: '{"answered":1}', score: 100 }]);
});
it('accepts missed answers but rejects invalid answers, indexes and control characters', async () => {
  await rest();
  for (const answer of [null, 5, 'x'.repeat(41), 'a\nb', '\ta', 'a\u0000b', 'a\u007fb'])
    expect((await api('/answers', 'POST', { prompt_index: 0, answer })).status).toBe(400);
  for (const index of [-1, 7, 0.5, '0', null])
    expect((await api('/answers', 'POST', { prompt_index: index, answer: 'hi' })).status).toBe(400);
  for (const [index, answer] of ['', '   ', '!!!'].entries()) {
    const response = await submit(index, answer);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ points: 0, tier: 'Missed', count: 0, total: 0 });
  }
});
it('recomputes earlier players live as matching and different teammates answer', async () => {
  await Promise.all([0, 1, 2, 3].map(rest));
  await submit(0, 'Oars');
  expect((await (await api()).json<DiveDay>()).score).toBe(100);
  await submit(0, 'An Oar', 1);
  expect((await (await api()).json<DiveDay>()).score).toBe(10);
  await submit(0, 'Shell', 2);
  await submit(0, 'Dock', 3);
  const current = await (await api()).json<DiveDay>();
  expect(current.answers[0]).toMatchObject({ points: 25, tier: 'Shallows', count: 2, total: 4 });
  expect(current.score).toBe(25);
  expect(current.reveal).toBeNull();
});
it('matches SQL scoring to the pure tiers across seven realistic 60-player distributions, excluding hidden and empty', async () => {
  const expected = await sql((s) => {
    for (let user = 0; user < 60; user++) {
      s.sql.exec(
        "INSERT INTO game_results VALUES ('dive',?,?,0,'{}',?,?)",
        DATE,
        `u${user}`,
        NOW,
        NOW,
      );
      for (let index = 0; index < 7; index++) {
        const slot = (user + index) % 60;
        const normalized =
          slot === 0
            ? 'one'
            : slot < 3
              ? 'two'
              : slot < 9
                ? 'six'
                : slot < 24
                  ? 'fifteen'
                  : 'thirtysix';
        s.sql.exec(
          'INSERT INTO dive_answers VALUES (?,?,?,?,?,NULL,NULL,?)',
          DATE,
          `u${user}`,
          index,
          normalized,
          normalized,
          NOW,
        );
      }
    }
    recomputeDive(s, DATE, NOW);
    return s.sql
      .exec<{ user_id: string; score: number; payload_json: string }>(
        'SELECT user_id,score,payload_json FROM game_results ORDER BY user_id',
      )
      .toArray();
  });
  for (const row of expected) {
    const user = Number(row.user_id.slice(1));
    const score = Array.from({ length: 7 }, (_, i) => {
      const slot = (user + i) % 60;
      const count = slot === 0 ? 1 : slot < 3 ? 2 : slot < 9 ? 6 : slot < 24 ? 15 : 36;
      return divePoints(count, 60).points;
    }).reduce((a, b) => a + b, 0);
    expect(row.score).toBe(score);
    expect(JSON.parse(row.payload_json)).toEqual({ answered: 7 });
  }
  await sql((s) => {
    s.sql.exec("UPDATE dive_answers SET hidden_at=? WHERE user_id='u0'", NOW);
    s.sql.exec("UPDATE dive_answers SET normalized='',answer='' WHERE user_id='u1'");
    recomputeDive(s, DATE, NOW);
  });
  expect((await (await api()).json<DiveDay>()).score).toBe(0);
  const missed = await (await api('/today', 'GET', undefined, 1)).json<DiveDay>();
  expect(missed.score).toBe(0);
  expect(missed.answers.every((answer) => answer.tier === 'Missed' && answer.total === 58)).toBe(
    true,
  );
});
it('handles a concurrent 60-player seven-prompt burst with correct partial and final results', async () => {
  await Promise.all(Array.from({ length: 59 }, (_, i) => rest(i)));
  for (let index = 0; index < 7; index++) {
    const responses = await Promise.all(
      Array.from({ length: 60 }, (_, user) =>
        submit(index, user % 3 === 0 ? 'Oar' : `Shell ${user}`, user),
      ),
    );
    expect(responses.every((response) => response.status === 201)).toBe(true);
    const rows = await sql((s) =>
      s.sql
        .exec<{ score: number; payload_json: string; user_id: string }>(
          "SELECT score,payload_json,user_id FROM game_results WHERE game_id='dive'",
        )
        .toArray(),
    );
    expect(rows).toHaveLength(60);
    for (const row of rows) {
      expect(row.score).toBe((index + 1) * (Number(row.user_id.slice(1)) % 3 === 0 ? 25 : 100));
      expect(JSON.parse(row.payload_json).answered).toBe(index + 1);
    }
  }
});
it('reveals today only after seven answers or for staff, reveals past days and marks boards final at team midnight', async () => {
  await rest();
  expect((await api('/days/' + DATE)).status).toBe(403);
  expect((await api('/days/' + DATE, 'GET', undefined, 59)).status).toBe(200);
  expect((await api('/days/2026-03-17')).status).toBe(200);
  expect((await api('/days/2026-03-19')).status).toBe(400);
  expect((await api('/days/not-a-date')).status).toBe(400);
  await complete();
  const current = await (await api()).json<DiveDay>();
  expect(current.complete).toBe(true);
  expect(current.answers.map((a) => a.prompt_index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  expect(current.reveal?.[0].groups).toEqual([
    {
      normalized: 'answer 0',
      answer: 'Answer 0',
      count: 1,
      points: 100,
      tier: 'Lone Oar',
      hidden: false,
      mine: true,
    },
  ]);
  const board = async (now: string) =>
    (
      await SELF.fetch(`https://oyo.test/api/games/dive/leaderboard?date=${DATE}`, {
        headers: { Cookie: 'oyo_session=dive-0', 'X-OYO-Test-Now': now },
      })
    ).json<GameDayLeaderboard>();
  expect((await board('2026-03-19T06:59:59Z')).final).toBe(false);
  expect((await board('2026-03-19T07:00:00Z')).final).toBe(true);
  expect((await api('/days/' + DATE, 'GET', undefined, 1, '2026-03-19T07:00:00Z')).status).toBe(
    200,
  );
});
it('moderates whole groups, audits changes, keeps hidden submissions hidden and protects other players', async () => {
  await Promise.all([0, 1, 2].map(rest));
  await complete();
  await submit(0, 'Answer 0', 1);
  const body = { date: DATE, prompt_index: 0, normalized: 'answer 0', hidden: true };
  expect((await api('/answers', 'PATCH', body)).status).toBe(403);
  const hidden = await api('/answers', 'PATCH', body, 59);
  expect(hidden.status).toBe(200);
  expect((await hidden.json<DiveReveal>()).groups[0]).toMatchObject({
    count: 2,
    hidden: true,
    points: 0,
    tier: 'Hidden',
  });
  expect((await (await api()).json<DiveDay>()).answers[0]).toMatchObject({
    hidden: true,
    points: 0,
    count: 0,
    total: 0,
  });
  expect((await (await api()).json<DiveDay>()).reveal?.[0].groups[0]).toMatchObject({
    mine: true,
    hidden: true,
    count: 1,
    answer: 'Answer 0',
  });
  const late = await (await submit(0, 'THE Answer 0', 2)).json<DiveAnswerResult>();
  expect(late).toMatchObject({ hidden: true, points: 0 });
  await sql((s) => s.sql.exec("UPDATE users SET role='coach' WHERE id='u3'").toArray());
  const staff = await (await api('/days/' + DATE, 'GET', undefined, 3)).json<DiveDay>();
  expect(staff.reveal?.[0].groups[0]).toMatchObject({ count: 3, hidden: true, mine: false });
  // A different player completing seven misses cannot see someone else's hidden text.
  await rest(4);
  for (let i = 0; i < 7; i++) await submit(i, '', 4);
  const outsider = await (await api('/today', 'GET', undefined, 4)).json<DiveDay>();
  expect(outsider.reveal?.[0].groups).toEqual([]);
  const unhidden = await api('/answers', 'PATCH', { ...body, hidden: false }, 59);
  expect(unhidden.status).toBe(200);
  expect((await (await api()).json<DiveDay>()).answers[0]).toMatchObject({
    points: 10,
    hidden: false,
    count: 3,
    total: 3,
  });
  expect(
    await sql((s) =>
      s.sql.exec('SELECT action,target,actor_id FROM audit_log ORDER BY rowid').toArray(),
    ),
  ).toEqual([
    { action: 'dive.hide', target: DATE + ':0:answer 0', actor_id: 'u59' },
    { action: 'dive.unhide', target: DATE + ':0:answer 0', actor_id: 'u59' },
  ]);
  expect(
    await sql((s) =>
      s.sql
        .exec(
          'SELECT hidden_at,hidden_by FROM dive_answers WHERE prompt_index=0 AND normalized=?',
          'answer 0',
        )
        .toArray(),
    ),
  ).toEqual(Array.from({ length: 3 }, () => ({ hidden_at: null, hidden_by: null })));
});
it('validates moderation targets and dates and requires authenticated routes', async () => {
  for (const [body, status] of [
    [{ date: DATE, prompt_index: 0, normalized: 'absent', hidden: true }, 404],
    [{ date: '2026-03-19', prompt_index: 0, normalized: 'oar', hidden: true }, 400],
    [{ date: DATE, prompt_index: 7, normalized: 'oar', hidden: true }, 400],
    [{ date: DATE, prompt_index: 0, normalized: 'OAR!', hidden: true }, 400],
    [{ date: DATE, prompt_index: 0, normalized: 'oar', hidden: 'yes' }, 400],
  ] as const)
    expect((await api('/answers', 'PATCH', body, 59)).status).toBe(status);
  for (const [path, method] of [
    ['/today', 'GET'],
    ['/days/' + DATE, 'GET'],
    ['/answers', 'POST'],
    ['/answers', 'PATCH'],
  ])
    expect(
      (
        await SELF.fetch('https://oyo.test/api/games/dive' + path, {
          method,
          headers: { 'X-OYO-CSRF': '1', 'Content-Type': 'application/json' },
          body: method === 'GET' ? undefined : '{}',
        })
      ).status,
    ).toBe(401);
});
it('exports actual Dive answers and scores and removes them with account removal', async () => {
  await rest();
  await complete();
  await sql((s) => {
    const user = byId(s, 'u0')!;
    const exported = accountExport(s, user, NOW);
    expect(exported.dive_answers).toHaveLength(7);
    expect(exported.game_results[0]).toMatchObject({
      game_id: 'dive',
      score: 700,
      payload: { answered: 7 },
    });
    expect(exported.dive_answers[0]).toMatchObject({ answer: 'Answer 0', normalized: 'answer 0' });
    removeAccount(s, user);
    expect(s.sql.exec("SELECT * FROM dive_answers WHERE user_id='u0'").toArray()).toEqual([]);
    expect(s.sql.exec("SELECT * FROM game_results WHERE user_id='u0'").toArray()).toEqual([]);
  });
});
