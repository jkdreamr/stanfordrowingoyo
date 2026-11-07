import { describe, expect, it } from 'vitest';
import { qk, optimisticKudos, invalidationKeys } from './queries';
import { createQueryClient } from './queryClient';
import { ApiClientError } from './api';
for (const source of ['query', 'mutation'] as const) {
  it(`${source} 401 clears cached identity and user queries without clearing drafts`, async () => {
    const client = createQueryClient();
    client.setQueryData(qk.me(), { id: 'old-user' });
    client.setQueryData(qk.entries(), { private: 'old content' });
    client.setQueryData(qk.request('GET /api/me/intro', {}), { completed_at: 'old' });
    const fail = async () => {
      throw new ApiClientError(401, { code: 'UNAUTHENTICATED', message: 'Expired' });
    };
    const request =
      source === 'query'
        ? client.fetchQuery({ queryKey: qk.target(), queryFn: fail })
        : client.getMutationCache().build(client, { mutationFn: fail }).execute(undefined);
    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(client.getQueryData(qk.me())).toBeNull();
    expect(client.getQueryData(qk.entries())).toBeUndefined();
    expect(client.getQueryData(qk.request('GET /api/me/intro', {}))).toBeUndefined();
    expect(client.getQueryCache().getAll()).toHaveLength(1);
    client.clear();
  });
}
it('does not expire a valid session for password reauthentication challenges or server errors', async () => {
  for (const [status, code] of [
    [401, 'INVALID_CREDENTIALS'],
    [401, 'REAUTH_REQUIRED'],
    [500, 'SERVER_ERROR'],
  ] as const) {
    const client = createQueryClient();
    client.setQueryData(qk.me(), { id: 'valid-user' });
    await expect(
      client
        .getMutationCache()
        .build(client, {
          mutationFn: async () => {
            throw new ApiClientError(status, { code, message: 'Try again' });
          },
        })
        .execute(undefined),
    ).rejects.toMatchObject({ status });
    expect(client.getQueryData(qk.me())).toEqual({ id: 'valid-user' });
    client.clear();
  }
});
describe('query keys', () => {
  it('refreshes comment and moderation surfaces after report decisions', () => {
    expect(invalidationKeys('PATCH /api/comments/:id')).toContainEqual(qk.root('entries'));
    expect(invalidationKeys('PATCH /api/comments/:id')).toContainEqual(qk.root('admin'));
    for (const resource of [
      'admin',
      'entries',
      'stats',
      'leaderboard',
      'users',
      'me',
      'notifications',
      'challenges',
    ])
      expect(invalidationKeys('PATCH /api/admin/reports/:id')).toContainEqual(qk.root(resource));
  });
  it('keeps resource prefixes and parameters consistent', () => {
    for (const endpoint of [
      'POST /api/me/tests',
      'PATCH /api/me/tests/:id',
      'DELETE /api/me/tests/:id',
    ] as const)
      for (const resource of ['users', 'me'])
        expect(invalidationKeys(endpoint)).toContainEqual(qk.root(resource));
    expect(qk.me()).toEqual(qk.request('GET /api/me', {}));
    expect(qk.myPlan()).toEqual(qk.request('GET /api/me/plan', { query: {} }));
    expect(qk.myPlan('2026-11-09')).toEqual(
      qk.request('GET /api/me/plan', { query: { date: '2026-11-09' } }),
    );
    for (const endpoint of [
      'POST /api/entries',
      'PATCH /api/entries/:id',
      'DELETE /api/entries/:id',
    ] as const)
      expect(invalidationKeys(endpoint)).toContainEqual(qk.myPlans().slice(0, 2));
    expect(qk.entry('one')).toEqual(qk.request('GET /api/entries/:id', { params: { id: 'one' } }));
    expect(qk.entries('mine')).toEqual(
      qk.request('GET /api/entries', { query: { scope: 'mine' } }),
    );
    expect(qk.entries('mine')).not.toEqual(qk.entries('feed'));
    expect(qk.comments('one')).not.toEqual(qk.comments('two'));
    expect(invalidationKeys('PUT /api/me/target')).toContainEqual(qk.root('stats'));
    for (const resource of [
      'me',
      'config',
      'stats',
      'leaderboard',
      'users',
      'entries',
      'notifications',
    ])
      expect(invalidationKeys('PATCH /api/me')).toContainEqual(qk.root(resource));
    expect(invalidationKeys('POST /api/admin/roster/:id/unlink')).toContainEqual(qk.root('users'));
    expect(invalidationKeys('POST /api/admin/roster/:id/unlink')).toContainEqual(qk.root('admin'));
  });
  it('updates every cached entry shape and rolls back on error', async () => {
    const client = createQueryClient();
    const entry = { id: 'one', has_kudos: false, kudos_count: 2 };
    const keys = [
      qk.entry('one'),
      qk.entries('feed'),
      qk.entries('mine'),
      qk.entries('user:maya'),
      qk.request('GET /api/stats/week', { query: {} }),
    ];
    const values = [
      entry,
      ...Array.from({ length: 3 }, () => ({
        pages: [{ items: [entry], next_cursor: null }],
        pageParams: [undefined],
      })),
      { entries: [entry] },
    ];
    keys.forEach((key, i) => client.setQueryData(key, values[i]));
    const rollback = await optimisticKudos(client, 'one', true);
    expect(client.getQueryData(qk.entry('one'))).toEqual({
      ...entry,
      has_kudos: true,
      kudos_count: 3,
    });
    for (const key of keys.slice(1))
      expect(JSON.stringify(client.getQueryData(key))).toContain('"has_kudos":true');
    rollback();
    keys.forEach((key, i) => expect(client.getQueryData(key)).toEqual(values[i]));
    const undo = await optimisticKudos(client, 'one', false);
    expect(client.getQueryData(qk.entry('one'))).toEqual(entry);
    undo();
    await optimisticKudos(client, 'missing', true);
    expect(client.getQueryData(qk.entry('one'))).toEqual(entry);
    client.clear();
  });
});
