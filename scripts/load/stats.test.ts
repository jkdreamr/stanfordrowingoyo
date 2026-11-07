import { describe, expect, it, vi } from 'vitest';
import { aggregate, percentile, routeTemplate, measurePhase } from './stats.ts';
import { report } from './report.ts';

describe('metrics', () => {
  it('measures each phase independently, even if the phase fails', async () => {
    const clock = vi
      .spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(350)
      .mockReturnValueOnce(800)
      .mockReturnValueOnce(900);
    const timings: Record<string, number> = {};
    try {
      expect(await measurePhase(timings, 'setup', async () => 42)).toBe(42);
      await expect(
        measurePhase(timings, 'cleanup', async () => {
          throw new Error('failed');
        }),
      ).rejects.toThrow('failed');
      expect(timings).toEqual({ setup: 0.25, cleanup: 0.1 });
    } finally {
      clock.mockRestore();
    }
  });
  it('reports signup separately without exempting login, even in a signup phase', () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = report(
        [
          { endpoint: 'POST /api/auth/signup', scenario: 'signup', ms: 900, status: 201 },
          { endpoint: 'POST /api/auth/login', scenario: 'signup', ms: 901, status: 200 },
        ],
        2,
        { signup: 1, setup: 0.2 },
        800,
      );
      expect(result.signupEndpoints).toMatchObject([
        { endpoint: 'POST /api/auth/signup', p95: 900 },
      ]);
      expect(result.gatedEndpoints).toMatchObject([{ endpoint: 'POST /api/auth/login', p95: 901 }]);
      expect(result.failures).toEqual(['POST /api/auth/login p95 901.0 ms > 800 ms']);
    } finally {
      output.mockRestore();
      table.mockRestore();
      error.mockRestore();
    }
  });
  it('handles empty phases and still fails signup server and network errors', () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(report([], 0, {}, 800)).toMatchObject({
        signupEndpoints: [],
        gatedEndpoints: [],
        failures: [],
      });
      const sample = {
        endpoint: 'POST /api/auth/signup',
        scenario: 'signup',
        ms: 9000,
        status: 201,
      };
      expect(report([sample], 1, {}, 800).failures).toEqual([]);
      expect(report([{ ...sample, status: 500, expected: true }], 1, {}, 800).failures).toEqual([
        '5xx responses occurred',
      ]);
      expect(report([{ ...sample, status: 0 }], 1, {}, 800).failures).toEqual([
        'Network errors occurred',
      ]);
    } finally {
      output.mockRestore();
      table.mockRestore();
      error.mockRestore();
    }
  });
  it('uses nearest rank and handles empty samples', () => {
    expect(percentile([], 95)).toBe(0);
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(
      percentile(
        Array.from({ length: 100 }, (_, i) => i + 1),
        95,
      ),
    ).toBe(95);
    expect(aggregate([])).toEqual([]);
  });
  it('groups timings and counts HTTP and network errors', () => {
    const rows = aggregate(
      [200, 401, 501, 0].map((status, i) => ({
        endpoint: 'GET /api/me',
        scenario: 'session',
        ms: i + 1,
        status,
      })),
    );
    expect(rows).toEqual([
      { endpoint: 'GET /api/me', count: 4, p50: 2, p95: 4, p99: 4, max: 4, errors: 3 },
    ]);
  });
  it('templates IDs and preserves only leaderboard metric', () => {
    expect(routeTemplate('POST', '/api/entries/abc/kudos?x=y')).toBe('POST /api/entries/:id/kudos');
    expect(routeTemplate('GET', '/api/images/abc')).toBe('GET /api/images/:id');
    expect(routeTemplate('PATCH', '/api/admin/users/abc')).toBe('PATCH /api/admin/users/:id');
    expect(routeTemplate('GET', '/api/leaderboard?week=2026-01-01&metric=meters')).toBe(
      'GET /api/leaderboard?metric=meters',
    );
    expect(routeTemplate('GET', '/api/stats/week?user=abc')).toBe('GET /api/stats/week');
  });
  it('fails only on latency, server and network metrics, not 4xx', () => {
    const sample = { endpoint: 'GET /api/me', scenario: 'session', ms: 1, status: 401 };
    expect(report([sample], 1, {}, 800).failures).toEqual([]);
    expect(report([{ ...sample, status: 501 }], 1, {}, 800).failures).toContain(
      '5xx responses occurred',
    );
    expect(report([{ ...sample, status: 0 }], 1, {}, 800).failures).toContain(
      'Network errors occurred',
    );
    expect(report([{ ...sample, ms: 801 }], 1, {}, 800).failures).toHaveLength(1);
  });
});
