import { afterEach, expect, expectTypeOf, it, vi } from 'vitest';
import type { Api, PublicUser } from '../../../shared/types';
import { api, ApiClientError } from './api';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('reads the personal workout CSV as text', async () => {
  setup(
    new Response('id,date\r\nentry-1,2026-11-06\r\n', { headers: { 'Content-Type': 'text/csv' } }),
  );
  expect(await api('GET /api/me/export/workouts', {})).toBe('id,date\r\nentry-1,2026-11-06\r\n');
});
it('keeps enriched responses available through the shared client contract', () => {
  expectTypeOf<
    Api['GET /api/entries/:id/comments']['response'][number]['author']
  >().toEqualTypeOf<PublicUser>();
  expectTypeOf<
    Api['POST /api/entries/:id/comments']['response']['author']
  >().toEqualTypeOf<PublicUser>();
  expectTypeOf<
    Api['GET /api/notifications']['response'][number]['actor']
  >().toEqualTypeOf<PublicUser>();
  expectTypeOf<Api['GET /api/notifications']['response'][number]['entry_title']>().toEqualTypeOf<
    string | null
  >();
  expectTypeOf<
    Api['GET /api/announcements']['response'][number]['author']
  >().toEqualTypeOf<PublicUser>();
  expectTypeOf<Api['GET /api/leaderboard']['response'][number]['streak']>().toEqualTypeOf<number>();
  expectTypeOf<
    Api['GET /api/leaderboard']['response'][number]['entry_count']
  >().toEqualTypeOf<number>();
  expectTypeOf<Api['GET /api/config']['response']['today']>().toEqualTypeOf<string>();
  expectTypeOf<Api['GET /api/config']['response']['current_week_start']>().toEqualTypeOf<string>();
});
it.each(['personal', 'group'] as const)('reads the effective %s target', async (source) => {
  const target = { week_start: '2026-11-02', target_m: 80000, source };
  const fetcher = setup(Response.json(target));
  const result = await api('GET /api/me/target', {});
  expectTypeOf(result.source).toEqualTypeOf<'personal' | 'group'>();
  expect(result).toEqual(target);
  expect(String(fetcher.mock.calls[0][0])).toBe('https://oyo.example/api/me/target');
});
function setup(response: Response) {
  vi.stubGlobal('window', { location: { origin: 'https://oyo.example' } });
  const fetcher = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
it('encodes queries', async () => {
  const fetcher = setup(Response.json({ items: [], next_cursor: null }));
  expect(await api('GET /api/entries', { query: { scope: 'user:a/b' } })).toEqual({
    items: [],
    next_cursor: null,
  });
  expect(String(fetcher.mock.calls[0][0])).toContain('scope=user%3Aa%2Fb');
});
it('handles empty success', async () => {
  const fetcher = setup(new Response(null, { status: 204 }));
  expect(await api('POST /api/auth/logout', {})).toBeUndefined();
  expect(fetcher.mock.calls[0][1].headers).toEqual({ 'X-OYO-CSRF': '1' });
});
it('sends CSRF and content type on JSON writes', async () => {
  const fetcher = setup(Response.json([]));
  await api('POST /api/auth/roster', { body: { team_code: 'code' } });
  expect(fetcher.mock.calls[0][1].headers).toEqual({
    'X-OYO-CSRF': '1',
    'Content-Type': 'application/json',
  });
});
it('surfaces typed API errors', async () => {
  setup(Response.json({ error: { code: 'NO_AUTH', message: 'Log in' } }, { status: 401 }));
  await expect(api('GET /api/me', {})).rejects.toBeInstanceOf(ApiClientError);
});
it('encodes path parameters', async () => {
  const fetcher = setup(new Response(null, { status: 204 }));
  await api('DELETE /api/comments/:id', { params: { id: 'a/b' } });
  expect(String(fetcher.mock.calls[0][0])).toContain('a%2Fb');
});
const hashingRequests = [
  () =>
    api('POST /api/auth/signup', { body: { email: 'rower@example.com', password: 'password' } }),
  () => api('POST /api/auth/login', { body: { email: 'rower@example.com', password: 'password' } }),
  () => api('POST /api/me/password/verify', { body: { current_password: 'password' } }),
  () =>
    api('POST /api/me/password', {
      body: { new_password: 'new-password', reauth_token: 'opaque-token' },
    }),
  () => api('POST /api/admin/users/:id/reset-password', { params: { id: 'user-1' } }),
];
it.each(hashingRequests)(
  'retries a hashing request once after 300ms with the same replayable body (%#)',
  async (send) => {
    vi.useFakeTimers();
    const fetcher = setup(
      new Response('<html>Worker exceeded resource limits</html>', { status: 503 }),
    );
    fetcher.mockResolvedValueOnce(
      new Response('<html>Worker exceeded resource limits</html>', { status: 503 }),
    );
    fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = send();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(299);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]).toEqual(fetcher.mock.calls[0]);
    expect(
      fetcher.mock.calls[0][1].body === undefined ||
        typeof fetcher.mock.calls[0][1].body === 'string',
    ).toBe(true);
  },
);
it.each([500, 502, 503, 504])(
  'limits an unenveloped %i retry to one and surfaces the busy message',
  async (status) => {
    vi.useFakeTimers();
    const fetcher = setup(new Response('Worker exceeded resource limits', { status }));
    fetcher.mockImplementation(
      async () => new Response('Worker exceeded resource limits', { status }),
    );
    const result = expect(
      api('POST /api/me/password/verify', { body: { current_password: 'password' } }),
    ).rejects.toMatchObject({
      status,
      detail: { code: 'SERVER_BUSY', message: 'The server is busy. Please try again.' },
      message: 'The server is busy. Please try again.',
    });
    await vi.advanceTimersByTimeAsync(300);
    await result;
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  },
);
it.each([400, 401, 403, 409, 429])('never retries an unenveloped %i', async (status) => {
  vi.useFakeTimers();
  const fetcher = setup(new Response('Request rejected', { status }));
  await expect(
    api('POST /api/auth/login', { body: { email: 'rower@example.com', password: 'password' } }),
  ).rejects.toMatchObject({ status });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
it.each([400, 401, 409, 500, 503, 504])(
  'never retries a JSON-enveloped %i, even on hashing endpoints',
  async (status) => {
    vi.useFakeTimers();
    const detail = { code: 'EXPLICIT_ERROR', message: 'An explicit API error.' };
    const fetcher = setup(Response.json({ error: detail }, { status }));
    await expect(
      api('POST /api/me/password', { body: { new_password: 'new-password' } }),
    ).rejects.toMatchObject({ status, detail });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  },
);
it('does not retry any other endpoint on 503', async () => {
  vi.useFakeTimers();
  const fetcher = setup(new Response('Busy', { status: 503 }));
  await expect(
    api('POST /api/auth/roster', { body: { team_code: 'cardinal-oyo' } }),
  ).rejects.toMatchObject({ status: 503 });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
it('does not retry network failures', async () => {
  vi.useFakeTimers();
  const fetcher = setup(new Response(null, { status: 204 }));
  fetcher.mockRejectedValue(new TypeError('Offline'));
  await expect(
    api('POST /api/me/password/verify', { body: { current_password: 'password' } }),
  ).rejects.toThrow('Offline');
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
