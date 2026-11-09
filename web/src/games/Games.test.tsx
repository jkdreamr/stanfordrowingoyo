// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { createQueryClient } from '../lib/queryClient';
import { createMockApi } from '../mock/handlers';
import { GameDayBoard } from './GameDayBoard';
import Games from '../pages/Games';
import GamesLeaderboard from '../pages/GamesLeaderboard';
import DiveStart from './DiveStart';
import { GAMES as ALL_GAMES } from './registry';
import { GamesCard } from './GamesCard';
import { GameWeekBoard } from './GameWeekBoard';

const clients: ReturnType<typeof createQueryClient>[] = [];
const GAMES = ALL_GAMES.filter((game) => game.id !== 'dive');
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
});
function mount(node: ReactNode, fail = false, responses: Record<string, unknown> = {}) {
  const mock = createMockApi({ now: () => new Date('2026-03-18T18:00:00Z'), session: 'user-1' });
  mock.state.entries = [];
  mock.state.myPlans = [];
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  clients.push(client);
  vi.stubGlobal('fetch', (url: URL, init: RequestInit) =>
    responses[new URL(url).pathname]
      ? Promise.resolve(Response.json(responses[new URL(url).pathname]))
      : fail
        ? Promise.resolve(new Response(null, { status: 500 }))
        : mock.handle(new Request(String(url), init)),
  );
  return {
    mock,
    ...render(
      <MemoryRouter>
        <QueryClientProvider client={client}>{node}</QueryClientProvider>
      </MemoryRouter>,
    ),
  };
}
it('shows a locked hub with a workout CTA, registered game and empty weekly board', async () => {
  mount(<Games />);
  expect((await screen.findByRole('link', { name: 'Log Workout' })).getAttribute('href')).toBe(
    '/log',
  );
  expect(screen.queryByRole('link', { name: /Dive/ })).toBeNull();
  expect(screen.getByRole('heading', { name: 'Daily Puzzles' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Arcade' })).toBeTruthy();
  expect(
    within(screen.getByRole('region', { name: 'Arcade' })).getByRole('link', {
      name: /Chicken Crossing/,
    }),
  ).toBeTruthy();
  for (const game of GAMES)
    expect(screen.getByRole('link', { name: new RegExp(game.title) }).getAttribute('href')).toBe(
      `/games/${game.id}`,
    );
  expect(await screen.findByText('No Games Played Yet')).toBeTruthy();
});
it('distinguishes the Home games card from training with a gamepad icon', async () => {
  mount(<GamesCard />);
  const card = await screen.findByRole('link', { name: /Daily Games/ });
  expect(card.querySelector('.lucide-gamepad2')).toBeTruthy();
  expect(card.querySelector('.lucide-waves')).toBeNull();
  expect(screen.queryByText(/Dive/)).toBeNull();
});
it('hides Arcade when no arcade games are enabled', async () => {
  mount(<Games />, false, {
    '/api/games': {
      date: '2026-03-18',
      access: { date: '2026-03-18', unlocked: true, reason: 'staff' },
      streak: { current: 0, best: 0 },
      games: [{ id: 'wordguess', direction: 'higher' }],
      results: [],
    },
  });
  await screen.findByRole('heading', { name: 'Daily Puzzles' });
  expect(screen.queryByRole('heading', { name: 'Arcade' })).toBeNull();
});
it('shows an arcade best score instead of Play in the hub', async () => {
  mount(<Games />, false, {
    '/api/games': {
      date: '2026-03-18',
      access: { date: '2026-03-18', unlocked: true, reason: 'staff' },
      streak: { current: 1, best: 1 },
      games: [{ id: 'chicken-crossing', direction: 'higher' }],
      results: [{ game_id: 'chicken-crossing', score: 87 }],
    },
  });
  const row = await screen.findByRole('link', { name: /Chicken Crossing/ });
  expect(row.textContent).toContain('87 pts');
  expect(row.textContent).not.toContain('Play');
});
it.skip('Dive disabled for launch: renders the unlocked Dive start surface for staff', async () => {
  const { mock } = mount(<DiveStart />);
  mock.state.users.find((user) => user.id === 'user-1')!.role = 'coach';
  expect(await screen.findByRole('heading', { name: 'Dive' })).toBeTruthy();
  expect(screen.queryByText("Log today's OYO to unlock")).toBeNull();
});
it('shows the PLAY_FIRST state without leaking board rows', async () => {
  mount(<GameDayBoard gameId="wordguess" date="2026-03-18" />);
  expect(await screen.findByText('Play To See Today’s Board')).toBeTruthy();
});
it('provides a retry action when hub loading fails', async () => {
  mount(<Games />, true);
  expect(await screen.findByRole('button', { name: 'Try Again' })).toBeTruthy();
});
it('navigates board dates without future days and displays a short week range', async () => {
  mount(<GamesLeaderboard />);
  expect(await screen.findByText('Mar 16 – 22')).toBeTruthy();
  const next = screen.getByRole('button', { name: 'Next Day' }) as HTMLButtonElement;
  expect(next.disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Previous Day' }));
  expect(await screen.findByText('Tue, Mar 17')).toBeTruthy();
  expect(await screen.findAllByText('Play To See This Day’s Board')).toHaveLength(GAMES.length);
  expect(next.disabled).toBe(false);
  fireEvent.click(next);
  expect(await screen.findByText('Today', { exact: true })).toBeTruthy();
  expect(next.disabled).toBe(true);
});

it.each(['coxswain', 'coach'] as const)('keeps %s boards gated in mock mode too', async (role) => {
  const { mock } = mount(<GameDayBoard gameId="wordguess" date="2026-03-18" />);
  mock.state.users.find((u) => u.id === 'user-1')!.role = role;
  expect(await screen.findByText('Play To See Today’s Board')).toBeTruthy();
});
it.each(['coxswain', 'coach'] as const)(
  'labels every locked %s daily board with its game',
  async (role) => {
    const { mock } = mount(<GamesLeaderboard />);
    mock.state.users.find((user) => user.id === 'user-1')!.role = role;
    await screen.findAllByText('Play To See Today’s Board');
    expect(screen.queryByRole('region', { name: 'Dive Day Board' })).toBeNull();
    expect(screen.getAllByRole('region', { name: / Day Board$/ })).toHaveLength(GAMES.length);
    for (const game of GAMES) {
      const board = within(screen.getByRole('region', { name: `${game.title} Day Board` }));
      expect(board.getByRole('heading', { name: game.title })).toBeTruthy();
      expect(board.getByText('Play To See Today’s Board')).toBeTruthy();
      expect(board.queryByRole('link')).toBeNull();
    }
  },
);

it.each([0, 1, 2])('pluralizes a daily board with %i players', async (players) => {
  mount(<GameDayBoard gameId="wordguess" date="2026-03-18" />, false, {
    '/api/games/wordguess/leaderboard': { date: '2026-03-18', final: false, players, rows: [] },
  });
  expect(
    await screen.findByText(`Live · ${players} ${players === 1 ? 'Player' : 'Players'}`),
  ).toBeTruthy();
});
it.each([0, 1, 2])('pluralizes a weekly board with %i points and days', async (points) => {
  mount(<GameWeekBoard />, false, {
    '/api/games/leaderboard': {
      week_start: '2026-03-16',
      rows: [{ rank: 1, user: { id: 'player', name: 'A Player' }, points, days: points, me: true }],
    },
  });
  expect(await screen.findByText(`${points} ${points === 1 ? 'pt' : 'pts'}`)).toBeTruthy();
  expect(screen.getByText(`${points} ${points === 1 ? 'Day' : 'Days'}`)).toBeTruthy();
});
it('lets admins view past boards without playing', async () => {
  const { mock } = mount(<GamesLeaderboard />);
  mock.state.users.find((u) => u.id === 'user-1')!.role = 'admin';
  await screen.findByText('Mar 16 – 22');
  fireEvent.click(screen.getByRole('button', { name: 'Previous Day' }));
  await waitFor(() => expect(screen.getAllByText('No Results Yet')).toHaveLength(GAMES.length));
});
