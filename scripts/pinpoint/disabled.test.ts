import { expect, it, vi } from 'vitest';
vi.mock('../../worker/src/games/features', () => ({
  DIVE_ENABLED: false,
  PINPOINT_ENABLED: false,
}));
import { GAMES } from '../../worker/src/games/registry';
import { route } from '../../worker/src/router';

it('hides disabled Pinpoint from the registry and rejects every API path before auth', async () => {
  expect(GAMES).not.toHaveProperty('pinpoint');
  for (const path of ['today', 'guess', 'results', 'results/me', 'leaderboard']) {
    const ctx = {
      request: new Request(`https://oyo.test/api/games/pinpoint/${path}`),
    } as Parameters<typeof route>[0];
    expect((await route(ctx)).status).toBe(404);
  }
});
