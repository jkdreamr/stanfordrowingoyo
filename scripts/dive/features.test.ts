import { expect, it } from 'vitest';
import { DIVE_AVAILABLE, DIVE_ENABLED } from '../../worker/src/games/features';

it('keeps Dive disabled without the test-only build override', () => {
  expect(DIVE_ENABLED).toBe(false);
  expect(DIVE_AVAILABLE).toBe(false);
});
