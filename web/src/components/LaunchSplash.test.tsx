// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { LaunchSplash } from './LaunchSplash';
import { syncThemeColor } from '../lib/splash';

const auth = vi.hoisted(() => ({
  isPending: true,
  data: undefined as object | null | undefined,
  error: null as Error | null,
}));
vi.mock('../lib/queries', () => ({ useMe: () => auth }));
beforeEach(() => {
  vi.useFakeTimers();
  auth.isPending = true;
  auth.data = undefined;
  auth.error = null;
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
  document.documentElement.className = 'launching';
  document.head.innerHTML = '<meta name="theme-color"><meta name="theme-color" media="dark">';
  document.body.innerHTML = `<div id="launch-splash" data-started="${performance.now()}"><img></div><div id="root" inert></div>`;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.documentElement.className = '';
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});
const splash = () => document.getElementById('launch-splash');
async function advance(ms: number) {
  await act(async () => vi.advanceTimersByTimeAsync(ms));
}
function settle(rerender: ReturnType<typeof render>['rerender']) {
  auth.isPending = false;
  rerender(<LaunchSplash />);
}

it('keeps the original HTML while auth is pending and counts the minimum from HTML, not React', async () => {
  const original = splash();
  await advance(400);
  const { rerender } = render(<LaunchSplash />);
  settle(rerender);
  await advance(199);
  expect(splash()).toBe(original);
  expect(splash()?.classList.contains('is-leaving')).toBe(false);
  expect(document.getElementById('root')?.hasAttribute('inert')).toBe(true);
  await advance(1);
  expect(splash()?.classList.contains('is-leaving')).toBe(true);
  expect(document.getElementById('root')?.hasAttribute('inert')).toBe(false);
  await advance(250);
  expect(splash()).toBeNull();
});

it('waits for slow auth, but never waits for images and exits within 250ms of late readiness', async () => {
  const { rerender } = render(<LaunchSplash />);
  await advance(2500);
  expect(splash()).not.toBeNull();
  expect(document.querySelector('img')?.naturalWidth).toBe(0);
  settle(rerender);
  await advance(251);
  expect(splash()).toBeNull();
});

it.each(['signed out', 'network error', 'server error'])(
  'exits when auth settles: %s',
  async (result) => {
    if (result === 'signed out') auth.data = null;
    else auth.error = new Error(result);
    const { rerender } = render(<LaunchSplash />);
    settle(rerender);
    await advance(850);
    expect(splash()).toBeNull();
  },
);

it('does not restart for navigation, focus, background return or later auth changes', async () => {
  const { rerender } = render(<LaunchSplash />);
  settle(rerender);
  await advance(850);
  auth.isPending = true;
  rerender(<LaunchSplash />);
  window.dispatchEvent(new Event('focus'));
  window.dispatchEvent(new Event('pageshow'));
  document.dispatchEvent(new Event('visibilitychange'));
  await advance(1000);
  settle(rerender);
  await advance(1000);
  expect(splash()).toBeNull();
});

it('does not cancel an exit when another auth fetch starts', async () => {
  const { rerender } = render(<LaunchSplash />);
  settle(rerender);
  await advance(600);
  auth.isPending = true;
  rerender(<LaunchSplash />);
  await advance(250);
  expect(splash()).toBeNull();
});

it('survives StrictMode effect replay without starting the minimum again', async () => {
  auth.isPending = false;
  render(
    <StrictMode>
      <LaunchSplash />
    </StrictMode>,
  );
  await advance(850);
  expect(splash()).toBeNull();
});

it('cancels scheduled work on unmount and tolerates a document without an inline splash', async () => {
  auth.isPending = false;
  const view = render(<LaunchSplash />);
  view.unmount();
  await advance(1000);
  expect(splash()?.classList.contains('is-leaving')).toBe(false);
  splash()?.remove();
  render(<LaunchSplash />);
  await advance(1000);
  expect(splash()).toBeNull();
});

it('respects reduced motion without skipping readiness or the minimum', async () => {
  vi.mocked(matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
  const { rerender } = render(<LaunchSplash />);
  await advance(1000);
  expect(splash()).not.toBeNull();
  settle(rerender);
  await advance(1);
  expect(splash()?.classList.contains('is-leaving')).toBe(true);
  await advance(120);
  expect(splash()).toBeNull();
});

it.each([false, true])(
  'keeps browser chrome cardinal until exit, then restores theme (dark=%s)',
  async (dark) => {
    document.documentElement.classList.toggle('dark', dark);
    syncThemeColor(dark);
    expect([...document.querySelectorAll('meta')].map((meta) => meta.content)).toEqual([
      '#8C1515',
      '#8C1515',
    ]);
    const { rerender } = render(<LaunchSplash />);
    settle(rerender);
    await advance(600);
    const expected = dark ? '#121214' : '#F7F7FA';
    expect([...document.querySelectorAll('meta')].map((meta) => meta.content)).toEqual([
      expected,
      expected,
    ]);
    expect(document.documentElement.classList.contains('launching')).toBe(false);
  },
);
