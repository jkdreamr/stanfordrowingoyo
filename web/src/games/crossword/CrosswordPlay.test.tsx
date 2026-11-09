// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CrosswordPlay } from './CrosswordPlay';
import { api, ApiClientError } from '../../lib/api';
import { mockCrossword } from '../../mock/crossword';

vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof import('../../lib/api')>()),
  api: vi.fn(),
}));
const DATE = '2026-11-16';
let started = false,
  locked = false,
  available = true;
let cells: string[] | undefined;
let nextError: ApiClientError | undefined;
let staleIncorrect = false;
const completed = vi.fn();
beforeEach(() => {
  started = false;
  locked = false;
  available = true;
  cells = undefined;
  nextError = undefined;
  staleIncorrect = false;
  completed.mockReset();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  const handler = mockCrossword();
  let result = false;
  vi.mocked(api)
    .mockReset()
    .mockImplementation(async (route, options) => {
      if (nextError && route.startsWith('POST')) {
        const error = nextError;
        nextError = undefined;
        throw error;
      }
      const access = {
        date: DATE,
        unlocked: !locked,
        reason: locked ? 'locked' : 'staff',
      } as const;
      const request = {
        user: 'test',
        date: DATE,
        access,
        now: new Date(`${DATE}T18:00:00Z`),
        finished: result,
        fail: (status: number, message: string, code?: string): never => {
          throw new ApiClientError(status, { code: code ?? 'INVALID', message });
        },
        finish: () => {
          result = true;
        },
      };
      if (started) {
        handler({ ...request, action: 'start', body: {} });
        if (cells) handler({ ...request, action: 'progress', body: { cells } });
        started = false;
      }
      const day = handler({
        ...request,
        action: route.split('/').at(-1)!,
        body: (options as { body?: Record<string, unknown> })?.body ?? {},
      });
      return {
        ...day,
        ...(staleIncorrect ? { incorrect: true } : {}),
        available,
        available_from: DATE,
      } as never;
    });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function mount() {
  return render(
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        <CrosswordPlay date={DATE} onComplete={completed} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
async function open() {
  started = true;
  mount();
  await screen.findByRole('grid');
}
const key = (key: string) => fireEvent.keyDown(window, { key });
function tile(i: number) {
  return within(screen.getByRole('grid')).getAllByRole('gridcell')[i];
}
function tap(i: number) {
  fireEvent.click(within(tile(i)).getByRole('button'));
}
function active() {
  return within(screen.getByRole('grid'))
    .getAllByRole('gridcell')
    .findIndex((c) => c.getAttribute('aria-selected') === 'true');
}
const letters = () =>
  within(screen.getByRole('grid'))
    .getAllByRole('gridcell')
    .map((c) => c.getAttribute('aria-label'));

it('hides grid and clues until explicit start, with no real input', async () => {
  mount();
  await screen.findByText('Ready to Solve?');
  expect(screen.queryByRole('grid')).toBeNull();
  expect(screen.queryByText('A Whiskered Pet')).toBeNull();
  expect(vi.mocked(api).mock.calls.filter(([route]) => route.startsWith('POST'))).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  await screen.findByRole('grid');
  expect(
    vi
      .mocked(api)
      .mock.calls.some(
        ([route, options]) =>
          route.endsWith('/start') && (options as { body: { date: string } }).body.date === DATE,
      ),
  ).toBe(true);
  expect(document.querySelector('input')).toBeNull();
});
it('shows locked and server-dated unavailable states', async () => {
  locked = true;
  mount();
  await screen.findByRole('link', { name: 'Log Workout' });
  expect(screen.queryByRole('grid')).toBeNull();
  cleanup();
  locked = false;
  available = false;
  mount();
  await screen.findByText('First Mini Arrives Mon, Nov 16');
  expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
});
it('types, skips filled cells, advances to the next unfilled clue and announces it', async () => {
  cells = Array<string>(25).fill('');
  cells[7] = 'A';
  await open();
  expect(active()).toBe(6);
  key('c');
  expect(active()).toBe(8);
  key('t');
  expect(active()).toBe(11);
  expect(tile(6).getAttribute('aria-label')).toBe('1 Across, 1 Down, letter C');
  expect(screen.getByText('4 Across, Plural Form Of “Is”')).toBeTruthy();
});
it('toggles direction on a repeated tap and with Space', async () => {
  await open();
  tap(6);
  expect(screen.getByText('1 Down, A Whiskered Pet')).toBeTruthy();
  key(' ');
  expect(screen.getByText('1 Across, A Whiskered Pet')).toBeTruthy();
});
it('backspaces the current letter, then moves backwards and deletes', async () => {
  cells = Array<string>(25).fill('');
  cells[6] = 'C';
  cells[7] = 'A';
  await open();
  tap(7);
  key('Backspace');
  expect(active()).toBe(7);
  expect(tile(7).getAttribute('aria-label')).toContain('blank');
  key('Backspace');
  expect(active()).toBe(6);
  expect(tile(6).getAttribute('aria-label')).toContain('blank');
});
it('switches direction before moving perpendicular arrows, and navigates clues with Tab', async () => {
  await open();
  key('ArrowDown');
  expect(active()).toBe(6);
  key('ArrowDown');
  expect(active()).toBe(11);
  key('ArrowRight');
  expect(active()).toBe(11);
  key('ArrowRight');
  expect(active()).toBe(12);
  key('Tab');
  expect(active()).toBe(16);
  fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
  expect(active()).toBe(11);
});
it('saves progress with the date after debounce', async () => {
  await open();
  key('c');
  await waitFor(
    () =>
      expect(vi.mocked(api).mock.calls.some(([route]) => route.endsWith('/progress'))).toBe(true),
    { timeout: 1500 },
  );
  const options = vi.mocked(api).mock.calls.find(([route]) => route.endsWith('/progress'))![1] as {
    body: { date: string; cells: string[] };
  };
  expect(options.body.date).toBe(DATE);
  expect(options.body.cells[6]).toBe('C');
});
it('checks letters, clears wrong marks on edit and locks revealed cells', async () => {
  await open();
  key('z');
  tap(6);
  fireEvent.click(screen.getByRole('button', { name: 'Check' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cell +5s' }));
  await waitFor(() => expect(tile(6).classList.contains('xw-wrong')).toBe(true));
  key('Backspace');
  expect(tile(6).classList.contains('xw-wrong')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Reveal' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cell +15s Per New Cell' }));
  await waitFor(() => expect(tile(6).classList.contains('xw-revealed')).toBe(true));
  key('z');
  expect(tile(6).getAttribute('aria-label')).toContain('letter C, Revealed');
  expect(vi.mocked(api).mock.calls.find(([route]) => route.endsWith('/reveal'))?.[1]).toMatchObject(
    { body: { date: DATE, scope: 'cell', cell: 6, dir: 'across' } },
  );
});
it('requires confirmation before revealing the puzzle and completes authoritatively', async () => {
  await open();
  fireEvent.click(screen.getByRole('button', { name: 'Reveal' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Puzzle +15s Per New Cell' }));
  expect(vi.mocked(api).mock.calls.some(([route]) => route.endsWith('/reveal'))).toBe(false);
  fireEvent.click(await screen.findByRole('button', { name: 'Reveal Puzzle' }));
  await waitFor(() => expect(completed).toHaveBeenCalledOnce());
  expect(completed.mock.calls[0][0]).toMatchObject({ penalty: 135, reveals: 9 });
});
it('automatically attempts full grids, keeps incorrect letters private, then finishes a correct grid', async () => {
  await open();
  for (const i of [6, 7, 8, 11, 12, 13, 16, 17, 18]) {
    tap(i);
    key('z');
  }
  await screen.findByText('Not Quite — Keep Going', {}, { timeout: 2000 });
  expect(completed).not.toHaveBeenCalled();
  expect(letters().filter((s) => s?.includes('Incorrect'))).toHaveLength(0);
  tap(6);
  key('c');
  expect(screen.queryByText('Not Quite — Keep Going')).toBeNull();
  for (const [i, letter] of [
    [6, 'C'],
    [7, 'A'],
    [8, 'T'],
    [11, 'A'],
    [12, 'R'],
    [13, 'E'],
    [16, 'T'],
    [17, 'E'],
    [18, 'N'],
  ] as const) {
    tap(i);
    key(letter);
  }
  await waitFor(() => expect(completed).toHaveBeenCalledOnce(), { timeout: 2000 });
});
it.each(['DAY_CHANGED', 'ALREADY_PLAYED'])('recovers %s by refetching state', async (code) => {
  await open();
  nextError = new ApiClientError(409, { code, message: 'Conflict' });
  fireEvent.click(screen.getByRole('button', { name: 'Check' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cell +5s' }));
  await waitFor(() =>
    expect(
      vi.mocked(api).mock.calls.filter(([route]) => route.endsWith('/today')).length,
    ).toBeGreaterThan(1),
  );
});
it('never announces persisted incorrect state from resume or progress responses', async () => {
  staleIncorrect = true;
  await open();
  expect(screen.queryByText('Not Quite — Keep Going')).toBeNull();
  key('c');
  await waitFor(
    () =>
      expect(vi.mocked(api).mock.calls.some(([route]) => route.endsWith('/progress'))).toBe(true),
    { timeout: 1500 },
  );
  expect(screen.queryByText('Not Quite — Keep Going')).toBeNull();
});
it('does not restore incorrect feedback when a finish response arrives after the next edit', async () => {
  cells = Array<string>(25).fill('');
  for (const i of [6, 7, 8, 11, 12, 13, 16, 17]) cells[i] = 'Z';
  await open();
  const original = vi.mocked(api).getMockImplementation()!;
  let release: (() => void) | undefined;
  vi.mocked(api).mockImplementation(async (route, options) => {
    const result = await original(route, options);
    if (route.endsWith('/finish'))
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    return result;
  });
  tap(18);
  key('z');
  await waitFor(() => expect(release).toBeTypeOf('function'), { timeout: 1500 });
  tap(6);
  key('c');
  await act(async () => release!());
  expect(screen.queryByText('Not Quite — Keep Going')).toBeNull();
  expect(tile(6).getAttribute('aria-label')).toContain('letter C');
});
it('provides rows, selected cells, clue numbers and named keyboard keys', async () => {
  await open();
  expect(within(screen.getByRole('grid')).getAllByRole('row')).toHaveLength(5);
  expect(tile(6).getAttribute('aria-label')).toBe('1 Across, 1 Down, blank');
  expect(tile(6).getAttribute('aria-selected')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Type C' }));
  expect(tile(6).getAttribute('aria-label')).toContain('letter C');
  expect(screen.getByRole('button', { name: 'Backspace' })).toBeTruthy();
});
it('moves keyboard focus with selection and skips revealed cells when typing and arrowing', async () => {
  await open();
  tap(7);
  fireEvent.click(screen.getByRole('button', { name: 'Reveal' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cell +15s Per New Cell' }));
  await waitFor(() => expect(tile(7).classList.contains('xw-revealed')).toBe(true));
  tap(6);
  within(tile(6)).getByRole('button').focus();
  key('c');
  expect(active()).toBe(8);
  expect(document.activeElement).toBe(within(tile(8)).getByRole('button'));
  key('ArrowLeft');
  expect(active()).toBe(6);
});
it.each([
  ['Word +10s', 'word', 10],
  ['Puzzle +20s', 'puzzle', 20],
] as const)('checks an empty %s scope without exposing letters', async (label, scope, penalty) => {
  await open();
  fireEvent.click(screen.getByRole('button', { name: 'Check' }));
  fireEvent.click(await screen.findByRole('button', { name: label }));
  await waitFor(() =>
    expect(screen.getByText(`+${penalty}s`, { selector: '.xw-muted' })).toBeTruthy(),
  );
  expect(vi.mocked(api).mock.calls.find(([route]) => route.endsWith('/check'))?.[1]).toMatchObject({
    body: { date: DATE, scope, cell: 6, dir: 'across' },
  });
  expect(letters().filter((label) => label?.includes('letter'))).toHaveLength(0);
});
it('flushes a dated keepalive save when the page is hidden', async () => {
  await open();
  const fetcher = vi.fn(async (_url: string, request: RequestInit) => {
    const day = await api('POST /api/games/crossword/progress', {
      body: JSON.parse(request.body as string),
    });
    return new Response(JSON.stringify(day), { status: 200 });
  });
  vi.stubGlobal('fetch', fetcher);
  key('c');
  fireEvent(window, new Event('pagehide'));
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  expect(fetcher.mock.calls[0][0]).toBe('/api/games/crossword/progress');
  expect(fetcher.mock.calls[0][1].keepalive).toBe(true);
  const body = JSON.parse(fetcher.mock.calls[0][1].body as string);
  expect(body.date).toBe(DATE);
  expect(body.cells[6]).toBe('C');
});
it('allows retrying a failed full-grid finish without changing letters', async () => {
  cells = Array<string>(25).fill('');
  for (const [i, c] of [
    [6, 'C'],
    [7, 'A'],
    [8, 'T'],
    [11, 'A'],
    [12, 'R'],
    [13, 'E'],
    [16, 'T'],
    [17, 'E'],
  ] as const)
    cells[i] = c;
  await open();
  tap(18);
  nextError = new ApiClientError(0, {
    code: 'NETWORK_ERROR',
    message: 'No connection. Try again.',
  });
  key('n');
  await screen.findByText('No connection. Try again.', {}, { timeout: 2000 });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(completed).toHaveBeenCalledOnce());
});
