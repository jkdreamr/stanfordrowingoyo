import { expect, it } from 'vitest';
import type { ErgTest, TeamChallenge, WeeklyRecap } from '../../../shared/types';
import { createMockApi } from './handlers';
function setup() {
  const mock = createMockApi({ now: () => new Date('2026-03-16T18:00:00Z') });
  mock.state.entries = [];
  return {
    ...mock,
    request: (path: string, method = 'GET', body?: unknown) =>
      mock.handle(
        new Request('https://oyo.test/api' + path, {
          method,
          ...(body === undefined
            ? {}
            : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        }),
      ),
  };
}
it('mocks tests, derived profile bests, recaps and owner errors', async () => {
  const { request } = setup();
  const created = await request('/me/tests', 'POST', {
    kind: '2k',
    date: '2026-03-09',
    split_s: 90,
  });
  expect(created.status).toBe(201);
  const row = (await created.json()) as ErgTest;
  expect(row).toMatchObject({ time_s: 360, split_s: 90, is_pr: true });
  expect((await request('/me/tests/' + row.id, 'PATCH', { time_s: 364 })).status).toBe(200);
  expect(
    (await request('/me/tests', 'POST', { kind: '2k', date: '2026-03-17', split_s: 90 })).status,
  ).toBe(400);
  expect((await request('/me/tests/missing', 'DELETE')).status).toBe(404);
  expect((await request('/me/tests/' + row.id, 'DELETE')).status).toBe(204);
  const recap = (await (await request('/stats/recap')).json()) as WeeklyRecap;
  expect(recap).toMatchObject({
    week_start: '2026-03-09',
    total_m: 0,
    entry_count: 0,
    streak: 0,
    best_effort: null,
  });
  expect((await request('/stats/recap?week=2026-03-16')).status).toBe(400);
});
it('mocks staff challenges including empty, progress, editing and ending', async () => {
  const { request, state } = setup();
  const input = {
    title: 'Team',
    unit: 'km',
    goal_m: 10000,
    modality: null,
    start_date: '2026-03-09',
    end_date: '2026-03-22',
  };
  expect(await (await request('/challenges')).json()).toEqual([]);
  expect((await request('/admin/challenges', 'POST', input)).status).toBe(403);
  state.users[0].role = 'coach';
  const response = await request('/admin/challenges', 'POST', input);
  expect(response.status).toBe(201);
  const row = (await response.json()) as TeamChallenge;
  expect(row).toMatchObject({ status: 'active', progress_m: 0 });
  expect((await request('/admin/challenges/' + row.id, 'PATCH', { goal_m: 0 })).status).toBe(400);
  expect((await request('/admin/challenges/' + row.id, 'PATCH', { unit: 'emeters' })).status).toBe(
    200,
  );
  expect((await request('/admin/challenges/' + row.id + '/end', 'POST')).status).toBe(200);
  expect((await request('/admin/challenges/' + row.id, 'PATCH', { title: 'Edited' })).status).toBe(
    409,
  );
  expect(await (await request('/challenges')).json()).toEqual([]);
  expect((await request('/admin/challenges/' + row.id, 'DELETE')).status).toBe(204);
});
