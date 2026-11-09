// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DiveGuessResponse, DivePending } from '../../../../shared/types';
import { api, ApiClientError } from '../../lib/api';
import { Prompt, deadlineKey, savedDeadline } from './Prompt';

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  api: vi.fn(),
}));
const clients: QueryClient[] = [];
const key = deadlineKey('u1', '2026-11-07', 0);
const onSaved = vi.fn();
const onConflict = vi.fn(async () => {});
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
const suggested: DiveGuessResponse = {
  outcome: 'suggestion',
  prompt_index: 0,
  suggestion: 'Dry Tortugas',
  deadline_ms_remaining: 20000,
  attempts_left: 15,
};
function mount(pending?: DivePending) {
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
        pending={pending}
        onSaved={onSaved}
        onConflict={onConflict}
      />
    </QueryClientProvider>,
  );
}
async function settle(ms = 20) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
function input() {
  return screen.getByLabelText('Your Answer') as HTMLInputElement;
}
function type(value: string) {
  fireEvent.change(input(), { target: { value } });
}
function submit() {
  fireEvent.submit(input().form!);
}
async function showSuggestion() {
  mount();
  await settle();
  vi.mocked(api).mockResolvedValueOnce(suggested);
  type('Dry Tortugus');
  submit();
  await settle();
  expect(screen.getByRole('status').textContent).toContain('Did you mean Dry Tortugas?');
  expect(document.activeElement).toBe(input());
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-07T18:00:00Z'));
  localStorage.clear();
  vi.mocked(api).mockReset();
  onSaved.mockReset();
  onConflict.mockClear();
  vi.mocked(api).mockImplementation(
    async (endpoint) =>
      (endpoint === 'POST /api/games/dive/start'
        ? { prompt_index: 0, deadline_ms_remaining: 25000 }
        : { outcome: 'scored', answer: result }) as never,
  );
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it('starts on open, submits a trimmed guess once and shows the provisional result', async () => {
  mount();
  await settle();
  expect(api).toHaveBeenCalledWith('POST /api/games/dive/start', { body: { prompt_index: 0 } });
  expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('25 Seconds Left');
  type('  Oar  ');
  submit();
  submit();
  await settle();
  expect(
    vi.mocked(api).mock.calls.filter(([endpoint]) => endpoint.endsWith('/guesses')),
  ).toHaveLength(1);
  expect(api).toHaveBeenCalledWith('POST /api/games/dive/guesses', {
    body: { prompt_index: 0, answer: 'Oar' },
  });
  expect(onSaved).toHaveBeenCalledExactlyOnceWith(result);
  expect(savedDeadline(key)).toBeNull();
});
it('clears a wrong guess, keeps focus and the timer, announces feedback, then accepts another guess', async () => {
  mount();
  await settle();
  const deadline = savedDeadline(key);
  vi.mocked(api).mockResolvedValueOnce({ outcome: 'not_an_answer', attempts_left: 14 });
  type('Banana');
  submit();
  await settle(1000);
  expect(input().value).toBe('');
  expect(input().readOnly).toBe(false);
  expect(document.activeElement).toBe(input());
  expect(screen.getByRole('status').textContent).toBe('Not an answer');
  expect(screen.queryByText(/guesses left/)).toBeNull();
  expect(onSaved).not.toHaveBeenCalled();
  expect(savedDeadline(key)).toBe(deadline);
  expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('24 Seconds Left');
  type('Oar');
  expect(screen.queryByText('Not an answer')).toBeNull();
  submit();
  await settle();
  expect(onSaved).toHaveBeenCalledExactlyOnceWith(result);
});
it('shows the remaining guesses only at five or fewer and shakes the field', async () => {
  mount();
  await settle();
  vi.mocked(api).mockResolvedValueOnce({ outcome: 'not_an_answer', attempts_left: 5 });
  type('Banana');
  submit();
  await settle();
  expect(screen.getByRole('status').textContent).toBe('Not an answer5 guesses left');
  expect(document.querySelector('.dive-input-shake')).not.toBeNull();
  type('Oar');
  expect(document.querySelector('.dive-input-shake')).toBeNull();
});
it.each(['Yes', 'Enter'])(
  'accepts the stored suggestion with %s without sending arbitrary text',
  async (action) => {
    await showSuggestion();
    if (action === 'Yes') fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    else fireEvent.keyDown(input(), { key: 'Enter' });
    await settle();
    expect(api).toHaveBeenLastCalledWith('POST /api/games/dive/suggestion', {
      body: { prompt_index: 0, accept: true },
    });
    expect(onSaved).toHaveBeenCalledExactlyOnceWith(result);
  },
);
it.each(['No', 'Escape'])(
  'rejects the stored suggestion with %s and keeps playing',
  async (action) => {
    await showSuggestion();
    vi.mocked(api).mockResolvedValueOnce({ outcome: 'not_an_answer', attempts_left: 14 });
    if (action === 'No') fireEvent.click(screen.getByRole('button', { name: 'No' }));
    else fireEvent.keyDown(input(), { key: 'Escape' });
    await settle();
    expect(api).toHaveBeenLastCalledWith('POST /api/games/dive/suggestion', {
      body: { prompt_index: 0, accept: false },
    });
    expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Not an answer');
    expect(input().value).toBe('');
    expect(document.activeElement).toBe(input());
    expect(onSaved).not.toHaveBeenCalled();
  },
);
it('dismisses the chip on typing and submits the new guess instead of accepting', async () => {
  await showSuggestion();
  const calls = vi.mocked(api).mock.calls.length;
  type('Oar');
  expect(screen.queryByText('Dry Tortugas')).toBeNull();
  expect(api).toHaveBeenCalledTimes(calls);
  submit();
  await settle();
  expect(api).toHaveBeenLastCalledWith('POST /api/games/dive/guesses', {
    body: { prompt_index: 0, answer: 'Oar' },
  });
});
it('resumes pending suggestion and attempts, then sends an empty guess at timeout', async () => {
  vi.mocked(api).mockResolvedValueOnce({ prompt_index: 0, deadline_ms_remaining: 1000 });
  mount({
    prompt_index: 0,
    deadline_ms_remaining: 1000,
    suggestion: 'Dry Tortugas',
    attempts_left: 4,
  });
  await settle();
  expect(screen.getByRole('status').textContent).toBe('Did you mean Dry Tortugas?4 guesses left');
  await settle(2000);
  expect(api).toHaveBeenLastCalledWith('POST /api/games/dive/guesses', {
    body: { prompt_index: 0, answer: '' },
  });
  expect(onSaved).toHaveBeenCalledExactlyOnceWith(result);
  expect(
    vi.mocked(api).mock.calls.filter(([endpoint]) => endpoint.endsWith('/suggestion')),
  ).toHaveLength(0);
});
it('uses the server deadline on remount, overriding stale or modified storage', async () => {
  localStorage.setItem(key, String(Date.now() + 999999));
  vi.mocked(api).mockResolvedValueOnce({ prompt_index: 0, deadline_ms_remaining: 14000 });
  const first = mount();
  await settle();
  expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('14 Seconds Left');
  first.unmount();
  vi.mocked(api).mockResolvedValueOnce({ prompt_index: 0, deadline_ms_remaining: 0 });
  mount();
  await settle();
  expect(api).toHaveBeenLastCalledWith('POST /api/games/dive/guesses', {
    body: { prompt_index: 0, answer: '' },
  });
});
it('allows a failed timeout to retry without repeatedly sending in the background', async () => {
  vi.mocked(api).mockResolvedValueOnce({ prompt_index: 0, deadline_ms_remaining: 0 });
  vi.mocked(api).mockRejectedValueOnce(new Error('No connection. Try again.'));
  mount();
  await settle();
  await settle(1000);
  expect(screen.getByRole('alert').textContent).toBe('No connection. Try again.');
  expect(api).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await settle();
  expect(api).toHaveBeenLastCalledWith('POST /api/games/dive/guesses', {
    body: { prompt_index: 0, answer: '' },
  });
  expect(onSaved).toHaveBeenCalledExactlyOnceWith(result);
});
it('preserves the entered text and shows no error for TOO_FAST', async () => {
  mount();
  await settle();
  vi.mocked(api).mockRejectedValueOnce(
    new ApiClientError(429, { code: 'TOO_FAST', message: 'Wait' }),
  );
  type('Oar');
  submit();
  await settle();
  expect(input().value).toBe('Oar');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('button', { name: 'Dive' })).toBeTruthy();
  expect(onSaved).not.toHaveBeenCalled();
});
it('refreshes on 409 conflicts', async () => {
  mount();
  await settle();
  vi.mocked(api).mockRejectedValueOnce(
    new ApiClientError(409, { code: 'ALREADY_ANSWERED', message: 'Already answered' }),
  );
  type('Oar');
  submit();
  await settle();
  expect(onConflict).toHaveBeenCalledTimes(1);
  expect(onSaved).not.toHaveBeenCalled();
  expect(screen.queryByRole('alert')).toBeNull();
});
it('requires a successful start before guessing and permits an idempotent start retry', async () => {
  vi.mocked(api).mockRejectedValueOnce(new Error('No connection. Try again.'));
  mount();
  await settle();
  expect(screen.getByRole('alert').textContent).toBe('No connection. Try again.');
  type('Oar');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await settle();
  expect(vi.mocked(api).mock.calls.map(([endpoint]) => endpoint)).toEqual([
    'POST /api/games/dive/start',
    'POST /api/games/dive/start',
  ]);
  submit();
  await settle();
  expect(onSaved).toHaveBeenCalledExactlyOnceWith(result);
});
it('uses independent keys and tolerates unavailable localStorage', async () => {
  expect(
    new Set([
      key,
      deadlineKey('u2', '2026-11-07', 0),
      deadlineKey('u1', '2026-11-08', 0),
      deadlineKey('u1', '2026-11-07', 1),
    ]).size,
  ).toBe(4);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Denied');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Denied');
  });
  mount();
  await settle();
  expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('25 Seconds Left');
  type('Oar');
  submit();
  await settle();
  expect(onSaved).toHaveBeenCalledExactlyOnceWith(result);
});

