// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DiveDay } from '../../../../shared/types';
import { api } from '../../lib/api';
import Dive from './Dive';
const { identity } = vi.hoisted(() => ({ identity: { id: 'staff', role: 'coach' } }));
vi.mock('../../lib/api', () => ({ api: vi.fn() }));
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
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  vi.mocked(api).mockResolvedValue(day);
  render(
    <QueryClientProvider client={client}>
      <Dive />
    </QueryClientProvider>,
  );
}
it('uses the staff day endpoint to show moderation without requiring staff to play', async () => {
  identity.role = 'coach';
  mount();
  expect(await screen.findByRole('button', { name: 'Hide Apple' })).toBeTruthy();
  expect(api).toHaveBeenCalledWith('GET /api/games/dive/days/:date', {
    params: { date: day.date },
    signal: expect.any(AbortSignal),
  });
});
it('keeps rowers on the completion-gated today endpoint', async () => {
  identity.role = 'rower';
  mount();
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith('GET /api/games/dive/today', {
      signal: expect.any(AbortSignal),
    }),
  );
  expect(screen.queryByRole('button', { name: 'Hide Apple' })).toBeNull();
});
