import { afterEach, expect, it, vi } from 'vitest';
import { Client } from './http.ts';
import { authenticate, cleanup } from './scenarios.ts';
import { parseOptions } from './args.ts';
import type { Sample } from './stats.ts';

afterEach(() => vi.unstubAllGlobals());

it('keeps cookies isolated and handles JSON, binary and empty responses', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response('{"id":"u"}', {
        headers: { 'Set-Cookie': 'oyo_session=abc; Secure; HttpOnly' },
      }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(new Uint8Array([1, 2])));
  vi.stubGlobal('fetch', fetcher);
  const samples: Sample[] = [];
  const client = new Client('http://localhost', samples, 'session');
  expect(await client.request('GET /api/me')).toMatchObject({ id: 'u' });
  expect(await client.request('POST /api/entries/:id/kudos', { id: 'x' })).toBeUndefined();
  expect(fetcher.mock.calls[1][1].headers.get('Cookie')).toBe('oyo_session=abc');
  expect(fetcher.mock.calls[1][1].headers.get('X-OYO-CSRF')).toBe('1');
  expect(fetcher.mock.calls[0][1].headers.has('X-OYO-CSRF')).toBe(false);
  const other = new Client('http://localhost', samples, 'session');
  expect((await other.request('GET /api/images/:id', { id: 'x' })).size).toBe(2);
  expect(fetcher.mock.calls[2][1].headers.get('Cookie')).toBe('');
  expect(samples).toHaveLength(3);
});

it('records server and network failures without retrying', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response('{}', { status: 501 }))
    .mockRejectedValueOnce(new Error('offline'));
  vi.stubGlobal('fetch', fetcher);
  const samples: Sample[] = [];
  const client = new Client('http://localhost', samples, 'session');
  await expect(client.request('GET /api/me')).rejects.toMatchObject({ status: 501 });
  await expect(client.request('GET /api/me')).rejects.toMatchObject({ status: 0 });
  expect(samples.map((s) => s.status)).toEqual([501, 0]);
});

it('logs in only after signup conflict, with at most two attempts', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response('{}', { status: 409 }))
    .mockResolvedValueOnce(new Response('{"id":"u"}'));
  vi.stubGlobal('fetch', fetcher);
  await authenticate(
    new Client('http://localhost', [], 'session'),
    'loadtest+1@example.com',
    'password',
    'Load Test 1',
    'CODE',
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ team_code: 'CODE' });
  expect(fetcher.mock.calls[1][0]).toBe('http://localhost/api/auth/login');
});

it('cleanup patches only exact synthetic addresses and handles an empty roster', async () => {
  for (const users of [
    [],
    [
      { id: 'yes', email: 'loadtest+1@example.com' },
      { id: 'no', email: 'loadtest+1@example.com.evil' },
      { id: 'admin', email: 'joskoo@stanford.edu' },
    ],
  ]) {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(Response.json({ team_code: 'CODE' }))
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(Response.json(users))
      .mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetcher);
    await cleanup(
      parseOptions(['--base-url', 'http://localhost', '--admin-password', 'password']),
      [],
    );
    expect(fetcher).toHaveBeenCalledTimes(users.length ? 5 : 4);
    if (users.length) {
      expect(fetcher.mock.calls[4][0]).toBe('http://localhost/api/admin/users/yes');
      expect(JSON.parse(fetcher.mock.calls[4][1].body)).toEqual({
        active: false,
        on_leaderboard: false,
      });
    }
  }
});
