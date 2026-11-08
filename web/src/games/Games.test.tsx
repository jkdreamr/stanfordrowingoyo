// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { createQueryClient } from '../lib/queryClient';
import { createMockApi } from '../mock/handlers';
import { GameDayBoard } from './GameDayBoard';
import Games from '../pages/Games';
import GamesLeaderboard from '../pages/GamesLeaderboard';
import DiveStart from './DiveStart';
import { GamesCard } from './GamesCard';

const clients: ReturnType<typeof createQueryClient>[] = [];
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
function mount(node: ReactNode, fail = false) {
  const mock = createMockApi({ now: () => new Date('2026-03-18T18:00:00Z'), session: 'user-1' });
  mock.state.entries = [];
  mock.state.myPlans = [];
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  clients.push(client);
  vi.stubGlobal('fetch', (url: URL, init: RequestInit) =>
    fail
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
  expect((await screen.findByRole('link', { name: 'Log a Workout' })).getAttribute('href')).toBe(
    '/log',
  );
  expect(screen.getByRole('link', { name: /Dive/ }).getAttribute('href')).toBe('/games/dive');
  expect(screen.getByRole('link', { name: /Dive/ }).querySelector('.lucide-anchor')).toBeTruthy();
  expect(await screen.findByText('No Games Played Yet')).toBeTruthy();
});
it('distinguishes the Home games card from training with a gamepad icon', async () => {
  mount(<GamesCard />);
  const card = await screen.findByRole('link', { name: /Daily Games/ });
  expect(card.querySelector('.lucide-gamepad2')).toBeTruthy();
  expect(card.querySelector('.lucide-waves')).toBeNull();
});
it('renders the unlocked Dive start surface for staff', async () => {
  const { mock } = mount(<DiveStart />);
  mock.state.users.find((user) => user.id === 'user-1')!.role = 'coach';
  expect(await screen.findByRole('heading', { name: 'Dive' })).toBeTruthy();
  expect(screen.queryByText('Games Locked')).toBeNull();
});
it('shows the PLAY_FIRST state without leaking board rows', async () => {
  mount(<GameDayBoard gameId="dive" date="2026-03-18" />);
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
  expect(await screen.findByText('No Results Yet')).toBeTruthy();
  expect(next.disabled).toBe(false);
  fireEvent.click(next);
  expect(await screen.findByText('Today', { exact: true })).toBeTruthy();
  expect(next.disabled).toBe(true);
});
