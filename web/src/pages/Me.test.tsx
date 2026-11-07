// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createQueryClient } from '../lib/queryClient';
import { createMockApi } from '../mock/handlers';
import Me from './Me';

const clients: ReturnType<typeof createQueryClient>[] = [];
afterEach(() => {
  cleanup();
  clients.forEach((c) => c.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
});
function setup({ empty = false, staff = false, fail = false } = {}) {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  const mock = createMockApi({
    now: () => new Date('2026-11-06T18:00:00Z'),
    session: staff ? 'user-39' : 'user-1',
  });
  mock.state.imageLinks = {};
  if (empty) mock.state.entries.length = 0;
  const fetch = vi.fn((url: URL, init: RequestInit) => {
    if (fail)
      return Promise.resolve(
        new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Unavailable' } }), {
          status: 404,
        }),
      );
    return mock.handle(new Request(String(url), init));
  });
  vi.stubGlobal('fetch', fetch);
  const client = createQueryClient();
  clients.push(client);
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <Me />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { mock, fetch };
}
it('renders profile, statistics, filters, year query and entry links', async () => {
  const { fetch } = setup();
  await screen.findByRole('heading', { name: 'Marcus Albrecht' });
  await screen.findByText('Total E-meters');
  const entries = screen.getByRole('region', { name: 'My Entries' });
  await waitFor(() => expect(within(entries).getAllByRole('link').length).toBeGreaterThan(0));
  expect(within(entries).getAllByRole('link')[0].getAttribute('href')).toMatch(/^\/entries\//);
  expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'All' }));
  await waitFor(() =>
    expect(fetch.mock.calls.some(([url]) => String(url).includes('season=2024'))).toBe(true),
  );
  await waitFor(() =>
    expect(screen.queryByRole('status', { name: 'Loading Mileage Chart' })).toBeNull(),
  );
  expect(fetch.mock.calls.some(([url]) => String(url).includes('season=2023'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Season' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Bike' }));
  fireEvent.change(screen.getByLabelText('Zone'), { target: { value: 'A' } });
  await screen.findByText('No Matching Sessions');
  fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
  expect(screen.queryByText('No Matching Sessions')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Calendar Year' }));
  await waitFor(() =>
    expect(fetch.mock.calls.some(([url]) => String(url).includes('year=2026'))).toBe(true),
  );
  await screen.findByRole('button', { name: 'View Data' });
  fireEvent.click(screen.getByRole('button', { name: 'View Data' }));
  expect(screen.getByRole('table')).toBeTruthy();
  const weekly = screen.getByRole('img', { name: /Weekly volume/ });
  fireEvent.keyDown(weekly, { key: 'Home' });
  expect(weekly.getAttribute('aria-label')).toContain('Dec 29');
  fireEvent.keyDown(weekly, { key: 'End' });
  expect(weekly.getAttribute('aria-label')).toContain('Nov 2');
});
it('offers an actionable empty state and staff-only Admin link', async () => {
  setup({ empty: true, staff: true });
  await screen.findByRole('link', { name: 'Admin' });
  await screen.findByText('No Sessions Yet');
  expect(screen.getAllByRole('link', { name: 'Log a Session' }).length).toBeGreaterThan(0);
  expect(screen.getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('/admin');
});
it('loads history before an empty season down to the 2024 floor', async () => {
  const { mock, fetch } = setup();
  const entry = { ...mock.state.entries.find((e) => e.user_id === 'user-1')! };
  mock.state.entries = mock.state.entries.filter(
    (e) => e.user_id !== 'user-1' || e.date >= '2026-09-01',
  );
  mock.state.entries.push({
    ...entry,
    id: 'older-season-entry',
    date: '2024-10-01',
    week_start: '2024-09-30',
    equiv_m: 12345,
  });
  const current = mock.state.entries
    .filter((e) => e.user_id === 'user-1')
    .reduce((n, e) => n + e.equiv_m, 0);
  await screen.findByText('Total E-meters');
  fireEvent.click(screen.getByRole('button', { name: 'All' }));
  await waitFor(() =>
    expect(fetch.mock.calls.some(([url]) => String(url).includes('season=2024'))).toBe(true),
  );
  const chart = await screen.findByRole('region', { name: 'Season Mileage' });
  await waitFor(() =>
    expect(
      within(chart).getByText(`${current.toLocaleString('en-US')} m`, { exact: true }),
    ).toBeTruthy(),
  );
  expect(fetch.mock.calls.some(([url]) => String(url).includes('season=2023'))).toBe(false);
});
it('keeps a retry action on API errors', async () => {
  setup({ fail: true });
  await screen.findByText('Could Not Load This Screen');
  expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy();
});
