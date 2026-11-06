import { describe, expect, it } from 'vitest';
import { aggregate, percentile, routeTemplate } from './stats.ts';
import { report } from './report.ts';

describe('metrics', () => {
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
