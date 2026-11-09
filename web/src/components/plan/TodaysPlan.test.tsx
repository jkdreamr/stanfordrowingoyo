// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { MyPlan } from '../../../../shared/types';
import { TodaysPlan } from './TodaysPlan';

const query = vi.hoisted(() => ({
  data: undefined as MyPlan | null | undefined,
  isError: false,
  refetch: vi.fn(),
}));
vi.mock('../../lib/queries', () => ({ useMyPlan: () => query }));
afterEach(() => {
  cleanup();
  query.data = undefined;
  query.isError = false;
  vi.clearAllMocks();
});
function setup() {
  render(
    <MemoryRouter>
      <TodaysPlan today="2026-11-02" />
    </MemoryRouter>,
  );
}
it('keeps both plan destinations available while loading', () => {
  setup();
  expect(screen.getByRole('link', { name: 'Example Fortnight' }).getAttribute('href')).toBe(
    '/plan?tab=example',
  );
  expect(screen.getByRole('link', { name: 'My Fortnight' }).getAttribute('href')).toBe(
    '/plan?tab=mine',
  );
});
it('offers retry and navigation when the personal plan fails to load', () => {
  query.isError = true;
  setup();
  expect(screen.getByRole('alert').textContent).toContain('Could Not Load Your Plan');
  fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
  expect(query.refetch).toHaveBeenCalledOnce();
  expect(screen.getByRole('link', { name: 'Example Fortnight' })).toBeTruthy();
});
it('keeps navigation available for a plan outside today’s fortnight', () => {
  query.data = {
    start_date: '2026-10-05',
    sessions: [],
    rest_days: [],
    planned_m: [0, 0],
    logged_m: [0, 0],
    updated_at: '2026-10-05T12:00:00Z',
  };
  setup();
  expect(screen.getByRole('heading', { name: "Today's Plan" })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'My Fortnight' })).toBeTruthy();
});
it('avoids double spacing above the centered Nothing Planned state', () => {
  query.data = {
    start_date: '2026-11-02',
    sessions: [],
    rest_days: [],
    planned_m: [0, 0],
    logged_m: [0, 0],
    updated_at: '2026-11-02T12:00:00Z',
  };
  setup();
  expect(screen.getByRole('heading', { name: "Today's Plan" }).classList.contains('mb-3')).toBe(
    false,
  );
  expect(screen.getByText('Nothing Planned').closest('.today-plan-empty')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Edit Plan' }).getAttribute('href')).toBe(
    '/plan?tab=mine',
  );
});
it.each(['session', 'rest'] as const)('keeps heading spacing for a planned %s', (kind) => {
  query.data = {
    start_date: '2026-11-02',
    sessions:
      kind === 'session'
        ? [
            {
              week: 1,
              day: 0,
              slot: 'AM',
              modality: 'erg',
              zone: 'E',
              distance_m: 12000,
              note: 'Steady Row',
              equiv_m: 12000,
            },
          ]
        : [],
    rest_days: kind === 'rest' ? [{ week: 1, day: 0 }] : [],
    planned_m: [12000, 0],
    logged_m: [0, 0],
    updated_at: '2026-11-02T12:00:00Z',
  };
  setup();
  expect(screen.getByRole('heading', { name: "Today's Plan" }).classList.contains('mb-3')).toBe(
    true,
  );
  expect(screen.queryByText('Nothing Planned')).toBeNull();
});
