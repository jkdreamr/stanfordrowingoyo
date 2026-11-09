// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import type { ArcadePlayProps } from '../kit/types';
import type { ChickenStats } from '../../../../../shared/games/chickenCrossing';
import { validateChickenRun } from '../../../../../shared/games/chickenCrossing';
import Play from './Play';

const loop = vi.hoisted(() => ({ update: (_dt: number, _now: number) => {}, running: false }));
vi.mock('../kit/loop', () => ({
  useGameLoop(update: typeof loop.update, _render: () => void, options: { running: boolean }) {
    loop.update = update;
    loop.running = options.running;
  },
}));
vi.mock('../kit/canvas', () => ({
  useCanvas: () => ({ ref: { current: null }, size: { w: 400, h: 800 }, ctx: () => null }),
}));
vi.mock('../kit/sfx', () => ({ sfx: { play: vi.fn(), tone: vi.fn(), noise: vi.fn() } }));
afterEach(cleanup);
let props: ArcadePlayProps<ChickenStats>;
beforeEach(() => {
  props = {
    seed: 42,
    paused: false,
    reducedMotion: false,
    sound: false,
    setScore: vi.fn(),
    onGameOver: vi.fn(),
    endRequested: false,
  };
});
it('reports a current, valid quit exactly once even while paused', () => {
  const view = render(<Play {...props} />);
  fireEvent.keyDown(window, { code: 'ArrowUp' });
  act(() => {
    for (let i = 0; i < 24; i++) loop.update(1 / 120, i);
  });
  fireEvent.keyUp(window, { code: 'ArrowUp' });
  view.rerender(<Play {...props} paused endRequested />);
  const notify = vi.mocked(props.onGameOver);
  expect(notify).toHaveBeenCalledTimes(1);
  const result = notify.mock.calls[0][0];
  expect(result.stats).toMatchObject({ death: 'quit', rows: 1, hops: 1 });
  expect(validateChickenRun(result.score, result.stats, 200)).toEqual(result.stats);
  view.rerender(<Play {...props} paused endRequested />);
  expect(notify).toHaveBeenCalledTimes(1);
});
it('plays the original death animation before reporting a natural ending', () => {
  render(<Play {...props} reducedMotion />);
  fireEvent.keyDown(window, { code: 'ArrowUp' });
  act(() => {
    for (let i = 0; i < 800; i++) loop.update(1 / 120, i);
  });
  expect(props.onGameOver).toHaveBeenCalledTimes(1);
  const result = vi.mocked(props.onGameOver).mock.calls[0][0];
  expect(result.stats.death).not.toBe('quit');
  expect(validateChickenRun(result.score, result.stats, (800 * 1000) / 120)).toEqual(result.stats);
});
