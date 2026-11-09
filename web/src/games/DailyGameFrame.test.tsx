// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createQueryClient } from '../lib/queryClient';
import { createMockApi } from '../mock/handlers';
import { ToastProvider } from '../components/ui';
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
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <DailyGameFrame<{ answer: unknown }>
            gameId="perception"
            title="Perception"
            serverComplete
            play={({ onComplete }) => (
              <button type="button" onClick={() => onComplete({ answer: {} })}>
                Finish
              </button>
            )}
            summarize={(result) => ({ headline: `Score ${result.score}`, share: 'shared text' })}
          />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
async function finishPerception() {
  for (let round = 0; round < 5; round++) {
    await fetch('https://oyo.test/api/games/perception/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round }),
    });
    await fetch('https://oyo.test/api/games/perception/today');
  }
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
  await screen.findByText('Score 0');
}
it('gates locked rowers before play', async () => {
  mount('rower');
  expect(await screen.findByText("Log today's OYO to unlock")).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Finish' })).toBeNull();
});
it('loads the server-completed result once, then shows the server result, share and day board', async () => {
  const share = vi.fn(() => Promise.resolve());
  vi.stubGlobal('navigator', { ...navigator, share });
  mount('coach');
  await screen.findByRole('button', { name: 'Finish' });
  await finishPerception();
  expect(await screen.findByText('Score 0')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Share' }));
  expect(share).toHaveBeenCalledWith({
    title: 'Perception',
    text: 'shared text\nhttps://stanford-oyo.joskoo.workers.dev',
  });
  await waitFor(() =>
    expect(screen.getByRole('region', { name: 'Perception Day Board' }).textContent).toContain(
      '1 Player',
    ),
  );
});

it.each([
  { name: 'undefined', value: undefined },
  { name: 'a scroll-completion promise', value: Promise.resolve() },
])('unmounts completed results when scrollTo returns $name', async ({ value }) => {
  const scrollTo = vi.fn(() => value);
  vi.stubGlobal('scrollTo', scrollTo);
  const view = mount('coach');
  await screen.findByRole('button', { name: 'Finish' });
  await finishPerception();
  expect(scrollTo).toHaveBeenCalledWith(0, 0);
  expect(() => view.unmount()).not.toThrow();
});
