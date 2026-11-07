// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { Config, User, WeeklyRecap } from '../../../shared/types';
import { createQueryClient } from '../lib/queryClient';
import { createMockApi } from '../mock/handlers';
import { recapKey, recapVisible, recapShareText } from '../lib/recap';
import { LastWeekRecap } from '../components/LastWeekRecap';
import { ToastProvider } from '../components/ui';
import Recap from './Recap';

const clients: ReturnType<typeof createQueryClient>[] = [];
const user = { id: 'rower-1', created_at: '2026-03-15T18:00:00Z' } as User;
const config = { today: '2026-03-16', current_week_start: '2026-03-16' } as Config;
const data: WeeklyRecap = {
  week_start: '2026-03-09',
  total_m: 58200,
  target_m: 60000,
  percent: 97,
  hit_target: false,
  entry_count: 6,
  by_modality: { erg: 40000, bike: 12000, run: 6200 },
  streak: 0,
  best_effort: null,
  team: { total_m: 200000, entry_count: 20, rowers: 4, rowers_hit_target: 2 },
  rank: 2,
};
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(0), 0));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
});
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
});
function mount(node: React.ReactNode, path = '/recap', fail = false, result = data) {
  const fetch = vi.fn(async (_url: URL, _init: RequestInit) => {
    if (fail) throw new Error('Unavailable');
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetch);
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  clients.push(client);
  const tree = (
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <ToastProvider>{node}</ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  return { ...render(tree), fetch, client };
}
it('shows Mon–Wed only and excludes users joining after the team-local week ended', () => {
  for (const today of ['2026-03-16', '2026-03-17', '2026-03-18'])
    expect(recapVisible(user, { ...config, today })).toBe(true);
  for (const today of ['2026-03-19', '2026-03-20', '2026-03-21', '2026-03-22'])
    expect(recapVisible(user, { ...config, today })).toBe(false);
  expect(recapVisible({ ...user, created_at: '2026-03-16T07:00:00Z' }, config)).toBe(false);
  expect(recapVisible({ ...user, created_at: '2026-03-16T06:59:59Z' }, config)).toBe(true);
  expect(
    recapVisible(user, config, {
      getItem() {
        throw new Error('Blocked');
      },
    }),
  ).toBe(true);
});
it('dismisses per user and week and persists across remounts', async () => {
  const view = mount(<LastWeekRecap user={user} config={config} />, '/');
  expect(
    (await screen.findByRole('link', { name: 'View Last Week Recap' })).getAttribute('href'),
  ).toBe('/recap?week=2026-03-09');
  expect(screen.getByText('97% · 6 Workouts')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss Last Week Recap' }));
  expect(localStorage.getItem(recapKey(user.id, '2026-03-09'))).toBe('1');
  view.unmount();
  mount(<LastWeekRecap user={user} config={config} />, '/');
  expect(screen.queryByRole('region', { name: 'Last Week' })).toBeNull();
  expect(recapVisible({ ...user, id: 'other' }, config)).toBe(true);
  expect(
    recapVisible(user, { today: '2026-03-23', current_week_start: '2026-03-23' } as Config),
  ).toBe(true);
});
it('does not fetch on hidden days and hides failed recap cards', async () => {
  const hidden = mount(
    <LastWeekRecap user={user} config={{ ...config, today: '2026-03-19' }} />,
    '/',
  );
  expect(hidden.fetch).not.toHaveBeenCalled();
  hidden.unmount();
  const failed = mount(<LastWeekRecap user={user} config={config} />, '/', true);
  await waitFor(() => expect(failed.client.isFetching()).toBe(0));
  expect(screen.queryByRole('region', { name: 'Last Week' })).toBeNull();
});
it('renders a recap with modality, best effort, team and share data', async () => {
  const mock = createMockApi();
  const entry = mock.state.entries[0];
  const share = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  const view = mount(<Recap />, '/recap?week=2026-03-11', false, {
    ...data,
    hit_target: true,
    percent: 110,
    streak: 3,
    best_effort: entry,
  });
  await screen.findByRole('heading', { name: 'Week of Mar 9' });
  expect(String(view.fetch.mock.calls[0]?.[0])).toContain('week=2026-03-11');
  expect(screen.getByRole('progressbar', { name: 'Weekly Target' })).toBeTruthy();
  expect(screen.getByText('Target Hit')).toBeTruthy();
  expect(screen.getByText('3').className).toContain('target-hit');
  expect(screen.getByRole('link', { name: new RegExp(entry.title) }).getAttribute('href')).toBe(
    '/entries/' + entry.id,
  );
  expect(screen.getByText('2 / 4')).toBeTruthy();
  expect(screen.getByText('#2')).toBeTruthy();
  expect(screen.getByText('40,000 E-meters')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Share' }));
  expect(share).toHaveBeenCalledWith({
    title: 'Week of Mar 9',
    text: 'Week of Mar 9: 58.2k / 60.0k E-meters · 6 workouts',
    url: window.location.origin + '/recap?week=2026-03-09',
  });
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
});
it('renders empty values and copies the completed-week link as share fallback', async () => {
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  mount(<Recap />, '/recap', false, {
    ...data,
    total_m: 0,
    percent: 0,
    entry_count: 0,
    rank: null,
  });
  await screen.findByText('No Workouts');
  expect(screen.getByText('Target Not Hit')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Share' }));
  await screen.findByText('Link Copied');
  expect(writeText).toHaveBeenCalledWith(window.location.origin + '/recap?week=2026-03-09');
  expect(recapShareText({ ...data, entry_count: 1 })).toContain('1 workout');
});
it('shows screen errors with retry and no share button', async () => {
  mount(<Recap />, '/recap?week=bad', true);
  await screen.findByText('Could Not Load This Screen');
  expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
});
