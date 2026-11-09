import { expect, it, vi } from 'vitest';
import type { Context } from '../../worker/src/context';

vi.mock('../../worker/src/games/features', () => ({ DIVE_ENABLED: false, WORLDLE_ENABLED: false }));
import { GAMES } from '../../worker/src/games/registry';
import { route } from '../../worker/src/router';

it('excludes disabled Worldle and returns 404 for every endpoint before touching storage', async () => {
  expect(GAMES).not.toHaveProperty('worldle');
  for (const [path, method] of [
    ['today', 'GET'],
    ['guess', 'POST'],
    ['results', 'POST'],
    ['results/me', 'GET'],
    ['leaderboard', 'GET'],
  ]) {
    const response = await route({
      request: new Request('https://oyo.test/api/games/worldle/' + path, { method }),
    } as Context);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  }
});
