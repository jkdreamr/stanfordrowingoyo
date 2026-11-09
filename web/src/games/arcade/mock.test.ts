import { expect, it } from 'vitest';
import { createMockApi } from '../../mock/handlers';
import type { ArcadeDay, ArcadeRunStart } from '../../../../shared/types';

it('supports the arcade lifecycle, abandonment and day boards in mock mode', async () => {
  let now = new Date('2026-11-09T18:00:00Z');
  const mock = createMockApi({ now: () => now, session: 'user-1' });
  mock.state.users.find((user) => user.id === 'user-1')!.role = 'coach';
  async function request(path: string, body?: unknown) {
    return mock.handle(
      new Request(
        'https://oyo.test/api/games/chicken-crossing/' + path,
        body === undefined
          ? {}
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-OYO-CSRF': '1' },
              body: JSON.stringify(body),
            },
      ),
    );
  }
  const day = (await (await request('today')).json()) as ArcadeDay;
  expect(day.attempts_left).toBe(3);
  const start = (await (await request('runs/start', { date: day.date })).json()) as ArcadeRunStart;
  expect(start.seed).toBe(day.seed);
  const next = (await (await request('runs/start', { date: day.date })).json()) as ArcadeRunStart;
  expect(next.runs[0].status).toBe('abandoned');
  now = new Date(now.getTime() + 2000);
  const payload = {
    date: day.date,
    run: next.run,
    score: 4,
    stats: { rows: 1, coins: 1, hops: 1, duration_ms: 2000, death: 'quit' },
  };
  const bad = await request('runs/finish', { ...payload, score: 500 });
  expect(bad.status).toBe(400);
  const saved = (await (await request('runs/finish', payload)).json()) as ArcadeDay;
  expect(saved.best).toBe(4);
  expect(saved.attempts_left).toBe(1);
  expect((await request('runs/finish', payload)).status).toBe(409);
  const board = (await (await request('leaderboard')).json()) as { rows: { score: number }[] };
  expect(board.rows[0].score).toBe(4);
});
