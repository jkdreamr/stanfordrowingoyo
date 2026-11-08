// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Prompt, deadlineKey, savedDeadline } from './Prompt';

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  api: vi.fn(),
}));
const clients: QueryClient[] = [];
const key = deadlineKey('u1', '2026-11-07', 0);
const onSaved = vi.fn();
const result = {
  prompt_index: 0,
  answer: 'Oar',
  points: 100,
  tier: 'gem' as const,
  canonical: 'Oar',
  gem: { answer: 'Oar', tier: 'gem' as const, points: 100 },
  notable: [],
  count: 1,
  total: 1,
  hidden: false,
};
function mount() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <Prompt
        index={0}
        prompt="Name a part of a rowing shell."
        storageKey={key}
        onSaved={onSaved}
        onConflict={async () => {}}
      />
    </QueryClientProvider>,
  );
}
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20);
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-07T18:00:00Z'));
  localStorage.clear();
  vi.mocked(api).mockReset();
  onSaved.mockReset();
  vi.mocked(api).mockResolvedValue(result);
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.useRealTimers();
});
it('submits a trimmed answer once and shows the provisional result', async () => {
  mount();
  expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('25 Seconds Left');
  fireEvent.change(screen.getByLabelText('Your Answer'), { target: { value: '  Oar  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Dive' }));
  await settle();
  expect(api).toHaveBeenCalledWith('POST /api/games/dive/answers', {
    body: { prompt_index: 0, answer: 'Oar' },
  });
  expect(onSaved.mock.calls[0][0]).toEqual(result);
});
it('keeps the original deadline after remount and submits one empty timeout answer', async () => {
  const first = mount();
  const deadline = savedDeadline(key);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(11000);
  });
  first.unmount();
  mount();
  expect(savedDeadline(key)).toBe(deadline);
  expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('14 Seconds Left');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15000);
  });
  expect(api).toHaveBeenCalledTimes(1);
  expect(api).toHaveBeenCalledWith('POST /api/games/dive/answers', {
    body: { prompt_index: 0, answer: '' },
  });
});
it('expires immediately on reload after the deadline and lets failed timeouts retry', async () => {
  localStorage.setItem(key, String(Date.now() - 100));
  vi.mocked(api).mockRejectedValueOnce(new Error('No connection. Try again.'));
  mount();
  await settle();
  expect(screen.getByRole('alert').textContent).toBe('No connection. Try again.');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await settle();
  expect(api).toHaveBeenCalledTimes(2);
  expect(vi.mocked(api).mock.calls[1]).toEqual([
    'POST /api/games/dive/answers',
    { body: { prompt_index: 0, answer: '' } },
  ]);
});
it('uses independent deadline keys per player, date and prompt and tolerates unavailable storage', () => {
  expect(
    new Set([
      key,
      deadlineKey('u2', '2026-11-07', 0),
      deadlineKey('u1', '2026-11-08', 0),
      deadlineKey('u1', '2026-11-07', 1),
    ]).size,
  ).toBe(4);
  const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Denied');
  });
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Denied');
  });
  mount();
  expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('25 Seconds Left');
  get.mockRestore();
  set.mockRestore();
});
