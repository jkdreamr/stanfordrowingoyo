import { expect, it } from 'vitest';
import type { WorldleDay } from '../../../shared/types';
import { createMockApi } from './handlers';

function setup() {
  const mock = createMockApi({ now: () => new Date('2026-11-16T18:00:00Z') });
  const request = (path: string, method = 'GET', body?: unknown) =>
    mock.handle(
      new Request('https://oyo.test/api' + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-OYO-CSRF': '1' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  const login = (role: 'admin' | 'rower') =>
    request('/auth/login', 'POST', {
      email: mock.state.users.find((u) => u.role === role)!.email,
      password: 'password',
    });
  return { request, login, state: mock.state };
}

it('uses an artificial mock answer, canonical aliases, spoiler-free progress and dedicated submission', async () => {
  const { request, login } = setup();
  await login('admin');
  const day = (await (await request('/games/worldle/today')).json()) as WorldleDay;
  expect(day).toMatchObject({
    access: { reason: 'staff' },
    shape: '0000000000000000',
    answer: null,
    guesses: [],
    done: false,
  });
  expect(JSON.stringify(day)).not.toContain('Mock Island');
  expect((await request('/games/worldle/guess', 'POST', { guess: 'Atlantis' })).status).toBe(400);
  expect(
    (await request('/games/worldle/guess', 'POST', { guess: 'USA', date: '2026-11-15' })).status,
  ).toBe(409);
  expect((await request('/games/worldle/guess', 'POST', { guess: 'USA' })).status).toBe(200);
  expect((await request('/games/worldle/guess', 'POST', { guess: 'America' })).status).toBe(400);
  expect(await (await request('/games/worldle/today')).json()).toMatchObject({
    answer: null,
    guesses: [{ name: 'United States' }],
  });
  expect((await request('/games/worldle/results', 'POST', { payload: {} })).status).toBe(405);
  const win = await request('/games/worldle/guess', 'POST', { guess: 'Mock Island' });
  expect(win.status).toBe(200);
  expect(await win.json()).toMatchObject({
    done: true,
    won: true,
    answer: { name: 'Mock Island', lat: 0, lon: 0 },
  });
  expect(await (await request('/games/worldle/results/me')).json()).toMatchObject({
    score: 5,
    payload: { solved: true, tries: 2, answer: 'Mock Island' },
  });
  expect((await request('/games/worldle/guess', 'POST', { guess: 'Mock Island' })).status).toBe(
    409,
  );
});

it('reveals an artificial loss after six misses', async () => {
  const { request, login } = setup();
  await login('admin');
  for (const guess of ['France', 'Germany', 'Spain', 'Portugal', 'Canada', 'USA'])
    expect((await request('/games/worldle/guess', 'POST', { guess })).status).toBe(200);
  expect(await (await request('/games/worldle/today')).json()).toMatchObject({
    done: true,
    won: false,
    answer: { name: 'Mock Island' },
  });
  expect(await (await request('/games/worldle/results/me')).json()).toMatchObject({ score: 0 });
});

it('does not expose the mock shape or accept guesses while locked', async () => {
  const { request, login, state } = setup();
  state.entries.length = 0;
  await login('rower');
  expect(await (await request('/games/worldle/today')).json()).toMatchObject({
    shape: null,
    answer: null,
    guesses: [],
    access: { unlocked: false },
  });
  expect((await request('/games/worldle/guess', 'POST', { guess: 'USA' })).status).toBe(403);
});
