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
let observers: { callback: IntersectionObserverCallback; target?: Element; margin?: string }[] = [];
let resizeCallbacks: (() => void)[] = [];
beforeEach(() => {
  observers = [];
  resizeCallbacks = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      entry: (typeof observers)[number];
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.entry = { callback, margin: options?.rootMargin };
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
  return { router, requests, mock };
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
  expect(cards.map((card) => card.getAttribute('data-medal'))).toEqual(['gold', 'gold', 'bronze']);
  expect(cards.map((c) => c.parentElement!.style.gridColumn)).toEqual(['2', '1', '3']);
  expect(cards[0].style.minHeight).toBe(cards[1].style.minHeight);
  expect(parseInt(cards[0].style.minHeight)).toBeGreaterThan(parseInt(cards[2].style.minHeight));
  const list = document.querySelector('ol[start="4"]')!;
  expect(list).not.toBeNull();
  const mine = within(list as HTMLElement).getByRole('link', { name: /Marcus Albrecht \(You\)/ });
  expect(mine.getAttribute('href')).toBe('/me');
  expect(mine.className).toContain('[background:var(--oyo-selected)]');
  expect(within(mine).getByText('You')).toBeTruthy();
  expect(within(mine).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('60');
  expect(cards[1].getAttribute('href')).toMatch(/^\/users\//);
  expect(screen.getAllByText(/\d+ week streak/).length).toBeGreaterThan(0);
  expect(within(cards[0]).getByText('Target Hit')).toBeTruthy();
  expect(screen.getByRole('radio', { name: '% of Target' }).getAttribute('aria-checked')).toBe(
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
  const { router, requests, mock } = setup();
  await screen.findByRole('list', { name: 'Top Three' });
  fireEvent.click(screen.getByRole('button', { name: 'Previous Week' }));
  expect(router.state.location.search).toBe('?week=2026-10-26');
  expect(await screen.findByText('Oct 26 – Nov 1')).toBeTruthy();
  expect(screen.getByText('Last Week')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Next Week' }) as HTMLButtonElement).disabled).toBe(
    false,
  );
  fireEvent.click(screen.getByRole('radio', { name: 'Meters' }));
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
  const seasonTotal = mock.state.entries
    .filter((e) => e.user_id === 'user-1' && e.date >= '2026-09-01' && e.date <= '2026-11-06')
    .reduce((total, e) => total + e.equiv_m, 0);
  expect(within(mine).getByText(seasonTotal.toLocaleString('en-US'))).toBeTruthy();
  expect(
    within(mine).getByText(`${Math.round((seasonTotal / 800000) * 100)}% of season target`),
  ).toBeTruthy();
});

it('clamps a future week from the URL to the current week', async () => {
  const { requests } = setup('/leaderboard?week=2027-01-04&metric=meters');
  await screen.findByRole('list', { name: 'Top Three' });
  expect(requests[0].searchParams.get('week')).toBe('2026-11-02');
  expect(screen.getByRole('radio', { name: 'Meters' }).getAttribute('aria-checked')).toBe('true');
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

it('keeps fewer than three rowers on the podium without placeholders', async () => {
  setup('/leaderboard', async (_url, rows) => json((await rows()).slice(0, 2)));
  const items = await screen.findAllByRole('listitem');
  expect(items).toHaveLength(2);
  expect(screen.getByRole('list', { name: 'Top Three' })).toBeTruthy();
  expect(document.querySelector('ol[start]')).toBeNull();
  expect((items[0] as HTMLElement).style.gridColumn).toBe('2');
  expect((items[1] as HTMLElement).style.gridColumn).toBe('1');
});
it('wraps long names at 360px and remeasures the pinned You row before swapping', async () => {
  vi.stubGlobal('innerWidth', 360);
  setup('/leaderboard', async (_url, rows) =>
    json(
      (await rows()).map((row, index) => ({
        ...row,
        rank: index + 4,
        user: {
          ...row.user,
          name: row.user.id === 'user-1' ? 'Raph Hardwick-Skottowe' : 'Philip Wolfensberger',
        },
      })),
    ),
  );
  const real = await screen.findByRole('link', { name: /Raph Hardwick-Skottowe \(You\)/ });
  const label = within(real).getByText('Raph Hardwick-Skottowe');
  expect(label.classList.contains('break-words')).toBe(true);
  expect(real.querySelector('.truncate, .line-clamp-2')).toBeNull();
  expect(screen.getAllByText('Philip Wolfensberger').length).toBeGreaterThan(0);
  const pin = document.querySelector('.leaderboard-pin') as HTMLElement;
  vi.spyOn(pin, 'getBoundingClientRect').mockReturnValue({ height: 128 } as DOMRect);
  act(() => resizeCallbacks.forEach((callback) => callback()));
  expect(observers.at(-1)?.margin).toBe('-0px 0px -128px 0px');
  act(() =>
    observers
      .at(-1)!
      .callback(
        [{ intersectionRatio: 0 } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
  );
  expect(pin.getAttribute('aria-hidden')).toBe('false');
  expect(within(pin).getByText('Raph Hardwick-Skottowe')).toBeTruthy();
  expect(within(pin).getByText('You')).toBeTruthy();
  expect(pin.querySelector('.truncate, .line-clamp-2')).toBeNull();
  vi.mocked(pin.getBoundingClientRect).mockReturnValue({ height: 152 } as DOMRect);
  act(() => resizeCallbacks.forEach((callback) => callback()));
  expect(observers.at(-1)?.margin).toBe('-0px 0px -152px 0px');
  act(() =>
    observers
      .at(-1)!
      .callback(
        [{ intersectionRatio: 1 } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
  );
  expect(pin.getAttribute('aria-hidden')).toBe('true');
});

it('shows the empty state and the load error state', async () => {
  setup('/leaderboard', () => json([]));
  expect(await screen.findByRole('heading', { name: 'No Rankings Yet' })).toBeTruthy();
  cleanup();
  setup('/leaderboard', () => Promise.reject(new TypeError('offline')));
  expect(await screen.findByText('Could Not Load This Screen', {}, { timeout: 4000 })).toBeTruthy();
});

it('holds the pinned row back while the podium sits in its strip', async () => {
  setup();
  const real = await screen.findByRole('link', { name: /Marcus Albrecht \(You\)/ });
  const pin = document.querySelector('.leaderboard-pin')!;
  const podium = screen.getByRole('list', { name: 'Top Three' });
  const fire = (target: Element, entry: Partial<IntersectionObserverEntry>) =>
    act(() =>
      observers
        .filter((o) => o.target === target)
        .at(-1)!
        .callback([entry as IntersectionObserverEntry], {} as IntersectionObserver),
    );
  fire(real, { intersectionRatio: 0, isIntersecting: false });
  fire(podium, { isIntersecting: true });
  expect(pin.classList.contains('is-visible')).toBe(false);
  expect(pin.getAttribute('aria-hidden')).toBe('true');
  fire(podium, { isIntersecting: false });
  expect(pin.classList.contains('is-visible')).toBe(true);
});
