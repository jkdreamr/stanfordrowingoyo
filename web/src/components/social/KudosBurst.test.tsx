// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { KudosBurst, RollingCount } from './KudosBurst';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('renders eight particles and removes them at 600ms', () => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const { container } = render(<KudosBurst />);
  expect(container.querySelectorAll('.kudos-particles i')).toHaveLength(8);
  act(() => vi.advanceTimersByTime(600));
  expect(container.querySelector('.kudos-particles')).toBeNull();
});
it('does not render particles under reduced motion', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const { container } = render(<KudosBurst />);
  expect(container.querySelector('.kudos-particles')).toBeNull();
});
it('rolls from the previous count on changes, including zero and rollback', () => {
  const view = render(<RollingCount value={0} />);
  expect(view.container.textContent).toBe('0');
  expect(view.container.querySelector('.is-changing')).toBeNull();
  view.rerender(<RollingCount value={1} />);
  expect(view.container.querySelector('.is-changing')?.getAttribute('data-previous')).toBe('0');
  expect(view.container.textContent).toBe('1');
  view.rerender(<RollingCount value={0} />);
  expect(view.container.querySelector('.is-changing')?.getAttribute('data-previous')).toBe('1');
  expect(view.container.textContent).toBe('0');
});
