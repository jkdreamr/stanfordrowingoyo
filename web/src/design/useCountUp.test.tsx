// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useCountUp } from './useCountUp';
import { Ticker } from './Ticker';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function clock(reduced = false) {
  let callback: FrameRequestCallback;
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb: FrameRequestCallback) => {
      callback = cb;
      return 1;
    }),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  return (time: number) => act(() => callback(time));
}
it('counts from zero, settles exactly, and continues from the prior value on change', () => {
  const tick = clock();
  const { result, rerender, unmount } = renderHook(({ value }) => useCountUp(value), {
    initialProps: { value: 100 },
  });
  expect(result.current).toBe(0);
  tick(0);
  tick(350);
  const halfway = result.current;
  expect(halfway).toBeGreaterThan(90);
  rerender({ value: 200 });
  tick(400);
  expect(result.current).toBe(halfway);
  tick(1100);
  expect(result.current).toBe(200);
  unmount();
  expect(cancelAnimationFrame).toHaveBeenCalled();
});
it('handles zero, negative and nonfinite inputs without an animation loop', () => {
  const tick = clock();
  const { result, rerender } = renderHook(({ value }) => useCountUp(value), {
    initialProps: { value: 0 },
  });
  tick(0);
  tick(700);
  expect(result.current).toBe(0);
  rerender({ value: -20 });
  tick(800);
  tick(1500);
  expect(result.current).toBe(-20);
  rerender({ value: NaN });
  expect(result.current).toBeNaN();
});
it('returns the final value immediately for reduced motion and exposes only final text to assistive tech', () => {
  clock(true);
  render(
    <Ticker value={48_000} format={(v) => `${Math.round(v).toLocaleString('en-US')} Meters`} />,
  );
  expect(screen.getAllByText('48,000 Meters')).toHaveLength(2);
  expect(screen.getAllByText('48,000 Meters')[1].getAttribute('aria-hidden')).toBe('true');
  expect(requestAnimationFrame).not.toHaveBeenCalled();
});
