import { describe, expect, it } from 'vitest';
import { qk, optimisticKudos, invalidationKeys } from './queries';
import { createQueryClient } from './queryClient';
describe('query keys', () => {
  it('keeps resource prefixes and parameters consistent', () => {
    expect(qk.me()).toEqual(qk.request('GET /api/me', {}));
    expect(qk.entry('one')).toEqual(qk.request('GET /api/entries/:id', { params: { id: 'one' } }));
    expect(qk.entries('mine')).toEqual(
      qk.request('GET /api/entries', { query: { scope: 'mine' } }),
    );
    expect(qk.entries('mine')).not.toEqual(qk.entries('feed'));
    expect(qk.comments('one')).not.toEqual(qk.comments('two'));
    expect(invalidationKeys('PUT /api/me/target')).toContainEqual(qk.root('stats'));
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
