import { afterEach, expect, it, vi } from 'vitest';
import { ramp, runScenarios } from './scenarios.ts';
import { parseOptions } from './args.ts';
import type { Sample } from './stats.ts';

vi.mock('node:timers/promises', () => ({
  setTimeout: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
}));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('spreads ramp starts evenly over the duration and handles empty and single-user ramps', async () => {
  vi.useFakeTimers();
  const start = performance.now();
  const starts: number[] = [];
  const pending = ramp([1, 2, 3], 60, 3, async () => {
    starts.push(performance.now() - start);
  });
  await vi.runAllTimersAsync();
  await pending;
  expect(starts).toEqual([0, 30000, 60000]);
  const run = vi.fn(async () => {});
  await ramp([], 60, 3, run);
  expect(run).not.toHaveBeenCalled();
  const single = ramp([1], 60, 1, run);
  await vi.runAllTimersAsync();
  await single;
  expect(run).toHaveBeenCalledTimes(1);
  expect(run).toHaveBeenCalledWith(1);
});

it('bounds zero-duration ramps by concurrency and propagates errors', async () => {
  vi.useFakeTimers();
  let active = 0,
    peak = 0;
  const pending = ramp([1, 2, 3, 4], 0, 2, async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    active--;
  });
  await vi.runAllTimersAsync();
  await pending;
  expect(peak).toBe(2);
  const failure = expect(
    ramp([1], 0, 1, async () => {
      throw new Error('failed');
    }),
  ).rejects.toThrow('failed');
  await vi.runAllTimersAsync();
  await failure;
});

function traffic() {
  return vi.fn(async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname;
    if (path === '/api/auth/login' || path === '/api/auth/signup') {
      const { email } = JSON.parse(init.body as string);
      return Response.json({ id: email, email });
    }
    if (path === '/api/admin/settings') return Response.json({ team_code: 'CODE' });
    if (path === '/api/admin/users') return Response.json([]);
    if (path === '/api/auth/roster' || path === '/api/admin/roster')
      return Response.json(
        [1, 2].map((n) => ({ id: `r${n}`, name: `Load Test 0${n}`, claimed_by_user_id: null })),
      );
    if (path === '/api/config') return Response.json({ today: '2026-11-06' });
    if (path === '/api/leaderboard') return Response.json([]);
    return Response.json({});
  });
}

it('ramps real signup requests before session/burst traffic', async () => {
  vi.useFakeTimers();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const fetcher = traffic();
  vi.stubGlobal('fetch', fetcher);
  const samples: Sample[] = [];
  const timings: Record<string, number> = {};
  const pending = runScenarios(
    parseOptions([
      '--base-url',
      'http://localhost',
      '--users',
      '2',
      '--scenario',
      'burst',
      '--burst-window',
      '0',
      '--admin-password',
      'dummy-password',
    ]),
    samples,
    timings,
  );
  await vi.runAllTimersAsync();
  expect(await pending).toBe(0);
  expect(timings.signup).toBe(60);
  expect(samples.filter((s) => s.endpoint.endsWith('/signup')).map((s) => s.scenario)).toEqual([
    'signup',
    'signup',
  ]);
  const lastSignup = samples.map((s) => s.endpoint).lastIndexOf('POST /api/auth/signup');
  expect(samples.slice(0, lastSignup).some((s) => s.scenario === 'burst')).toBe(false);
});

it('skip-signup logs in deterministic accounts without admin access, roster writes or signup', async () => {
  vi.useFakeTimers();
  const fetcher = traffic();
  vi.stubGlobal('fetch', fetcher);
  const samples: Sample[] = [];
  const pending = runScenarios(
    parseOptions([
      '--base-url',
      'http://localhost',
      '--users',
      '2',
      '--skip-signup',
      '--auth-ramp',
      '0',
      '--scenario',
      'burst',
      '--burst-window',
      '0',
    ]),
    samples,
    {},
  );
  await vi.runAllTimersAsync();
  expect(await pending).toBe(0);
  expect(samples.filter((s) => s.scenario === 'login')).toHaveLength(2);
  expect(fetcher.mock.calls.filter(([url]) => /admin|roster|signup/.test(url))).toEqual([]);
  expect(
    fetcher.mock.calls
      .filter(([url]) => url.endsWith('/login'))
      .map(([, init]) => JSON.parse(init.body as string)),
  ).toEqual(
    [1, 2].map((n) => ({ email: `loadtest+${n}@example.com`, password: 'loadtest-password-1' })),
  );
});

it.each([401, 500, 0])(
  'skip-signup fails missing accounts and HTTP/network failures (%s) without signup fallback',
  async (status) => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetcher = vi.fn(async () => {
      if (!status) throw new Error('offline');
      return Response.json({}, { status });
    });
    vi.stubGlobal('fetch', fetcher);
    const samples: Sample[] = [];
    const pending = runScenarios(
      parseOptions(['--base-url', 'http://localhost', '--users', '1', '--skip-signup']),
      samples,
      {},
    );
    await vi.runAllTimersAsync();
    expect(await pending).toBe(1);
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({ endpoint: 'POST /api/auth/login', status });
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);
