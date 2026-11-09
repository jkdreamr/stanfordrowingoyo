import { expect, it } from 'vitest';
import { DIVE_AVAILABLE, DIVE_ENABLED } from './features';
import { GAMES } from './registry';

it('enables Dive in the Worker test build without changing the production switch', () => {
  expect(DIVE_ENABLED).toBe(false);
  expect(DIVE_AVAILABLE).toBe(true);
  expect(GAMES.dive).toMatchObject({ id: 'dive', direction: 'higher' });
});
