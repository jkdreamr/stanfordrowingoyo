import { expect, it, vi } from 'vitest';
import { GAMES } from '../../worker/src/games/registry';
import { route } from '../../worker/src/router';
import type { Context } from '../../worker/src/context';

vi.mock('../../worker/src/games/features', () => ({
  CROSSWORD_ENABLED: false,
  DIVE_ENABLED: false,
}));
it('omits disabled crossword from the registry and rejects every route before auth', async () => {
  expect(GAMES).not.toHaveProperty('crossword');
  for (const path of [
    'today',
    'start',
    'progress',
    'check',
    'reveal',
    'finish',
    'results',
    'results/me',
    'leaderboard',
  ]) {
    const response = await route({
      request: new Request(`https://oyo.test/api/games/crossword/${path}`),
    } as Context);
    expect(response.status).toBe(404);
  }
});
