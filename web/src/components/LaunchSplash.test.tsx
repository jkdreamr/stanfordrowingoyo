// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { LaunchSplash } from './LaunchSplash';
import { syncThemeColor } from '../lib/splash';
import { afterLaunch } from '../lib/motion';

const auth = vi.hoisted(() => ({
  isPending: true,
  data: undefined as object | null | undefined,
  error: null as Error | null,
}));
const warmed = vi.hoisted(() => vi.fn());
vi.mock('../lib/queries', () => ({
  useMe: () => auth,
  useConfig: () => warmed('config'),
  useWeekStats: () => warmed('week'),
  useTarget: () => warmed('target'),
  useSeasonStats: () => warmed('season'),
}));
beforeEach(() => {
  vi.useFakeTimers();
  auth.isPending = true;
  auth.data = undefined;
  auth.error = null;
  warmed.mockClear();
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
  delete document.documentElement.dataset.handoff;
  history.replaceState(null, '', '/');
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
  await advance(499);
  expect(splash()).toBe(original);
  expect(splash()?.classList.contains('is-leaving')).toBe(false);
  expect(document.getElementById('root')?.hasAttribute('inert')).toBe(true);
  await advance(1);
  expect(splash()?.classList.contains('is-leaving')).toBe(true);
  expect(document.getElementById('root')?.hasAttribute('inert')).toBe(false);
  await advance(380);
  expect(splash()).toBeNull();
});

it('waits for slow auth, but never waits for images and exits within 380ms of late readiness', async () => {
  const { rerender } = render(<LaunchSplash />);
  await advance(2500);
  expect(splash()).not.toBeNull();
  expect(document.querySelector('img')?.naturalWidth).toBe(0);
  settle(rerender);
  await advance(381);
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
  await advance(900);
  auth.isPending = true;
  rerender(<LaunchSplash />);
  await advance(380);
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
    await advance(900);
    const expected = dark ? '#0E0D0D' : '#F5F3F0';
    expect([...document.querySelectorAll('meta')].map((meta) => meta.content)).toEqual([
      expected,
      expected,
    ]);
    expect(document.documentElement.classList.contains('launching')).toBe(false);
  },
);

const rect = (top: number, left: number, right: number, bottom: number) =>
  ({ top, left, right, bottom, width: right - left, height: bottom - top }) as DOMRect;
function mountHero(box = rect(76, 16, 377, 382)) {
  splash()!.getBoundingClientRect = () => rect(0, 0, 393, 852);
  const hero = document.createElement('a');
  hero.className = 'drive-hero';
  hero.getBoundingClientRect = () => box;
  document.getElementById('root')!.append(hero);
}

it("hands the splash off to Home's hero, releasing input at the usual moment", async () => {
  mountHero();
  const root = document.documentElement;
  const { rerender } = render(<LaunchSplash />);
  settle(rerender);
  await advance(899);
  expect(splash()?.classList.contains('is-leaving')).toBe(false);
  await advance(1);
  const style = splash()!.style;
  expect(splash()?.className).toContain('is-handoff');
  expect(splash()?.className).toContain('is-leaving');
  expect(
    ['top', 'right', 'bottom', 'left'].map((side) => style.getPropertyValue(`--handoff-${side}`)),
  ).toEqual(['76px', '16px', '470px', '16px']);
  expect(document.getElementById('root')?.hasAttribute('inert')).toBe(false);
  expect(root.classList.contains('launching')).toBe(false);
  expect(root.classList.contains('launch-handoff')).toBe(true);
  expect(root.hasAttribute('data-handoff')).toBe(true);
  const started = vi.fn();
  afterLaunch(started);
  await advance(279);
  expect(started).not.toHaveBeenCalled();
  expect(root.classList.contains('launch-handoff')).toBe(true);
  await advance(1);
  expect(root.classList.contains('launch-handoff')).toBe(false);
  await advance(20);
  expect(started).toHaveBeenCalledTimes(1);
  await advance(179);
  expect(splash()).not.toBeNull();
  await advance(1);
  expect(splash()).toBeNull();
});

it.each([
  ['the hero is cut off by the viewport', () => mountHero(rect(700, 16, 377, 1006))],
  ['the hero has not rendered yet', () => {}],
  [
    'Home is not the landing route',
    () => {
      history.replaceState(null, '', '/feed');
      mountHero();
    },
  ],
])('falls back to the curtain when %s', async (_, arrange) => {
  arrange();
  const { rerender } = render(<LaunchSplash />);
  settle(rerender);
  await advance(900);
  expect(splash()?.classList.contains('is-leaving')).toBe(true);
  expect(splash()?.classList.contains('is-handoff')).toBe(false);
  expect(document.documentElement.classList.contains('launch-handoff')).toBe(false);
  expect(document.documentElement.hasAttribute('data-handoff')).toBe(false);
  await advance(380);
  expect(splash()).toBeNull();
});

it('keeps the reduced-motion fade even when the hero could receive the handoff', async () => {
  vi.mocked(matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
  mountHero();
  const { rerender } = render(<LaunchSplash />);
  settle(rerender);
  await advance(900);
  expect(splash()?.classList.contains('is-handoff')).toBe(false);
  await advance(120);
  expect(splash()).toBeNull();
});

it('completes a handoff in progress if the splash owner unmounts', async () => {
  mountHero();
  const view = render(<LaunchSplash />);
  settle(view.rerender);
  await advance(900);
  expect(document.documentElement.classList.contains('launch-handoff')).toBe(true);
  view.unmount();
  expect(splash()).toBeNull();
  expect(document.documentElement.classList.contains('launch-handoff')).toBe(false);
});

it("warms Home's hero queries as soon as a signed-in launch on Home resolves", () => {
  auth.isPending = false;
  auth.data = { id: 'rower', must_change_password: false };
  render(<LaunchSplash />);
  expect([...new Set(warmed.mock.calls.map(([name]) => name))]).toEqual([
    'config',
    'week',
    'target',
    'season',
  ]);
  cleanup();
  warmed.mockClear();
  history.replaceState(null, '', '/feed');
  render(<LaunchSplash />);
  expect(warmed).not.toHaveBeenCalled();
});
