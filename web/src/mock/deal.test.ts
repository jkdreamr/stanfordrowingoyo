import { expect, it } from 'vitest';
import type { DealDay, GameResult } from '../../../shared/types';
import { replayDeal, type DealStep } from '../../../shared/games/deal';
import { createMockApi } from './handlers';

function setup(locked = false) {
  let elapsed = 0;
  const mock = createMockApi({ now: () => new Date(Date.parse('2026-11-16T18:00:00Z') + elapsed) });
  if (!locked) mock.state.users.find((u) => u.id === 'user-1')!.role = 'admin';
  else {
    mock.state.entries = [];
    mock.state.myPlans = [];
  }
  const request = (action: string, body?: unknown) =>
    mock.handle(
      new Request(
        `http://localhost/api/games/deal/${action}`,
        body === undefined
          ? {}
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            },
      ),
    );
  return {
    request,
    advance: (ms: number) => {
      elapsed += ms;
    },
    mock,
  };
}
const stepsFor = (n: number): DealStep[] => [
  { a: 0, op: '+', b: 1 },
  ...Array.from({ length: n - 2 }, (_, i) => ({ a: n + i, op: '+' as const, b: i + 2 })),
];
it('plays five artificial Deal rounds, validates replay, and stores lower-is-better tenths', async () => {
  const { request, advance, mock } = setup();
  const hub = await mock.handle(new Request('http://localhost/api/games'));
  expect(
    ((await hub.json()) as { games: { id: string; direction: string }[] }).games,
  ).toContainEqual({ id: 'deal', direction: 'lower' });
  const initial = await request('today');
  const day = (await initial.json()) as DealDay;
  expect(day.counts).toEqual([4, 5, 6, 7, 8]);
  expect(day.active).toBeNull();
  expect(day.results).toEqual([]);
  expect(JSON.stringify(day)).not.toContain('goal');
  for (let round = 0; round < 5; round++) {
    const started = await request('start', { round, date: day.date });
    expect(started.status).toBe(200);
    const active = ((await started.json()) as DealDay).active!;
    const steps = stepsFor(active.cards.length);
    expect(
      replayDeal(
        active.cards.map((c) => c.value),
        steps,
        active.goal,
      ),
    ).toEqual({ ok: true });
    advance(5000);
    const answered = await request('answer', { round, date: day.date, steps, elapsedMs: 4200 });
    expect(answered.status).toBe(200);
    const next = (await answered.json()) as DealDay;
    expect(next.round).toBe(round + 1);
    expect(next.results.at(-1)?.solution).toEqual(steps);
    expect(next.results.at(-1)?.teamBest).toBeNull();
    expect(next.results.at(-1)?.timeMs).toBe(4200);
    expect(next.active).toBeNull();
    if (round === 4) {
      expect(next.done).toBe(true);
      expect(next.totalMs).toBe(21000);
    }
  }
  const result = await mock.handle(new Request('http://localhost/api/games/deal/results/me'));
  expect(((await result.json()) as GameResult).score).toBe(210);
  expect((await request('start', { round: 4 })).status).toBe(409);
  expect((await request('results', { payload: {} })).status).toBe(405);
});
it('rejects locked writes, order errors, invalid witnesses and strict-body errors without consuming', async () => {
  const locked = setup(true);
  expect((await locked.request('start', { round: 0 })).status).toBe(403);
  const { request, advance } = setup();
  expect((await request('start', { round: 1 })).status).toBe(409);
  expect((await request('skip', { round: 0 })).status).toBe(409);
  expect((await request('start', { round: 0, date: '2026-11-15' })).status).toBe(409);
  expect((await request('start', { round: 0, extra: true })).status).toBe(400);
  await request('start', { round: 0 });
  expect((await request('start', { round: 0 })).status).toBe(409);
  expect((await request('answer', { round: 0, steps: stepsFor(4), elapsedMs: 10 })).status).toBe(
    400,
  );
  advance(5000);
  for (const fields of [
    { steps: [] },
    { steps: [{ a: 0, op: '/', b: 1 }, ...stepsFor(4).slice(1)] },
    { extra: true },
    { elapsedMs: -1 },
    { elapsedMs: '5' },
  ])
    expect(
      (await request('answer', { round: 0, steps: stepsFor(4), elapsedMs: 4200, ...fields }))
        .status,
    ).toBe(400);
  const day = (await (await request('today')).json()) as DealDay;
  expect(day.round).toBe(0);
  expect(day.results).toEqual([]);
  expect(day.active?.elapsedMs).toBe(5000);
});
it('resumes, clamps timings, applies skip penalty and caps active reads', async () => {
  const { request, advance } = setup();
  await request('start', { round: 0 });
  advance(10000);
  const first = (await (await request('today')).json()) as DealDay;
  advance(1000);
  const resumed = (await (await request('today')).json()) as DealDay;
  expect(resumed.active?.cards).toEqual(first.active?.cards);
  expect(resumed.active?.elapsedMs).toBe(11000);
  expect(resumed.round).toBe(0);
  const answered = (await (
    await request('answer', { round: 0, steps: stepsFor(4), elapsedMs: 0 })
  ).json()) as DealDay;
  expect(answered.results[0].timeMs).toBe(8500);
  await request('start', { round: 1 });
  advance(2000);
  const skipped = (await (await request('skip', { round: 1 })).json()) as DealDay;
  expect(skipped.results[1]).toMatchObject({ skipped: true, timeMs: 62000 });
  await request('start', { round: 2 });
  advance(300001);
  const capped = (await (await request('today')).json()) as DealDay;
  expect(capped.round).toBe(3);
  expect(capped.active).toBeNull();
  expect(capped.results[2]).toMatchObject({ skipped: true, timeMs: 300000 });
});
