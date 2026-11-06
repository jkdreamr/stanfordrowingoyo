import { afterEach, expect, it, vi } from 'vitest';
import { api, ApiClientError } from './api';
afterEach(() => vi.unstubAllGlobals());
function setup(response: Response) { vi.stubGlobal('window', { location: { origin: 'https://oyo.example' } }); const fetcher = vi.fn().mockResolvedValue(response); vi.stubGlobal('fetch', fetcher); return fetcher; }
it('encodes queries', async () => { const fetcher = setup(Response.json({ items: [], next_cursor: null })); expect(await api('GET /api/entries', { query: { scope: 'user:a/b' } })).toEqual({ items: [], next_cursor: null }); expect(String(fetcher.mock.calls[0][0])).toContain('scope=user%3Aa%2Fb'); });
it('handles empty success', async () => { setup(new Response(null, { status: 204 })); expect(await api('POST /api/auth/logout', {})).toBeUndefined(); });
it('surfaces typed API errors', async () => { setup(Response.json({ error: { code: 'NO_AUTH', message: 'Log in' } }, { status: 401 })); await expect(api('GET /api/me', {})).rejects.toBeInstanceOf(ApiClientError); });
it('encodes path parameters', async () => { const fetcher = setup(new Response(null, { status: 204 })); await api('DELETE /api/comments/:id', { params: { id: 'a/b' } }); expect(String(fetcher.mock.calls[0][0])).toContain('a%2Fb'); });
