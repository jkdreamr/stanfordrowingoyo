// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createQueryClient } from '../lib/queryClient';
import { createMockApi } from '../mock/handlers';
import { ToastProvider } from '../components/ui';
import { perceptionPuzzle } from '../../../shared/games/perception';
import { DailyGameFrame } from './DailyGameFrame';

const client = createQueryClient();
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('scrollTo', () => {});
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
});
function mount(role: 'rower' | 'coach') {
  const mock = createMockApi({ now: () => new Date('2026-03-18T18:00:00Z'), session: 'user-1' });
  mock.state.entries = [];
  mock.state.myPlans = [];
  mock.state.users.find((user) => user.id === 'user-1')!.role = role;
  client.setDefaultOptions({ queries: { retry: false } });
  vi.stubGlobal('fetch', (url: URL, init: RequestInit) =>
    mock.handle(new Request(String(url), init)),
  );
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <DailyGameFrame<{ answer: unknown }>
            gameId="perception"
            title="Perception"
            play={({ date, onComplete }) => (
              <button
                type="button"
                onClick={() =>
                  onComplete({ answer: { ...perceptionPuzzle(date), reactionMs: 150 } })
                }
              >
                Finish
              </button>
            )}
            summarize={(result) => ({ headline: `Score ${result.score}`, share: 'shared text' })}
          />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return mock;
}
it('gates locked rowers before play', async () => {
  mount('rower');
  expect(await screen.findByText('Games Locked')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Finish' })).toBeNull();
});
it('submits once, then shows the server result, share and day board', async () => {
  const share = vi.fn(() => Promise.resolve());
  vi.stubGlobal('navigator', { ...navigator, share });
  mount('coach');
  fireEvent.click(await screen.findByRole('button', { name: 'Finish' }));
  expect(await screen.findByText('Score 500')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Share' }));
  expect(share).toHaveBeenCalledWith({ title: 'Perception', text: 'shared text' });
  await waitFor(() =>
    expect(screen.getByRole('region', { name: 'Perception Day Board' }).textContent).toContain(
      '1 Players',
    ),
  );
});
