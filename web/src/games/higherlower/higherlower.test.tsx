// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createMockApi } from '../../mock/handlers';
import { MOCK_HIGHERLOWER } from '../../mock/higherlower';
import { ToastProvider } from '../../components/ui';
import HigherLowerGame from './index';
import { HigherLowerPlay } from './HigherLowerPlay';

const DATE = '2026-11-16';
it('mock endpoints preserve hidden values, order, stale days and a single saved result', async () => {
  const mock = createMockApi({ now: () => new Date(DATE + 'T18:00:00Z'), session: 'user-1' });
  mock.state.entries = [];
  mock.state.myPlans = [];
  const request = (path: string, body?: unknown) =>
    mock.handle(
      new Request(
        'https://oyo.test/api/' + path,
        body === undefined
          ? {}
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            },
      ),
    );
  const guess = (body: unknown) => request('games/higherlower/guess', body);
  expect(await (await request('games/higherlower/today')).json()).toMatchObject({
    question: null,
    items: [],
    next: null,
  });
  expect((await guess({})).status).toBe(400);
  expect((await guess({ step: 0, choice: 'higher', date: DATE })).status).toBe(403);
  await request('entries', {
    date: DATE,
    modality: 'erg',
    zone: 'E',
    distance_m: 6000,
    title: 'Unlock',
    notes: '',
  });
  expect((await guess({ step: 20, choice: 'higher' })).status).toBe(400);
  expect((await guess({ step: 0, choice: 'higher', date: '2026-02-30' })).status).toBe(400);
  expect(
    await (await guess({ step: 0, choice: 'higher', date: '2026-11-15' })).json(),
  ).toMatchObject({ error: { code: 'DAY_CHANGED' } });
  expect(await (await guess({ step: 1, choice: 'higher' })).json()).toMatchObject({
    error: { code: 'OUT_OF_ORDER' },
  });
  expect(await (await guess({ step: 0, choice: 'higher', date: DATE })).json()).toMatchObject({
    step: 1,
    next: { value: null, display: null },
    results: [true],
  });
  expect(await (await guess({ step: 0, choice: 'higher' })).json()).toMatchObject({
    error: { code: 'OUT_OF_ORDER' },
  });
  expect(await (await request('games/higherlower/today')).json()).toMatchObject({ step: 1 });
  expect(await (await guess({ step: 1, choice: 'higher' })).json()).toMatchObject({
    finished: true,
    score: 1,
    results: [true, false],
  });
  expect(await (await guess({ step: 1, choice: 'higher' })).json()).toMatchObject({
    error: { code: 'ALREADY_PLAYED' },
  });
  expect(await (await request('games/higherlower/results/me')).json()).toMatchObject({ score: 1 });
  expect((await request('games/higherlower/results', { payload: {} })).status).toBe(405);
});
let client: QueryClient;
afterEach(() => {
  cleanup();
  client?.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function setup({
  locked = false,
  reduced = true,
  game = false,
  error = '',
  factYear = undefined as number | null | undefined,
} = {}) {
  vi.stubGlobal('matchMedia', () => ({
    matches: reduced,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const mock = createMockApi({ now: () => new Date(DATE + 'T18:00:00Z'), session: 'user-1' });
  mock.state.entries = [];
  mock.state.myPlans = [];
  if (!locked)
    await mock.handle(
      new Request('https://oyo.test/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: DATE,
          modality: 'erg',
          zone: 'E',
          distance_m: 6000,
          title: 'Unlock',
          notes: '',
        }),
      }),
    );
  const paths: string[] = [];
  let fail = error;
  vi.stubGlobal('fetch', async (url: URL, init: RequestInit) => {
    const request = new Request(String(url), init);
    paths.push(request.method + ' ' + new URL(request.url).pathname);
    if (request.method === 'POST' && request.url.endsWith('/higherlower/guess') && fail) {
      const code = fail;
      fail = '';
      if (code === 'NETWORK_ERROR') throw new TypeError('Offline');
      return new Response(JSON.stringify({ error: { code, message: 'Conflict' } }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const response = await mock.handle(request);
    if (request.url.endsWith('/higherlower/today') && factYear !== undefined) {
      const day = await response.json();
      day.items[0].asOf = factYear;
      return new Response(JSON.stringify(day), { headers: { 'Content-Type': 'application/json' } });
    }
    return response;
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const complete = vi.fn();
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ToastProvider>
          {game ? <HigherLowerGame /> : <HigherLowerPlay date={DATE} onComplete={complete} />}
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { mock, paths, complete };
}
it('locks without exposing the pair', async () => {
  await setup({ locked: true, game: true });
  expect(await screen.findByRole('link', { name: 'Log Workout' })).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Next Item' })).toBeNull();
});
it('uses sentence case, one category date caption and a neutral question mark', async () => {
  await setup();
  await screen.findByRole('heading', { name: 'Which practice town has more residents?' });
  expect(screen.getAllByText('2020 Census')).toHaveLength(1);
  expect(screen.queryByText(/As of 2020/i)).toBeNull();
  expect(screen.getByLabelText('Value Hidden').textContent).toBe('?');
});
it.each([
  [2019, 'As of 2019'],
  [null, 'Timeless'],
  [2020, null],
] as const)('shows a card date only for a differing override (%s)', async (factYear, label) => {
  await setup({ factYear });
  await screen.findByText('2020 Census');
  const card = within(screen.getByRole('region', { name: 'Current Item' }));
  if (label) expect(card.getByText(label)).toBeTruthy();
  else expect(card.queryByText(/As of/)).toBeNull();
});
it('reveals with a count-up, blocks double taps, announces, and advances focus', async () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.spyOn(performance, 'now').mockReturnValue(0);
  const { paths } = await setup({ reduced: false });
  const button = await screen.findByRole('button', { name: 'More Than Practice Town 1' });
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(frames.length).toBe(1));
  expect(button.hasAttribute('disabled')).toBe(true);
  act(() => frames.shift()!(400));
  expect(
    within(screen.getByRole('region', { name: 'Next Item' })).getByLabelText('1,663 people'),
  ).toBeTruthy();
  act(() => frames.shift()!(800));
  expect(screen.getByRole('status').textContent).toContain(
    'Correct. Practice Town 2, 1,900 people.',
  );
  await screen.findByRole('button', { name: 'More Than Practice Town 2' });
  act(() => frames.shift()?.(900));
  expect(document.activeElement?.tagName).toBe('H2');
  expect(paths.filter((p) => p === 'POST /api/games/higherlower/guess')).toHaveLength(1);
});
it('runs instantly with reduced motion and renders a perfect result and spoiler-free share', async () => {
  const copy = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  await setup({ game: true });
  for (let i = 0; i < 20; i++) {
    const choice = MOCK_HIGHERLOWER[i + 1].value > MOCK_HIGHERLOWER[i].value ? 'More' : 'Fewer';
    fireEvent.click(
      await screen.findByRole('button', { name: `${choice} Than Practice Town ${i + 1}` }),
    );
  }
  const result = await screen.findByRole('region', { name: 'Your Result' });
  expect(within(result).getByText('20 / 20')).toBeTruthy();
  expect(within(result).getByText('Perfect Run')).toBeTruthy();
  expect(within(result).getAllByRole('listitem')).toHaveLength(21);
  fireEvent.click(within(result).getByRole('button', { name: 'Share' }));
  await waitFor(() => expect(copy).toHaveBeenCalled());
  expect(copy.mock.calls[0][0]).toContain('20 / 20');
  expect(copy.mock.calls[0][0]).not.toContain('Practice Town');
});
it('shows the missed item in the result', async () => {
  await setup({ game: true });
  fireEvent.click(await screen.findByRole('button', { name: 'Fewer Than Practice Town 1' }));
  const result = await screen.findByRole('region', { name: 'Your Result' });
  expect(within(result).getByText('Missed on Practice Town 2')).toBeTruthy();
  expect(within(result).getAllByRole('listitem')).toHaveLength(2);
});
it('keeps the pair on network failure and allows retry', async () => {
  await setup({ error: 'NETWORK_ERROR' });
  fireEvent.click(await screen.findByRole('button', { name: 'More Than Practice Town 1' }));
  await screen.findByText('Could Not Send Guess. Try Again.');
  expect(screen.getByLabelText('Value Hidden')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'More Than Practice Town 1' }));
  await screen.findByRole('button', { name: 'More Than Practice Town 2' });
});
for (const error of ['DAY_CHANGED', 'OUT_OF_ORDER', 'ALREADY_PLAYED'])
  it(`refetches after ${error}`, async () => {
    const { paths } = await setup({ error });
    fireEvent.click(await screen.findByRole('button', { name: 'More Than Practice Town 1' }));
    await waitFor(() =>
      expect(paths.filter((p) => p === 'GET /api/games/higherlower/today').length).toBeGreaterThan(
        1,
      ),
    );
    if (error === 'DAY_CHANGED') expect(await screen.findByText('A New Day Is Ready')).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'More Than Practice Town 1' }).hasAttribute('disabled'),
      ).toBe(false),
    );
  });