it('keeps the field editable and preserves new typing while a guess is in flight', async () => {
  mount();
  await settle();
  let resolve!: (response: DiveGuessResponse) => void;
  vi.mocked(api).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  type('Dry Tortugus');
  submit();
  await settle();
  expect(input().readOnly).toBe(false);
  expect(document.activeElement).toBe(input());
  type('Oar');
  submit();
  expect(api).toHaveBeenCalledTimes(2);
  await act(async () => {
    resolve(suggested);
  });
  await settle();
  expect(input().value).toBe('Oar');
  expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull();
  submit();
  await settle();
  expect(api).toHaveBeenLastCalledWith('POST /api/games/dive/guesses', {
    body: { prompt_index: 0, answer: 'Oar' },
  });
});

it('offers Retry when the empty timeout guess fails with a pending suggestion', async () => {
  vi.mocked(api).mockResolvedValueOnce({ prompt_index: 0, deadline_ms_remaining: 0 });
  vi.mocked(api).mockRejectedValueOnce(new Error('No connection. Try again.'));
  mount({
    prompt_index: 0,
    deadline_ms_remaining: 0,
    suggestion: 'Dry Tortugas',
    attempts_left: 14,
  });
  await settle();
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await settle();
  expect(api).toHaveBeenLastCalledWith('POST /api/games/dive/guesses', {
    body: { prompt_index: 0, answer: '' },
  });
  expect(onSaved).toHaveBeenCalledExactlyOnceWith(result);
});
