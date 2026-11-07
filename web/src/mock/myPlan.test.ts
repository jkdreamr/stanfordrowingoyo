import { expect, it } from 'vitest';
import type { MyPlanInput } from '../../../shared/types';
import { createMockApi } from './handlers';
function setup() {
  const mock = createMockApi({ now: () => new Date('2026-11-02T18:00:00Z') });
  mock.state.entries = [];
  const request = (path = '/me/plan', method = 'GET', body?: unknown) =>
    mock.handle(
      new Request(`http://localhost/api${path}`, {
        method,
        ...(body === undefined
          ? {}
          : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      }),
    );
  return { ...mock, request };
}
const input: MyPlanInput = {
  start_date: '2026-11-02',
  sessions: [
    {
      week: 1,
      day: 0,
      slot: 'AM',
      modality: 'erg',
      zone: 'E',
      distance_m: 12000,
      note: ' Steady ',
    },
  ],
  rest_days: [],
};
it('supports empty plans, replacement, overlap, adjacent fortnights and deletion', async () => {
  const { request } = setup();
  expect(await (await request()).json()).toBeNull();
  expect((await request('/me/plan', 'PUT', input)).status).toBe(200);
  expect((await request('/me/plan', 'PUT', { ...input, start_date: '2026-11-09' })).status).toBe(
    409,
  );
  expect((await request('/me/plan', 'PUT', { ...input, start_date: '2026-11-16' })).status).toBe(
    200,
  );
  expect((await request('/me/plan', 'PUT', { ...input, sessions: [] })).status).toBe(200);
  expect((await (await request()).json()).sessions).toEqual([]);
  expect((await request('/me/plan/2026-11-02', 'DELETE')).status).toBe(204);
  expect((await request('/me/plan/2026-11-02', 'DELETE')).status).toBe(404);
});
it('rejects malformed dates, enums, duplicates, bounds and rest/session conflicts', async () => {
  const { request } = setup();
  for (const body of [
    {},
    { ...input, start_date: '2026-11-03' },
    { ...input, sessions: [null] },
    { ...input, sessions: [{ ...input.sessions[0], distance_m: 0 }] },
    { ...input, sessions: [{ ...input.sessions[0], modality: 'swim' }] },
    { ...input, sessions: [input.sessions[0], input.sessions[0]] },
    { ...input, rest_days: [{ week: 1, day: 0 }] },
    { ...input, rest_days: [{ week: 1, day: 7 }] },
  ])
    expect((await request('/me/plan', 'PUT', body)).status).toBe(400);
  expect((await request('/me/plan?date=invalid')).status).toBe(400);
  expect((await request('/me/plan?user=user-2')).status).toBe(400);
});
it('matches owner entries once in slot order, ignores other users and recomputes with current factors', async () => {
  const { request, state } = setup();
  await request('/me/plan', 'PUT', {
    ...input,
    sessions: [input.sessions[0], { ...input.sessions[0], slot: 'PM1' }],
  });
  const body = {
    date: '2026-11-02',
    modality: 'erg',
    zone: 'E',
    distance_m: 9600,
    title: 'Steady Row',
    notes: '',
  };
  const saved = await (await request('/entries', 'POST', body)).json();
  let plan = await (await request()).json();
  expect(
    plan.sessions.map((row: { completed_entry_id: string | null }) => row.completed_entry_id),
  ).toEqual([saved.id, null]);
  expect(plan.sessions[0].note).toBe('Steady');
  expect(plan.planned_m).toEqual([24000, 0]);
  state.entries[0].user_id = 'user-2';
  plan = await (await request()).json();
  expect(
    plan.sessions.every(
      (row: { completed_entry_id: string | null }) => row.completed_entry_id === null,
    ),
  ).toBe(true);
  await request('/auth/login', 'POST', { email: state.users.at(-1)!.email, password: 'password' });
  expect(await (await request()).json()).toBeNull();
  expect((await request('/me/plan/2026-11-02', 'DELETE')).status).toBe(404);
  await request('/admin/settings', 'PATCH', { mode_factors: { erg: 2, bike: 1 / 3, run: 1.5 } });
  await request('/auth/login', 'POST', { email: state.users[0].email, password: 'password' });
  expect((await (await request()).json()).planned_m).toEqual([48000, 0]);
  await request('/auth/login', 'POST', { email: state.users[1].email, password: 'password' });
  expect(await (await request()).json()).toBeNull();
});
