// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { RaceWeek, TeamRace } from '../../../shared/types';
import { formatCompactMeters } from '../lib/format';
import { createQueryClient } from '../lib/queryClient';
import { createMockApi } from '../mock/handlers';
import { BerkeleyRace, raceAt, raceResult } from './BerkeleyRace';

const START = Date.parse('2026-11-09T08:00:00Z');
const END = Date.parse('2026-11-16T08:00:00Z');
const week = (patch: Partial<RaceWeek> = {}): RaceWeek => ({
  week_start: '2026-11-09',
  starts_at: new Date(START).toISOString(),
  ends_at: new Date(END).toISOString(),
  status: 'live',
  rowers: 40,
  stanford_m: 1_500_000,
  target_m: 3_200_000,
  berkeley_total_m: 2_880_000,
  berkeley_m: 1_440_000,
  ...patch,
});
const race = (patch: Partial<TeamRace> = {}): TeamRace => ({
  as_of: new Date((START + END) / 2).toISOString(),
  ratio: 0.9,
  week: week(),
  previous: week({
    week_start: '2026-11-02',
    starts_at: new Date(START - 7 * 86_400_000).toISOString(),
    ends_at: new Date(START).toISOString(),
    status: 'final',
    stanford_m: 2_700_000,
    berkeley_m: 2_880_000,
  }),
  ...patch,
});
const clients: ReturnType<typeof createQueryClient>[] = [];
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function show(body: TeamRace | ((request: Request) => Promise<Response>)) {
  const requests: URL[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: URL | string, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      requests.push(url);
      return typeof body === 'function'
        ? body(new Request(url, init))
        : Response.json(body, { status: 200 });
    }),
  );
  const client = createQueryClient();
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <BerkeleyRace week="2026-11-09" />
    </QueryClientProvider>,
  );
  return requests;
}

describe('race pace', () => {
  it('starts Berkeley at zero, halfway mid-week and at its total at week end', () => {
    expect(raceAt(week(), START)).toEqual({ final: false, berkeley: 0, stanford: 1_500_000 });
    expect(raceAt(week(), (START + END) / 2).berkeley).toBe(1_440_000);
    expect(raceAt(week(), END)).toEqual({ final: true, berkeley: 2_880_000, stanford: 1_500_000 });
    expect(raceAt(week({ status: 'final' }), START).berkeley).toBe(2_880_000);
  });
  it('keeps Berkeley at zero for a zero target', () => {
    const empty = week({ target_m: 0, berkeley_total_m: 0, berkeley_m: 0 });
    expect(raceAt(empty, (START + END) / 2).berkeley).toBe(0);
    expect(raceAt(empty, END).berkeley).toBe(0);
  });
  it('names the leader and margin', () => {
    expect(raceResult(1_500_000, 1_440_000, false)).toEqual({
      leader: 'stanford',
      text: 'Stanford Ahead by 60.0k E-meters',
    });
    expect(raceResult(1_000, 2_500, false).text).toBe('Berkeley Ahead by 1.5k E-meters');
    expect(raceResult(3_000, 2_000, true).text).toBe('Stanford Won by 1.0k E-meters');
    expect(raceResult(2_000, 3_000, true).text).toBe('Berkeley Won by 1.0k E-meters');
    expect(raceResult(0, 0, false).text).toBe('Tied');
    expect(raceResult(40, 40, true).text).toBe('Tied');
    expect(raceResult(0, 30, false).text).toBe('Berkeley Ahead by 30 E-meters');
  });
  it('formats totals compactly', () => {
    expect(formatCompactMeters(950)).toBe('950');
    expect(formatCompactMeters(142_492)).toBe('142.5k');
    expect(formatCompactMeters(999_949)).toBe('999.9k');
    expect(formatCompactMeters(999_950)).toBe('1.00M');
    expect(formatCompactMeters(1_839_500)).toBe('1.84M');
  });
});

describe('BerkeleyRace', () => {
  it('shows the live race and last week result', async () => {
    const requests = show(race());
    const card = await screen.findByRole('region', { name: 'Stanford vs Berkeley' });
    expect(within(card).getByRole('heading', { name: 'Stanford vs Berkeley' })).toBeTruthy();
    expect(within(card).getByText('Stanford Ahead by 60.0k E-meters')).toBeTruthy();
    expect(within(card).getByText('1.50M')).toBeTruthy();
    expect(within(card).getByText('1.44M')).toBeTruthy();
    expect(within(card).getByText('Last Week: Berkeley Won by 180.0k E-meters')).toBeTruthy();
    expect(requests[0].pathname).toBe('/api/stats/race');
    expect(requests[0].searchParams.get('week')).toBe('2026-11-09');
  });
  it('advances Berkeley locally between refetches', async () => {
    vi.useFakeTimers({
      toFake: ['setInterval', 'clearInterval', 'Date'],
      shouldAdvanceTime: true,
    });
    vi.setSystemTime(new Date('2026-11-12T20:00:00Z'));
    show(race());
    await screen.findByText('1.44M');
    act(() => {
      vi.advanceTimersByTime(3.5 * 86_400_000);
    });
    expect(screen.getByText('2.88M')).toBeTruthy();
    expect(screen.getByText('Berkeley Won by 1.38M E-meters')).toBeTruthy();
    expect(screen.queryByText(/Last Week/)).toBeNull();
  });
  it('shows a final result without a last-week line', async () => {
    show(race({ week: week({ status: 'final', stanford_m: 3_000_000, berkeley_m: 2_880_000 }) }));
    expect(await screen.findByText('Stanford Won by 120.0k E-meters')).toBeTruthy();
    expect(screen.queryByText(/Last Week/)).toBeNull();
  });
  it('hides with no rowers and on errors', async () => {
    const empty = week({
      rowers: 0,
      stanford_m: 0,
      target_m: 0,
      berkeley_total_m: 0,
      berkeley_m: 0,
    });
    show(race({ week: empty, previous: empty }));
    await vi.waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
    expect(screen.queryByRole('region')).toBeNull();
    cleanup();
    show(async () => Response.json({ error: { code: 'X', message: 'Down' } }, { status: 400 }));
    await vi.waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
    expect(screen.queryByRole('region')).toBeNull();
  });
  it('matches the mock API at mid-week', async () => {
    const mock = createMockApi({ now: () => new Date('2026-11-12T20:00:00Z') });
    show((request) => mock.handle(request));
    const card = await screen.findByRole('region', { name: 'Stanford vs Berkeley' });
    const response = await mock.handle(
      new Request('http://localhost/api/stats/race?week=2026-11-09'),
    );
    const data = (await response.json()) as TeamRace;
    expect(data.week.status).toBe('live');
    expect(data.week.berkeley_total_m).toBe(Math.round(data.week.target_m * 0.9));
    expect(data.week.berkeley_m).toBe(Math.round(data.week.berkeley_total_m / 2));
    expect(within(card).getByText(formatCompactMeters(data.week.berkeley_m))).toBeTruthy();
  });
});
