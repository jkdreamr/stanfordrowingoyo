// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DiveDay } from '../../../../shared/types';
import { api } from '../../lib/api';
import Dive from './Dive';
import { ToastProvider } from '../../components/ui';
const { identity } = vi.hoisted(() => ({ identity: { id: 'staff', role: 'coach' } }));
vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  api: vi.fn(),
}));
vi.mock('../../lib/queries', () => ({
  qk: { root: () => ['games'] },
  useMe: () => ({ data: identity }),
}));
vi.mock('../useGameAccess', () => ({
  useGameAccess: () => ({ data: { unlocked: true, date: '2026-11-07' } }),
}));
vi.mock('../GameDayBoard', () => ({ GameDayBoard: () => null }));
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.mocked(api).mockReset();
  localStorage.clear();
});
const day: DiveDay = {
  date: '2026-11-07',
  access: { unlocked: true, reason: 'staff', date: '2026-11-07' },
  prompts: ['Name a fruit.'],
  answers: [],
  complete: false,
  score: 0,
  verdict: 'High And Dry',
  result: null,
  reveal: [
    {
      prompt_index: 0,
      prompt: 'Name a fruit.',
      groups: [
        {
          normalized: 'apple',
          canonical: 'Apple',
          answer: 'Apple',
          count: 1,
          points: 10,
          tier: 'surface',
          hidden: false,
          mine: false,
          only_you: false,
          teammates: [{ user_id: 'rower', name: 'Alex' }],
        },
      ],
    },
  ],
};
function mount(data = day) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  vi.mocked(api).mockImplementation(
    async (endpoint) =>
      (endpoint === 'POST /api/games/dive/start'
        ? { prompt_index: 0, deadline_ms_remaining: data.pending?.deadline_ms_remaining ?? 25000 }
        : data) as never,
  );
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <Dive />
      </ToastProvider>
    </QueryClientProvider>,
  );
}
it('uses the admin day endpoint to show moderation without requiring admin to play', async () => {
  identity.role = 'admin';
  mount();
  expect(await screen.findByRole('button', { name: 'Hide Apple' })).toBeTruthy();
  expect(api).toHaveBeenCalledWith('GET /api/games/dive/days/:date', {
    params: { date: day.date },
    signal: expect.any(AbortSignal),
  });
});
it.each(['rower', 'coxswain', 'coach'])(
  'keeps %s on the completion-gated today endpoint',
  async (role) => {
    identity.role = role;
    mount();
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('GET /api/games/dive/today', {
        signal: expect.any(AbortSignal),
      }),
    );
    expect(screen.queryByRole('button', { name: 'Hide Apple' })).toBeNull();
  },
);

it.each(['coxswain', 'coach'])(
  'allows %s moderation only in the completed reveal',
  async (role) => {
    identity.role = role;
    mount({ ...day, complete: true });
    expect(await screen.findByRole('button', { name: 'Hide Apple' })).toBeTruthy();
  },
);

it('opens the active prompt and restores its pending suggestion from the day without localStorage', async () => {
  identity.role = 'rower';
  mount({
    ...day,
    pending: {
      prompt_index: 0,
      deadline_ms_remaining: 14000,
      suggestion: 'Dry Tortugas',
      attempts_left: 3,
    },
  });
  expect(await screen.findByRole('button', { name: 'Yes' })).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe('Did you mean Dry Tortugas?3 guesses left');
  expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('14 Seconds Left');
  expect(screen.queryByRole('button', { name: 'Begin' })).toBeNull();
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith('POST /api/games/dive/start', { body: { prompt_index: 0 } }),
  );
});
