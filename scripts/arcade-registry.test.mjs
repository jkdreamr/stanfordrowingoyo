import { expect, it } from 'vitest';
import { GAMES } from '../web/src/games/registry';
import { GAMES as SERVER_GAMES } from '../worker/src/games/registry';
import { DIVE_ENABLED } from '../worker/src/games/features';

it('has unique ids and matches enabled server registry directions', () => {
  expect(new Set(GAMES.map((game) => game.id)).size).toBe(GAMES.length);
  const enabled = GAMES.filter((game) => game.id !== 'dive' || DIVE_ENABLED);
  expect(enabled.map((game) => game.id).sort()).toEqual(Object.keys(SERVER_GAMES).sort());
  for (const game of enabled) expect(game.direction).toBe(SERVER_GAMES[game.id].direction);
  expect(GAMES.find((game) => game.id === 'chicken-crossing')?.kind).toBe('arcade');
});
