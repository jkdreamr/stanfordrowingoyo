// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createMockApi } from '../mock/handlers';
import { qk, useCreateEntry } from '../lib/queries';
import { ToastProvider } from '../components/ui';
import { GamesCard } from './GamesCard';
import WordGuessGame from './wordguess';
import ConnectionsGame from './connections';
import PerceptionGame from './perception';

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
afterEach(() => {
  cleanup();
  client.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});
function SaveWorkout() {
  const save = useCreateEntry();
  return (
    <button
      onClick={() =>
        save.mutate({
          body: {
            date: '2026-03-18',
            modality: 'erg',
            zone: 'E',
            distance_m: 6000,
            title: 'Unlock',
            notes: '',
            visibility: 'team',
          },
        })
      }
    >
      Save Workout
    </button>
  );
}
it('refreshes cached server days and unlocks all game flows after a workout save', async () => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  const mock = createMockApi({ now: () => new Date('2026-03-18T18:00:00Z'), session: 'user-1' });
  mock.state.entries = [];
  mock.state.myPlans = [];
  const requests: string[] = [];
  vi.stubGlobal('fetch', (url: URL, init: RequestInit) => {
    const request = new Request(String(url), init);
    requests.push(new URL(request.url).pathname);
    return mock.handle(request);
  });
  for (const game of ['wordguess', 'connections']) {
    const data = await (await fetch('https://oyo.test/api/games/' + game + '/today')).json();
    expect(data.access.unlocked).toBe(false);
    client.setQueryData([...qk.root('games'), game, '2026-03-18'], data);
  }
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <GamesCard />
          <WordGuessGame />
          <ConnectionsGame />
          <PerceptionGame />
          <SaveWorkout />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  await screen.findAllByRole('link', { name: 'Log Workout' });
  fireEvent.click(screen.getByRole('button', { name: 'Save Workout' }));
  expect(await screen.findByRole('group', { name: 'Words' })).toBeTruthy();
  expect(await screen.findByRole('grid', { name: 'Word Guess Board' })).toBeTruthy();
  await waitFor(() => expect(requests).toContain('/api/games/perception/today'));
  for (const game of ['wordguess', 'connections']) {
    expect(
      requests.filter((path) => path === '/api/games/' + game + '/today').length,
    ).toBeGreaterThan(1);
    expect(client.getQueryData([...qk.root('games'), game, '2026-03-18'])).toMatchObject({
      access: { unlocked: true },
    });
  }
  expect(screen.getByRole('group', { name: 'Words' }).querySelectorAll('button')).toHaveLength(16);
  expect(screen.queryByRole('link', { name: 'Log Workout' })).toBeNull();
});
