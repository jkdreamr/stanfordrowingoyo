// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ArcadeDay } from '../../../../shared/types';
import { api, ApiClientError } from '../../lib/api';
import { qk } from '../../lib/queries';
import { ArcadeDailyFrame } from './ArcadeDailyFrame';
import type { ArcadeStageProps } from './kit/ArcadeStage';

const { share } = vi.hoisted(() => ({ share: vi.fn() }));
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof import('../../lib/api')>()),
  api: vi.fn(),
}));
vi.mock('../share', () => ({ useShareResult: () => share }));
vi.mock('../GameDayBoard', () => ({ GameDayBoard: () => <div>Day Board</div> }));
vi.mock('./kit/ArcadeStage', () => ({
  ArcadeStage: ({ seed, children, onGameOver }: ArcadeStageProps<{ rows: number }>) => (
    <div data-testid="stage">
      Seed {seed}
      {children({
        seed,
        paused: false,
        sound: false,
        reducedMotion: false,
        setScore() {},
        onGameOver,
        endRequested: false,
      })}
    </div>
  ),
}));

let value: ArcadeDay;
let client: QueryClient;
const result = { score: 7, stats: { rows: 7 }, title: 'Run Over', detail: 'Caught By A Car' };
const error = (code: string) => new ApiClientError(409, { code, message: code });
beforeEach(() => {
  value = {
    game_id: 'chicken-crossing',
    date: '2026-11-09',
    access: { date: '2026-11-09', unlocked: true, reason: 'staff' },
    seed: 123,
    runs_per_day: 3,
    runs: [],
    attempts_left: 3,
    best: null,
  };
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.mocked(api).mockImplementation(async (route) => {
    if (route.endsWith('/runs/start')) {
      value = {
        ...value,
        attempts_left: 2,
        runs: [
          {
            attempt: 1,
            status: 'active',
            score: null,
            stats: null,
            started_at: '2026-11-09T18:00:00Z',
            finished_at: null,
          },
        ],
      };
      return { ...value, run: 'opaque-token', attempt: 1, seed: 123 } as never;
    }
    if (route.endsWith('/runs/finish')) {
      value = {
        ...value,
        best: 7,
        runs: [{ ...value.runs[0], status: 'finished', score: 7, stats: result.stats }],
      };
    }
    return structuredClone(value) as never;
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
});
function mount() {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ArcadeDailyFrame
          gameId="chicken-crossing"
          title="Chicken Crossing"
          howTo={['Hop Forward.']}
          formatScore={(n) => `${n} pts`}
          renderPlay={(props) => <button onClick={() => props.onGameOver(result)}>Finish</button>}
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
async function play() {
  fireEvent.click(await screen.findByRole('button', { name: /^Play$/ }));
  await screen.findByTestId('stage');
}

it('gates locked days with GameLocked', async () => {
  value.access = { ...value.access, unlocked: false, reason: 'locked' };
  value.seed = null;
  mount();
  expect(await screen.findByRole('link', { name: 'Log Workout' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
});
it('shows intro, run accounting and non-resumable active runs', async () => {
  value.attempts_left = 2;
  value.runs = [
    { attempt: 1, status: 'active', score: null, stats: null, started_at: '', finished_at: null },
  ];
  value.access.reason = 'no_oyo';
  mount();
  expect(await screen.findByText('Runs Left 2 of 3')).toBeTruthy();
  expect(screen.getByText('Run 1 · Left Early')).toBeTruthy();
  expect(screen.getByText("No OYO on today's team schedule.")).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Play Run 2' })).toBeTruthy();
});
it('starts with server seed, finishes with token and invalidates games', async () => {
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  mount();
  await play();
  expect(api).toHaveBeenCalledWith('POST /api/games/:game/runs/start', {
    params: { game: 'chicken-crossing' },
    body: { date: '2026-11-09' },
  });
  expect(screen.getByText('Seed 123')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
  expect(await screen.findByText('New Best')).toBeTruthy();
  expect(api).toHaveBeenCalledWith('POST /api/games/:game/runs/finish', {
    params: { game: 'chicken-crossing' },
    body: { date: '2026-11-09', run: 'opaque-token', score: 7, stats: { rows: 7 } },
  });
  expect(screen.getByText('Runs Left 2 of 3')).toBeTruthy();
  expect(screen.getByText('Day Board')).toBeTruthy();
  expect(screen.queryByTestId('stage')).toBeNull();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.root('games') });
  fireEvent.click(screen.getByRole('button', { name: 'Share' }));
  expect(share).toHaveBeenCalledWith(
    'Chicken Crossing',
    'Chicken Crossing · Nov 9\nBest 7 pts · 1 of 3 runs',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(screen.getByText('Best Today 7 pts')).toBeTruthy();
});
it('does not label a tied score New Best', async () => {
  value.best = 7;
  mount();
  await play();
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
  await screen.findByRole('button', { name: 'Done' });
  expect(screen.queryByText('New Best')).toBeNull();
});
it('shows the board without Play when no runs remain, even if all were abandoned', async () => {
  value.attempts_left = 0;
  mount();
  expect(await screen.findByText('Runs Left 0 of 3')).toBeTruthy();
  expect(screen.getByText('Day Board')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Play/ })).toBeNull();
});
it.each(['start', 'finish'])('shows Reload on DAY_CHANGED at %s', async (operation) => {
  mount();
  if (operation === 'finish') await play();
  else await screen.findByRole('button', { name: 'Play' });
  vi.mocked(api).mockRejectedValueOnce(error('DAY_CHANGED'));
  fireEvent.click(screen.getByRole('button', { name: operation === 'finish' ? 'Finish' : 'Play' }));
  expect(await screen.findByText('A New Day Has Started')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
});
it.each(['NO_RUNS_LEFT', 'RUN_UNKNOWN', 'RUN_FINISHED'])(
  'refetches today after start conflict %s',
  async (code) => {
    mount();
    await screen.findByRole('button', { name: 'Play' });
    vi.mocked(api).mockRejectedValueOnce(error(code));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() =>
      expect(
        vi.mocked(api).mock.calls.filter(([route]) => route === 'GET /api/games/:game/today'),
      ).toHaveLength(2),
    );
    expect(screen.queryByTestId('stage')).toBeNull();
  },
);
it('retries exactly the pending finish and treats RUN_FINISHED as saved', async () => {
  mount();
  await play();
  vi.mocked(api).mockRejectedValueOnce(new Error('Offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
  await screen.findByText('Could Not Save Run');
  const previous = vi.mocked(api).mock.calls.find(([route]) => route.endsWith('/runs/finish'));
  value.best = 7;
  vi.mocked(api).mockRejectedValueOnce(error('RUN_FINISHED'));
  fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
  await screen.findByRole('button', { name: 'Done' });
  expect(vi.mocked(api).mock.calls.filter(([route]) => route.endsWith('/runs/finish'))).toEqual([
    previous,
    previous,
  ]);
  expect(screen.getByText('Day Board')).toBeTruthy();
});
it('offers retry for a failed today request and always refetches on mount', async () => {
  vi.mocked(api).mockRejectedValueOnce(new Error('Offline'));
  const view = mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }));
  await screen.findByRole('button', { name: 'Play' });
  view.unmount();
  mount();
  await waitFor(() =>
    expect(
      vi.mocked(api).mock.calls.filter(([route]) => route === 'GET /api/games/:game/today'),
    ).toHaveLength(3),
  );
});
