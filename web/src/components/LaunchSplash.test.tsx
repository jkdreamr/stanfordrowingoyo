// @vitest-environment jsdom
import { StrictMode } from 'react';
import splashHtml from '../../index.html?raw';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { LaunchSplash } from './LaunchSplash';
import { dismissSplash, syncThemeColor } from '../lib/splash';

const auth = vi.hoisted(() => ({
  isPending: true,
  data: undefined as object | null | undefined,
  error: null as Error | null,
}));
const warm = vi.hoisted(() => vi.fn());
vi.mock('../lib/queries', () => ({
  useMe: () => auth,
  useConfig: () => warm('config'),
  useWeekStats: () => warm('week'),
  useTarget: () => warm('target'),
}));
beforeEach(() => {
  vi.useFakeTimers();
  auth.isPending = true;
  auth.data = undefined;
  auth.error = null;
  warm.mockClear();
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
it('warms the Home queries as soon as authentication resolves, before Home mounts', () => {
  auth.data = { id: 'rower' };
  auth.isPending = false;
  render(<LaunchSplash />);
  expect(warm).toHaveBeenCalledWith('config');
  expect(warm).toHaveBeenCalledWith('week');
  expect(warm).toHaveBeenCalledWith('target');
  expect(splash()?.classList.contains('is-leaving')).toBe(false);
});
it('does not restart the exit when a signed-in account refresh replaces its data', async () => {
  auth.data = { id: 'rower' };
  auth.isPending = false;
  document.getElementById('root')!.innerHTML = '<div data-launch-ready></div>';
  const view = render(<LaunchSplash />);
  await advance(780);
  expect(splash()?.classList.contains('is-leaving')).toBe(true);
  auth.data = { id: 'rower', name: 'Updated Name' };
  view.rerender(<LaunchSplash />);
  await advance(520);
  expect(splash()).toBeNull();
});
it('waits for Home to commit and paint before lifting, then releases its inert root', async () => {
  const stop = dismissSplash({ waitForHome: true });
  await advance(900);
  expect(splash()?.classList.contains('is-leaving')).toBe(false);
  const home = document.createElement('div');
  home.setAttribute('data-launch-ready', '');
  document.getElementById('root')!.append(home);
  await advance(100);
  expect(splash()?.classList.contains('is-leaving')).toBe(true);
  expect(document.getElementById('root')?.hasAttribute('inert')).toBe(false);
  await advance(520);
  expect(splash()).toBeNull();
  stop?.();
});
it('can reveal a Home error state and cancels a pending readiness observer', async () => {
  const stop = dismissSplash({ waitForHome: true });
  stop?.();
  document.getElementById('root')!.innerHTML =
    '<div class="ui-empty">Could Not Load Your Intro</div>';
  await advance(1000);
  expect(splash()?.classList.contains('is-leaving')).toBe(false);
  const cleanup = dismissSplash({ waitForHome: true });
  await advance(100);
  expect(splash()?.classList.contains('is-leaving')).toBe(true);
  cleanup?.();
});
it('allows a click to skip the inline splash before React or authentication is ready', () => {
  const parsed = new DOMParser().parseFromString(splashHtml, 'text/html');
  const script = [...parsed.querySelectorAll('script:not([type])')].at(-1)!;
  new Function(script.textContent!)();
  splash()?.click();
  expect(splash()).toBeNull();
  expect(document.documentElement.classList.contains('launching')).toBe(false);
  expect(document.getElementById('root')?.hasAttribute('inert')).toBe(false);
});
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
  await advance(379);
  expect(splash()).toBe(original);
  expect(splash()?.classList.contains('is-leaving')).toBe(false);
  expect(document.getElementById('root')?.hasAttribute('inert')).toBe(true);
  await advance(1);
  expect(splash()?.classList.contains('is-leaving')).toBe(true);
  expect(document.getElementById('root')?.hasAttribute('inert')).toBe(false);
  await advance(520);
  expect(splash()).toBeNull();
});

it('waits for slow auth, but never waits for images and exits within 520ms of late readiness', async () => {
  const { rerender } = render(<LaunchSplash />);
  await advance(2500);
  expect(splash()).not.toBeNull();
  expect(document.querySelector('img')?.naturalWidth).toBe(0);
  settle(rerender);
  await advance(521);
  expect(splash()).toBeNull();
});

it.each(['signed out', 'network error', 'server error'])(
  'exits when auth settles: %s',
  async (result) => {
    if (result === 'signed out') auth.data = null;
    else auth.error = new Error(result);
    const { rerender } = render(<LaunchSplash />);
    settle(rerender);
    await advance(1300);
    expect(splash()).toBeNull();
  },
);

it('does not restart for navigation, focus, background return or later auth changes', async () => {
  const { rerender } = render(<LaunchSplash />);
  settle(rerender);
  await advance(1300);
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
  await advance(780);
  auth.isPending = true;
  rerender(<LaunchSplash />);
  await advance(520);
  expect(splash()).toBeNull();
});

it('survives StrictMode effect replay without starting the minimum again', async () => {
  auth.isPending = false;
  render(
    <StrictMode>
      <LaunchSplash />
    </StrictMode>,
  );
  await advance(1300);
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
    await advance(780);
    const expected = dark ? '#0E0D0E' : '#F6F5F3';
    expect([...document.querySelectorAll('meta')].map((meta) => meta.content)).toEqual([
      expected,
      expected,
    ]);
    expect(document.documentElement.classList.contains('launching')).toBe(false);
  },
);
