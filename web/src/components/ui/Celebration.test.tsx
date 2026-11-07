// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { User } from '../../../../shared/types';
import {
  clearCelebration,
  pendingCelebration,
  recordCelebration,
  type Achievement,
} from '../../lib/celebrations';
import { Celebration } from './Celebration';
import { ToastProvider } from './Toast';

const mutate = vi.hoisted(() => vi.fn());
const history = vi.hoisted(() => vi.fn());
vi.mock('../../lib/queries', async (original) => ({
  ...(await original<typeof import('../../lib/queries')>()),
  useCreateErgTest: () => ({ mutateAsync: mutate }),
}));
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof import('../../lib/api')>()),
  api: (...args: unknown[]) => history(...args),
}));
const client = new QueryClient();
const user = { id: 'rower' } as User;
const best: Achievement = {
  kind: 'best-week',
  title: 'New Best Week',
  value: 42000,
  week: '2026-11-02',
};
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  mutate.mockReset().mockResolvedValue({ id: 'test' });
  history.mockReset().mockResolvedValue([]);
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  );
});
afterEach(() => {
  cleanup();
  client.clear();
  clearCelebration(user.id);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function setup(achievement: Achievement | null = best) {
  if (achievement) recordCelebration(user.id, [achievement]);
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <Celebration user={user} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}
it('announces the title and formatted value with a decorative trophy and dismiss control', () => {
  setup();
  expect(screen.getByRole('status').textContent).toContain('New Best Week42.0k m');
  expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  expect(document.querySelector('.lucide-trophy')?.getAttribute('aria-hidden')).toBe('true');
  expect(screen.getByRole('button', { name: 'Dismiss Celebration' }).className).toContain(
    'ui-icon-button',
  );
  expect(pendingCelebration(user.id)).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss Celebration' }));
  expect(screen.queryByRole('status')).toBeNull();
  expect(mutate).not.toHaveBeenCalled();
});
it('auto-dismisses after five seconds and uses a flame for streaks', () => {
  setup({ ...best, kind: 'longest-streak', title: 'Longest Streak', value: 5 });
  expect(screen.getByText('5 Weeks')).toBeTruthy();
  expect(document.querySelector('.lucide-flame')).toBeTruthy();
  act(() => vi.advanceTimersByTime(4999));
  expect(screen.getByRole('status')).toBeTruthy();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole('status')).toBeNull();
});
it('omits animated classes under reduced motion while retaining content and dismissal', () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  );
  setup();
  expect(document.querySelector('.celebration-pop')).toBeNull();
  expect(screen.getByText('New Best Week')).toBeTruthy();
});
it.each([
  ['split-2k', '2k'],
  ['split-6k', '6k'],
] as const)(
  'persists %s until explicit Save as Best, never updates on display',
  async (kind, testKind) => {
    setup({
      ...best,
      kind,
      title: kind === 'split-2k' ? 'New 2k Best' : 'New 6k Best',
      value: 98.2,
      entry: 'entry',
      date: '2026-10-26',
    });
    expect(screen.getByText('1:38.2 /500m')).toBeTruthy();
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.getByRole('status')).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save as Best' })));
    expect(mutate).toHaveBeenCalledWith({
      body: { kind: testKind, date: '2026-10-26', split_s: 98.2 },
    });
    expect(screen.queryByRole('status')).toBeNull();
  },
);
it('keeps a failed test save retryable and announces the error', async () => {
  setup({ ...best, kind: 'split-2k', value: 98.2, entry: 'entry', date: '2026-10-26' });
  mutate.mockRejectedValue(new Error('offline'));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save as Best' })));
  expect(screen.getByRole('alert').textContent).toContain('Best not saved. Try again');
  expect(screen.getByRole('button', { name: 'Save as Best' })).toBeTruthy();
  mutate.mockResolvedValue({ id: 'test' });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save as Best' })));
  expect(screen.queryByText('New Best Week')).toBeNull();
});
it('guards rapid taps and a re-shown card with a persisted success marker', async () => {
  const item: Achievement = {
    ...best,
    kind: 'split-2k',
    value: 98.2,
    entry: 'entry',
    date: '2026-10-26',
  };
  let resolve!: (value: { id: string }) => void;
  mutate.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const first = setup(item);
  await act(async () => {
    const button = screen.getByRole('button', { name: 'Save as Best' });
    fireEvent.click(button);
    fireEvent.click(button);
  });
  expect(mutate).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ id: 'test' }));
  first.unmount();
  localStorage.removeItem('oyo-celebration:rower:split-2k:entry');
  setup(item);
  expect(screen.getByRole('button', { name: 'Save as Best' })).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save as Best' })));
  expect(mutate).toHaveBeenCalledTimes(1);
  expect(history).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Save as Best')).toBeNull();
});
it('renders nothing without a pending achievement', () => {
  setup(null);
  expect(screen.queryByRole('status')).toBeNull();
});
