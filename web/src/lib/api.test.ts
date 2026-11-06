import { afterEach, expect, expectTypeOf, it, vi } from 'vitest';
import type { Api, PublicUser } from '../../../shared/types';
import { api, ApiClientError } from './api';
afterEach(() => vi.unstubAllGlobals());
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
  setup(new Response(null, { status: 204 }));
  expect(await api('POST /api/auth/logout', {})).toBeUndefined();
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
