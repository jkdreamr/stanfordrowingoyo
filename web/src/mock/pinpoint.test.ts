import { expect, it } from 'vitest';
import { createMockApi } from './handlers';

it('runs an artificial Pinpoint puzzle with persistent guesses and no Worker content', async () => {
  const mock = createMockApi({ now: () => new Date('2026-11-16T18:00:00Z') });
  const request = (path: string, method = 'GET', body?: unknown) =>
    mock.handle(
      new Request(`http://localhost/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  await request('/auth/login', 'POST', {
    email: mock.state.users.find((u) => u.role === 'admin')!.email,
    password: 'password',
  });
  expect(await (await request('/games/pinpoint/today')).json()).toMatchObject({
    clues: ['Demo alpha'],
    category: null,
    cluesUsed: 1,
  });
  expect((await request('/games/pinpoint/guess', 'POST', { guess: '!!!' })).status).toBe(400);
  expect(
    (await request('/games/pinpoint/guess', 'POST', { guess: 'Mock alphabet', date: '2026-11-15' }))
      .status,
  ).toBe(409);
  expect(
    await (await request('/games/pinpoint/guess', 'POST', { guess: '' })).json(),
  ).toMatchObject({ clues: ['Demo alpha', 'Demo beta'], cluesUsed: 2 });
  expect(
    await (await request('/games/pinpoint/guess', 'POST', { guess: 'Mock alphabet' })).json(),
  ).toMatchObject({ won: true, finished: true, cluesUsed: 2, category: 'Mock alphabet' });
  expect(await (await request('/games/pinpoint/results/me')).json()).toMatchObject({ score: 4 });
  expect((await request('/games/pinpoint/guess', 'POST', { guess: 'Mock alphabet' })).status).toBe(
    409,
  );
  expect((await request('/games/pinpoint/results', 'POST', { payload: {} })).status).toBe(405);
});
