// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DealDay, DealRoundResult, GameResult } from '../../../../shared/types';
import { dealShare, replayDeal, type DealStep } from '../../../../shared/games/deal';
import { api, ApiClientError } from '../../lib/api';
import { DealPlay, DealRecap } from './DealPlay';
import { summarizeDeal } from './index';
import { GAMES } from '../registry';

vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof import('../../lib/api')>()),
  api: vi.fn(),
}));
const DATE = '2026-11-16';
const cards = [
  { value: 2, suit: 'H' },
  { value: 3, suit: 'S' },
  { value: 4, suit: 'D' },
  { value: 5, suit: 'C' },
] as const;
const solution: DealStep[] = [
  { a: 0, op: '+', b: 1 },
  { a: 4, op: '+', b: 2 },
  { a: 5, op: '+', b: 3 },
];
const result = (round = 0): DealRoundResult => ({
  round,
  cards: [...cards],
  goal: 14,
  timeMs: 12300,
  parMs: 30000,
  skipped: false,
  solution,
  teamBest: null,
});
let day: DealDay, client: QueryClient;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  day = {
    date: DATE,
    access: { date: DATE, unlocked: true, reason: 'staff' },
    round: 0,
    counts: [4, 4, 4, 4, 4],
    results: [],
    active: null,
    done: false,
    totalMs: null,
  };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path.endsWith('/today')) return { ...day } as never;
    const body = (options as { body: { round: number; steps?: DealStep[]; elapsedMs?: number } })
      .body;
    if (path.endsWith('/start'))
      day = {
        ...day,
        active: { round: day.round, cards: [...cards], goal: 14, parMs: 30000, elapsedMs: 0 },
      };
    else {
      if (path.endsWith('/answer'))
        expect(
          replayDeal(
            cards.map((c) => c.value),
            body.steps,
            14,
          ).ok,
        ).toBe(true);
      const r = { ...result(day.round), skipped: path.endsWith('/skip') };
      day = {
        ...day,
        round: day.round + 1,
        results: [...day.results, r],
        active: null,
        done: day.round === 4,
        totalMs: day.round === 4 ? 61500 : null,
      };
    }
    return { ...day } as never;
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const mount = async (onComplete = vi.fn()) => {
  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <DealPlay date={DATE} onComplete={onComplete} />
      </QueryClientProvider>,
    );
  });
  return onComplete;
};
const click = async (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
const advance = async (ms: number) =>
  act(async () => {
    vi.advanceTimersByTime(ms);
  });
async function start() {
  await click('Deal Cards');
  await advance(600);
}
async function merge(a: string, op: string, b: string) {
  await click(a);
  await click(op);
  await click(b);
  await advance(180);
}
async function solve() {
  await merge('2 of Hearts, 2', 'Add', '3 of Spades, 3');
  await merge('Card, 5', 'Add', '4 of Diamonds, 4');
  await merge('Card, 9', 'Add', '5 of Clubs, 5');
  await advance(600);
}

it('plays all five rounds using live ids and waits for See Results before completing', async () => {
  const done = await mount();
  expect(screen.getByLabelText('4 Face-Down Cards')).toBeTruthy();
  for (let i = 0; i < 5; i++) {
    expect(screen.getByRole('heading', { name: `Round ${i + 1} of 5` })).toBeTruthy();
    await start();
    await solve();
    expect(screen.getByRole('heading', { name: `Round ${i + 1} Complete` })).toBeTruthy();
    expect(done).not.toHaveBeenCalled();
    await click(i === 4 ? 'See Results' : 'Next Round');
  }
  expect(done).toHaveBeenCalledOnce();
  const answers = vi.mocked(api).mock.calls.filter(([p]) => p.endsWith('/answer'));
  expect(answers).toHaveLength(5);
  expect((answers[0][1] as { body: { steps: DealStep[]; elapsedMs: number } }).body.steps).toEqual(
    solution,
  );
  expect((answers[0][1] as { body: { elapsedMs: number } }).body.elapsedMs).toBeGreaterThan(0);
});
it('does not start the clock or allow taps until the deal animation finishes', async () => {
  await mount();
  await click('Deal Cards');
  await advance(400);
  expect(
    (screen.getByRole('button', { name: '2 of Hearts, 2' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(screen.getByRole('timer').textContent).toBe('0:00.0');
  await advance(140);
  await advance(210);
  expect(screen.getByRole('timer').textContent).toBe('0:00.2');
  expect(
    (screen.getByRole('button', { name: '2 of Hearts, 2' }) as HTMLButtonElement).disabled,
  ).toBe(false);
});
it.each([
  ['Subtract', 'Must Be a Whole Number Above Zero'],
  ['Divide', 'Must Divide Evenly'],
])('rejects illegal %s without consuming either card', async (op, error) => {
  await mount();
  await start();
  await merge('2 of Hearts, 2', op, '3 of Spades, 3');
  expect(screen.getByRole('status').textContent).toBe(error);
  expect(screen.getByRole('button', { name: '2 of Hearts, 2' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '3 of Spades, 3' })).toBeTruthy();
  expect(vi.mocked(api).mock.calls.filter(([p]) => p.endsWith('/answer'))).toHaveLength(0);
});
it('switches and deselects cards, exposes pressed operators, and restores exact ids with Undo and Reset', async () => {
  await mount();
  await start();
  await click('2 of Hearts, 2');
  await click('3 of Spades, 3');
  expect(screen.getByRole('button', { name: '2 of Hearts, 2' }).getAttribute('aria-pressed')).toBe(
    'false',
  );
  await click('3 of Spades, 3');
  expect(screen.getByRole('button', { name: '3 of Spades, 3' }).getAttribute('aria-pressed')).toBe(
    'false',
  );
  await click('2 of Hearts, 2');
  await click('Add');
  expect(screen.getByRole('button', { name: 'Add' }).getAttribute('aria-pressed')).toBe('true');
  await click('3 of Spades, 3');
  await advance(180);
  expect(screen.getByRole('status').textContent).toBe('2 plus 3 equals 5');
  expect(screen.getByRole('button', { name: 'Card, 5' }).style.gridColumn).toBe('2');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Card, 5' }));
  await click('Undo');
  expect(screen.getByRole('button', { name: '2 of Hearts, 2' })).toBeTruthy();
  await merge('2 of Hearts, 2', 'Add', '3 of Spades, 3');
  await click('Reset');
  expect(screen.queryByRole('button', { name: 'Card, 5' })).toBeNull();
  await solve();
  expect(screen.getByRole('heading', { name: 'Round 1 Complete' })).toBeTruthy();
});
it('keeps a wrong final card on screen with Undo available and does not submit', async () => {
  await mount();
  await start();
  await merge('2 of Hearts, 2', 'Multiply', '3 of Spades, 3');
  await merge('Card, 6', 'Add', '4 of Diamonds, 4');
  await merge('Card, 10', 'Add', '5 of Clubs, 5');
  expect(screen.getByRole('status').textContent).toBe('Not the Goal, Undo to Try Again');
  expect(screen.getByRole('button', { name: 'Card, 15' })).toBeTruthy();
  await click('Undo');
  expect(screen.getByRole('button', { name: 'Card, 10' })).toBeTruthy();
  expect(vi.mocked(api).mock.calls.filter(([p]) => p.endsWith('/answer'))).toHaveLength(0);
});
it('requires a second skip tap, expires confirmation, and shows the counted penalty', async () => {
  await mount();
  await start();
  await click('Skip (+1:00)');
  await advance(3001);
  expect(screen.queryByRole('button', { name: 'Tap Again to Skip' })).toBeNull();
  await click('Skip (+1:00)');
  await click('Tap Again to Skip');
  expect(screen.getByText('Skipped +1:00')).toBeTruthy();
  expect(vi.mocked(api).mock.calls.filter(([p]) => p.endsWith('/skip'))).toHaveLength(1);
});
it('resumes an active round without a flip, retaining server elapsed time', async () => {
  day.active = { round: 0, cards: [...cards], goal: 14, parMs: 30000, elapsedMs: 23400 };
  await mount();
  expect(screen.getByRole('timer').textContent).toBe('0:23.4');
  expect(
    (screen.getByRole('button', { name: '2 of Hearts, 2' }) as HTMLButtonElement).disabled,
  ).toBe(false);
  await advance(1000);
  expect(screen.getByRole('timer').textContent).toMatch(/^0:24\./);
  expect(document.querySelector('.deal-resume')).toBeTruthy();
});
it('reveals solution lines at 500ms intervals and shows team best copy', async () => {
  const { rerender } = render(
    <DealRecap
      result={{ ...result(), teamBest: { timeMs: 41200, name: 'Rowan', me: false } }}
      onNext={() => {}}
    />,
  );
  const lines = within(screen.getByRole('list', { name: 'Solution' })).getAllByRole('listitem', {
    hidden: true,
  });
  expect(lines[0].style.visibility).toBe('hidden');
  await advance(500);
  expect(lines[0].textContent).toBe('2 + 3 = 5');
  expect(lines[0].style.visibility).toBe('visible');
  expect(lines[1].style.visibility).toBe('hidden');
  await advance(1000);
  expect(lines[2].style.visibility).toBe('visible');
  expect(screen.getByText('Team Best 0:41.2 · Rowan')).toBeTruthy();
  rerender(
    <DealRecap
      result={{ ...result(), teamBest: { timeMs: 12300, name: 'Me', me: true } }}
      onNext={() => {}}
    />,
  );
  expect(screen.getByText('You Set the Team Best')).toBeTruthy();
  rerender(<DealRecap result={result()} onNext={() => {}} />);
  expect(screen.getByText('No One Has Solved It Yet')).toBeTruthy();
});
it('deals immediately and reveals the whole recap with reduced motion', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  await mount();
  await click('Deal Cards');
  expect(
    (screen.getByRole('button', { name: '2 of Hearts, 2' }) as HTMLButtonElement).disabled,
  ).toBe(false);
  await solve();
  for (const li of within(screen.getByRole('list', { name: 'Solution' })).getAllByRole('listitem'))
    expect(li.style.visibility).toBe('visible');
});
it('refetches and resets to the server active round after an uncertain answer', async () => {
  const original = vi.mocked(api).getMockImplementation()!;
  vi.mocked(api).mockImplementation(async (p, o) => {
    if (p.endsWith('/answer')) {
      day.active!.elapsedMs = 15000;
      throw new Error('Connection Lost');
    }
    return original(p, o);
  });
  await mount();
  await start();
  await solve();
  expect(screen.getByRole('alert').textContent).toBe('Connection Lost');
  expect(screen.getByRole('button', { name: '2 of Hearts, 2' })).toBeTruthy();
  expect(screen.getByRole('timer').textContent).toBe('0:15.0');
});
it('shows Reload on DAY_CHANGED without another request exposing cards', async () => {
  const original = vi.mocked(api).getMockImplementation()!;
  vi.mocked(api).mockImplementation(async (p, o) => {
    if (p.endsWith('/start'))
      throw new ApiClientError(409, {
        code: 'DAY_CHANGED',
        message: 'A New Day Has Started. Reload to Play.',
      });
    return original(p, o);
  });
  await mount();
  await click('Deal Cards');
  expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '2 of Hearts, 2' })).toBeNull();
  expect(api).toHaveBeenCalledTimes(2);
});
it('renders a retry state when the initial read fails and recovers', async () => {
  vi.mocked(api).mockRejectedValueOnce(new Error('Offline'));
  await mount();
  await click('Try Again');
  expect(screen.getByRole('button', { name: 'Deal Cards' })).toBeTruthy();
});
it('completes a finished server day without exposing another intro', async () => {
  day = {
    ...day,
    done: true,
    round: 5,
    results: Array.from({ length: 5 }, (_, i) => result(i)),
    totalMs: 61500,
  };
  const done = await mount();
  expect(done).toHaveBeenCalledOnce();
});
it('recaps a server-capped active round instead of leaving a running timer', async () => {
  day.active = { round: 0, cards: [...cards], goal: 14, parMs: 30000, elapsedMs: 299950 };
  await mount();
  day = {
    ...day,
    round: 1,
    active: null,
    results: [{ ...result(), skipped: true, timeMs: 300000 }],
  };
  await advance(100);
  expect(screen.getByRole('heading', { name: 'Round 1 Complete' })).toBeTruthy();
  expect(screen.getByText('Skipped +1:00')).toBeTruthy();
  expect(screen.queryByRole('timer')).toBeNull();
});
it('shows Reload rather than an empty load state when today returns a newer date', async () => {
  day.date = '2026-11-17';
  await mount();
  expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toContain('A New Day Has Started');
});
it('summarizes tenths and shares only times and outcomes, never goals or hands', () => {
  const rounds = [
    { ...result(), goal: 9876, timeMs: 12300 },
    { ...result(), timeMs: 41000 },
    { ...result(), timeMs: 82900 },
    { ...result(), timeMs: 60000, skipped: true },
    { ...result(), timeMs: 33200 },
  ];
  const share = dealShare(DATE, rounds);
  expect(share).toBe('Deal Nov 16\n3:49.4\n🟩 0:12.3\n🟨 0:41.0\n🟨 1:22.9\n⬛ Skipped\n🟨 0:33.2');
  expect(share).not.toContain('9876');
  expect(share).not.toContain('Hearts');
  const summary = summarizeDeal({ score: 2294, date: DATE, payload: { rounds } } as GameResult);
  expect(summary.headline).toBe('3:49.4');
  expect(summary.detail).toBe('4 of 5 Solved · 1 Under Par');
  expect(GAMES.find((g) => g.id === 'deal')?.direction).toBe('lower');
  expect(GAMES.find((g) => g.id === 'deal')?.formatScore(834)).toBe('1:23.4');
});
