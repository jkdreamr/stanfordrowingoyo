import { expect, it, vi } from 'vitest';
import { GAMES } from '../../worker/src/games/registry';
import { route } from '../../worker/src/router';
import { gameRoutes } from '../../worker/src/routes/games';
import { serverFixture } from './server-fixture.mjs';

vi.mock('../../worker/src/games/features', () => ({ DIVE_ENABLED: false, DEAL_ENABLED: false }));

it('hides disabled Deal for everyone and excludes its results, boards and streaks', async () => {
  expect(GAMES).not.toHaveProperty('deal');
  const { db, ctx } = serverFixture();
  try {
    for (const role of ['rower', 'coach', 'admin'])
      for (const method of ['GET', 'POST'])
        for (const path of [
          'today',
          'start',
          'answer',
          'skip',
          'results',
          'results/me',
          'leaderboard',
        ]) {
          db.prepare("UPDATE users SET role=? WHERE id='u0'").run(role);
          ctx.request = new globalThis.Request(`https://oyo.test/api/games/deal/${path}`, {
            method,
          });
          expect((await route(ctx)).status).toBe(404);
        }
    for (const date of ['2026-11-15', '2026-11-16'])
      db.prepare('INSERT INTO game_results VALUES (?,?,?,?,?,?,?)').run(
        'deal',
        date,
        'u0',
        10,
        '{}',
        date,
        date,
      );
    ctx.request = new globalThis.Request('https://oyo.test/api/games');
    const handlers = gameRoutes(GAMES);
    const list = await handlers.list(ctx).json();
    expect(list.games.some((g) => g.id === 'deal')).toBe(false);
    expect(list.results).toEqual([]);
    expect(list.streak).toEqual({ current: 0, best: 0 });
    expect(await handlers.week(ctx).json()).toMatchObject({ rows: [] });
  } finally {
    db.close();
  }
});
