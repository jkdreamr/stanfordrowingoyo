// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { LeaderboardRow } from '../../../shared/types';
import { createQueryClient } from '../lib/queryClient';
import { createMockApi } from '../mock/handlers';
import Leaderboard from './Leaderboard';

const clients: ReturnType<typeof createQueryClient>[] = [];
let observers: { callback: IntersectionObserverCallback; target?: Element }[] = [];
beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      entry: (typeof observers)[number];
      constructor(callback: IntersectionObserverCallback) {
        this.entry = { callback };
        observers.push(this.entry);
      }
      observe(target: Element) {
        this.entry.target = target;
      }
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  clients.forEach((c) => c.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
});
function setup(
  path = '/leaderboard',
  rows?: (url: URL, mockRows: () => Promise<LeaderboardRow[]>) => Promise<Response>,
) {
  const mock = createMockApi({ now: () => new Date('2026-11-06T18:00:00Z') });
  const requests: URL[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: URL | string, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/leaderboard') {
        requests.push(url);
        if (rows) return rows(url, async () => (await mock.handle(new Request(url, init))).json());
      }
      return mock.handle(new Request(url, init));
    }),
  );
  const client = createQueryClient();
  clients.push(client);
  const router = createMemoryRouter(
    [
      { path: '/leaderboard', element: <Leaderboard /> },
      { path: '/me', element: <h1>My Profile</h1> },
      { path: '/users/:id', element: <h1>Teammate Profile</h1> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, requests };
}
const json = (body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }),
  );

it('shows a 1-2-3 podium, a list from rank 4 and highlights my row', async () => {
  const { requests } = setup();
  const podium = await screen.findByRole('list', { name: 'Top Three' });
  const cards = within(podium).getAllByRole('link');
  expect(cards.map((c) => c.getAttribute('aria-label')?.split(',')[0])).toEqual([
    'Rank 1',
    'Rank 1',
    'Rank 3',
  ]);
  expect(cards[0].className).toContain('border-t-accent');
  expect(cards[2].className).not.toContain('border-t-accent');
  const list = document.querySelector('ol[start="4"]')!;
  expect(list).not.toBeNull();
  const mine = within(list as HTMLElement).getByRole('link', { name: /Marcus Albrecht \(You\)/ });
  expect(mine.getAttribute('href')).toBe('/me');
  expect(mine.className).toContain('[background:var(--oyo-selected)]');
  expect(within(mine).getByText('You')).toBeTruthy();
  expect(within(mine).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('60');
  expect(cards[1].getAttribute('href')).toMatch(/^\/users\//);
  expect(within(cards[0]).getByText('2 week streak')).toBeTruthy();
  expect(within(cards[0]).getByText('Target Hit')).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'This Week %' }).getAttribute('aria-checked')).toBe(
    'true',
  );
  expect((screen.getByRole('button', { name: 'Next Week' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(screen.getByText('Nov 2 – 8')).toBeTruthy();
  expect(screen.getByText('This Week')).toBeTruthy();
  expect(requests[0].searchParams.get('week')).toBe('2026-11-02');
  expect(requests[0].searchParams.get('metric')).toBe('percent');
});

it('keeps metric and week in the URL and hides the switcher for season', async () => {
  const { router, requests } = setup();
  await screen.findByRole('list', { name: 'Top Three' });
  fireEvent.click(screen.getByRole('button', { name: 'Previous Week' }));
  expect(router.state.location.search).toBe('?week=2026-10-26');
  expect(await screen.findByText('Oct 26 – Nov 1')).toBeTruthy();
  expect(screen.getByText('Last Week')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Next Week' }) as HTMLButtonElement).disabled).toBe(
    false,
  );
  fireEvent.click(screen.getByRole('radio', { name: 'This Week Meters' }));
  expect(router.state.location.search).toBe('?week=2026-10-26&metric=meters');
  fireEvent.click(screen.getByRole('button', { name: 'Next Week' }));
  expect(router.state.location.search).toBe('?metric=meters');
  fireEvent.click(screen.getByRole('radio', { name: 'Season' }));
  expect(await screen.findByText('2026–27 Season')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Previous Week' })).toBeNull();
  const last = requests.at(-1)!;
  expect(last.searchParams.get('metric')).toBe('season');
  expect(last.searchParams.has('week')).toBe(false);
  const mine = await screen.findByRole('link', { name: /Marcus Albrecht \(You\)/ });
  expect(within(mine).getByText('605,560')).toBeTruthy();
  expect(within(mine).getByText('75% of season target')).toBeTruthy();
});

it('clamps a future week from the URL to the current week', async () => {
  const { requests } = setup('/leaderboard?week=2027-01-04&metric=meters');
  await screen.findByRole('list', { name: 'Top Three' });
  expect(requests[0].searchParams.get('week')).toBe('2026-11-02');
  expect(screen.getByRole('radio', { name: 'This Week Meters' }).getAttribute('aria-checked')).toBe(
    'true',
  );
});

it('pins my row only while my real row is off-screen', async () => {
  setup();
  const real = await screen.findByRole('link', { name: /Marcus Albrecht \(You\)/ });
  const pin = document.querySelector('.leaderboard-pin')!;
  expect(pin.classList.contains('is-visible')).toBe(false);
  const observer = observers.find((o) => o.target === real)!;
  expect(observer).toBeTruthy();
  const fire = (ratio: number) =>
    act(() =>
      observer.callback(
        [{ intersectionRatio: ratio, isIntersecting: ratio > 0 } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
  fire(0);
  expect(pin.classList.contains('is-visible')).toBe(true);
  expect(pin.getAttribute('aria-hidden')).toBe('false');
  expect(
    within(pin as HTMLElement)
      .getByRole('link')
      .getAttribute('href'),
  ).toBe('/me');
  fire(1);
  expect(pin.classList.contains('is-visible')).toBe(false);
});

it('shows only the list without podium placeholders when fewer than three rank', async () => {
  setup('/leaderboard', async (_url, rows) => json((await rows()).slice(0, 2)));
  const items = await screen.findAllByRole('listitem');
  expect(items).toHaveLength(2);
  expect(screen.queryByRole('list', { name: 'Top Three' })).toBeNull();
  expect(document.querySelector('ol')!.getAttribute('start')).toBe('1');
  expect(document.querySelector('.leaderboard-pin')).toBeNull();
});

it('shows the empty state and the load error state', async () => {
  setup('/leaderboard', () => json([]));
  expect(await screen.findByText('No Rankings Yet')).toBeTruthy();
  expect(screen.getByText('Rankings appear after eligible teammates log workouts.')).toBeTruthy();
  cleanup();
  setup('/leaderboard', () => Promise.reject(new TypeError('offline')));
  expect(await screen.findByText('Could Not Load This Screen', {}, { timeout: 4000 })).toBeTruthy();
});
