import { afterEach, expect, it, vi } from 'vitest';
import { Client } from './http.ts';
import { discoverRoster, prepareRoster, bootstrapAdmin } from './roster.ts';
import { authenticate, cleanup, random } from './scenarios.ts';
import { parseOptions } from './args.ts';
import { routeTemplate } from './stats.ts';

afterEach(() => vi.unstubAllGlobals());
const client = () => new Client('http://localhost', [], 'setup');
const options = () =>
  parseOptions(['--base-url', 'http://localhost', '--admin-password', 'password']);

it('templates roster IDs and distributes deterministic per-user burst starts', () => {
  expect(routeTemplate('POST', '/api/admin/roster/row-1/unlink')).toBe(
    'POST /api/admin/roster/:id/unlink',
  );
  expect(routeTemplate('DELETE', '/api/admin/roster/row-1')).toBe('DELETE /api/admin/roster/:id');
  expect(random(42)()).toBe(random(42)());
  const bins = new Set(Array.from({ length: 60 }, (_, i) => Math.floor(random(i + 1)() * 6)));
  expect(bins.size).toBe(6);
});

it('discovers roster choices and rejects every failed discovery without legacy signup', async () => {
  for (const status of [200, 404, 405, 501, 403, 429, 500]) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([], { status })));
    const api = client();
    if (status !== 200) await expect(discoverRoster(api, 'CODE')).rejects.toMatchObject({ status });
    else expect(await discoverRoster(api, 'CODE')).toEqual([]);
    expect(api.samples[0].expected).toBeUndefined();
  }
});

it('bootstraps an admin once, accepts minimal signup and shares the cookie for the probe', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response('{}', { status: 401 }))
    .mockResolvedValueOnce(
      Response.json(
        { id: 'admin' },
        { headers: { 'Set-Cookie': 'oyo_session=admin-cookie; Secure' } },
      ),
    )
    .mockResolvedValueOnce(Response.json({ team_code: 'CODE' }))
    .mockResolvedValueOnce(Response.json([]));
  vi.stubGlobal('fetch', fetcher);
  const result = await bootstrapAdmin(options(), []);
  expect(result.teamCode).toBe('CODE');
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/login'))).toHaveLength(1);
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
    email: 'joskoo@stanford.edu',
    password: 'password',
  });
  expect(fetcher.mock.calls[3][1].headers.get('Cookie')).toBe('oyo_session=admin-cookie');
});

it('does not retry invalid admin signup with the obsolete name field', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response('{}', { status: 401 }))
    .mockResolvedValueOnce(new Response('{}', { status: 400 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(bootstrapAdmin(options(), [])).rejects.toMatchObject({ status: 400 });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('reuses only matching synthetic rows and creates missing rows with no seeded email', async () => {
  const rows = [
    { id: 'real', name: 'Real Athlete', claimed_by_user_id: null },
    { id: 'free', name: 'Load Test 01', claimed_by_user_id: null },
    { id: 'own', name: 'Load Test 02', claimed_by_user_id: 'u2' },
  ];
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json(rows))
    .mockResolvedValueOnce(Response.json([{ id: 'u2', email: 'loadtest+2@example.com' }]))
    .mockResolvedValueOnce(
      Response.json({ id: 'new', name: 'Load Test 03', claimed_by_user_id: null }),
    );
  vi.stubGlobal('fetch', fetcher);
  const roster = await prepareRoster(client(), 3);
  expect([...roster.values()].map((r) => r.id)).toEqual(['free', 'own', 'new']);
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({
    name: 'Load Test 03',
    email: null,
    role: 'rower',
    group_key: null,
    side: null,
    class_year: null,
  });
  expect(fetcher.mock.calls[2][1].headers.get('X-OYO-CSRF')).toBe('1');
});

it('refuses rows claimed by someone else and handles an empty requested roster', async () => {
  for (const count of [0, 1]) {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json([{ id: 'other', name: 'Load Test 01', claimed_by_user_id: 'real' }]),
        )
        .mockResolvedValueOnce(Response.json([{ id: 'real', email: 'athlete@example.com' }])),
    );
    if (count) await expect(prepareRoster(client(), count)).rejects.toThrow('different user');
    else expect((await prepareRoster(client(), count)).size).toBe(0);
  }
});

it('claims a synthetic row with its own email and group in one auth attempt', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ id: 'new' }));
  vi.stubGlobal('fetch', fetcher);
  await authenticate(client(), 'loadtest+1@example.com', 'password', 'CODE', {
    roster_id: 'free',
    group_key: 'u23',
  });
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
    email: 'loadtest+1@example.com',
    password: 'password',
    team_code: 'CODE',
    roster_id: 'free',
    group_key: 'u23',
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('logs in first for burst re-login or a roster row already claimed by the same user', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ id: 'existing' }));
  vi.stubGlobal('fetch', fetcher);
  await authenticate(
    client(),
    'loadtest+1@example.com',
    'password',
    'CODE',
    { roster_id: 'own' },
    true,
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe('http://localhost/api/auth/login');
});

it('does not retry a signup rate limit or a server error', async () => {
  for (const status of [429, 500]) {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status }));
    vi.stubGlobal('fetch', fetcher);
    await expect(
      authenticate(client(), 'loadtest+1@example.com', 'password', 'CODE', { roster_id: 'free' }),
    ).rejects.toMatchObject({ status });
    expect(fetcher).toHaveBeenCalledTimes(1);
  }
});

it('unlinks and deletes only synthetic roster names, then deactivates only synthetic emails', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ id: 'admin' }))
    .mockResolvedValueOnce(Response.json({ team_code: 'CODE' }))
    .mockResolvedValueOnce(Response.json([]))
    .mockResolvedValueOnce(
      Response.json([
        { id: 'claimed', name: 'Load Test 01', claimed_by_user_id: 'u' },
        { id: 'free', name: 'Load Test 02', claimed_by_user_id: null },
        { id: 'real', name: 'Real Athlete', claimed_by_user_id: null },
        { id: 'near', name: 'Load Test 03 extra', claimed_by_user_id: null },
      ]),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(
      Response.json([
        { id: 'u', email: 'loadtest+1@example.com' },
        { id: 'real', email: 'real@example.com' },
      ]),
    )
    .mockResolvedValue(Response.json({}));
  vi.stubGlobal('fetch', fetcher);
  await cleanup(options(), []);
  const mutations = fetcher.mock.calls.filter(([, init]) =>
    ['DELETE', 'PATCH'].includes(init.method),
  );
  expect(mutations.map(([url]) => url)).toEqual([
    'http://localhost/api/admin/roster/claimed',
    'http://localhost/api/admin/roster/free',
    'http://localhost/api/admin/users/u',
  ]);
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/unlink'))).toHaveLength(1);
  for (const [, init] of fetcher.mock.calls)
    if (init.method !== 'GET') expect(init.headers.get('X-OYO-CSRF')).toBe('1');
});
