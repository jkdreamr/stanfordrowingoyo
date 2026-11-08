// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DiveDay } from '../../../../shared/types';
import { api } from '../../lib/api';
import { Results } from './Results';
import { ToastProvider } from '../../components/ui';

vi.mock('../GameDayBoard', () => ({ GameDayBoard: () => <p>Day Board</p> }));
vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  api: vi.fn(),
}));
const clients: QueryClient[] = [];
const writeText = vi.fn();
function day(): DiveDay {
  return {
    date: '2026-11-07',
    access: { date: '2026-11-07', unlocked: true, reason: 'workout' },
    complete: true,
    score: 310,
    verdict: 'Open Water',
    result: null,
    prompts: ['Name a flower.'],
    answers: [
      {
        prompt_index: 0,
        answer: 'Orchid',
        points: 100,
        tier: 'gem',
        canonical: 'Orchid',
        gem: { answer: 'Orchid', tier: 'gem', points: 100 },
        notable: [],
        count: 1,
        total: 9,
        hidden: false,
      },
    ],
    reveal: [
      {
        prompt_index: 0,
        prompt: 'Name a flower.',
        groups: [
          {
            normalized: 'orchid',
            answer: 'Orchid',
            points: 100,
            tier: 'gem',
            canonical: 'Orchid',
            teammates: [{ user_id: 'u1', name: 'Rower One' }],
            only_you: true,
            count: 1,
            hidden: false,
            mine: true,
          },
        ],
      },
    ],
  };
}
function mount(data = day(), staff = false, reviewOnly = false) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <Results day={data} staff={staff} reviewOnly={reviewOnly} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.mocked(api).mockReset();
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  Reflect.deleteProperty(navigator, 'clipboard');
});
it('shows canonical tiers, verdict, teammate names and Only You; shares a spoiler-free emoji grid', async () => {
  mount();
  expect(screen.getByText('Orchid · Pearl')).toBeTruthy();
  expect(screen.getByText('Open Water')).toBeTruthy();
  expect(screen.getByText('Rower One')).toBeTruthy();
  expect(screen.getByText('Only You')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Hide Orchid' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Share' }));
  expect(await screen.findByText('Result Copied')).toBeTruthy();
  expect(writeText).toHaveBeenCalledWith(
    'OYO Dive 2026-11-07 310 m\n🦪\nhttps://stanford-oyo.joskoo.workers.dev',
  );
});
it('keeps copy retryable when clipboard access fails and renders empty groups', async () => {
  const empty = day();
  empty.reveal![0].groups = [];
  writeText.mockRejectedValueOnce(new Error('Denied'));
  mount(empty);
  expect(screen.getByText('No Answers')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Share' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Could Not Copy Result');
  fireEvent.click(screen.getByRole('button', { name: 'Share' }));
  expect(await screen.findByText('Result Copied')).toBeTruthy();
});
it('lets staff review groups without playing, requires confirmation and keeps failed moderation retryable', async () => {
  mount(day(), true, true);
  expect(screen.queryByRole('heading', { name: 'Your Dive' })).toBeNull();
  vi.mocked(api).mockRejectedValueOnce(new Error('No connection. Try again.'));
  fireEvent.click(screen.getByRole('button', { name: 'Hide Orchid' }));
  expect(screen.getByText('Hide This Answer From Team View. Scores Stay The Same.')).toBeTruthy();
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(api).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Hide Answer' }));
  expect(await screen.findByText('No connection. Try again.')).toBeTruthy();
  vi.mocked(api).mockResolvedValueOnce(day().reveal![0]);
  fireEvent.click(screen.getByRole('button', { name: 'Hide Answer' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(api).toHaveBeenCalledWith('PATCH /api/games/dive/answers', {
    body: { date: '2026-11-07', prompt_index: 0, normalized: 'orchid', hidden: true },
  });
});
it('keeps hidden-answer tier and points and offers display-only restoration', async () => {
  const hidden = day();
  hidden.answers[0].hidden = true;
  hidden.reveal![0].groups[0].hidden = true;
  mount(hidden, true);
  expect(screen.getByText('Orchid · Pearl')).toBeTruthy();
  expect(screen.getAllByText('100 m')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Unhide Orchid' }));
  expect(screen.getByText('Restore This Answer To Team View. Scores Stay The Same.')).toBeTruthy();
});
it('logs misses without inventing a canonical and shares the miss square', async () => {
  const missed = day();
  missed.answers[0] = { ...missed.answers[0], canonical: null, tier: 'miss', points: 0 };
  mount(missed);
  expect(screen.getByText('Not On The List · Miss')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Share' }));
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      'OYO Dive 2026-11-07 310 m\n⬛\nhttps://stanford-oyo.joskoo.workers.dev',
    ),
  );
});
