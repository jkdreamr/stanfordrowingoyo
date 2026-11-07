// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WeekSummary } from '../../../../shared/types';
import { WeekData } from './WeekData';

afterEach(cleanup);
it('discloses sorted weekly totals, zero meters and missing targets without a second plot', () => {
  const weeks = [
    { week_start: '2026-11-09', total_m: 0, target_m: 0 },
    { week_start: '2026-11-02', total_m: 12000, target_m: 10000 },
  ] as WeekSummary[];
  render(<WeekData weeks={weeks} />);
  expect(screen.queryByRole('table')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'View Data' }));
  const table = screen.getByRole('table', { name: 'Weekly E-Meters and Targets' });
  expect(table.textContent).toContain('12,000 m');
  expect(table.textContent).toContain('0 m');
  expect(table.textContent).toContain('No target');
  expect(screen.getAllByRole('rowheader').map((row) => row.textContent)).toEqual([
    'Mon, Nov 2',
    'Mon, Nov 9',
  ]);
  expect(screen.queryByRole('img')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'View Data' }));
  expect(screen.queryByRole('table')).toBeNull();
});
it('handles an empty weekly history', () => {
  render(<WeekData weeks={[]} />);
  fireEvent.click(screen.getByRole('button', { name: 'View Data' }));
  expect(screen.getByText('No weekly data yet')).toBeTruthy();
});
it('retains only the latest twelve weeks', () => {
  render(
    <WeekData
      weeks={Array.from(
        { length: 14 },
        (_, i) =>
          ({
            week_start: `2026-01-${String(i + 1).padStart(2, '0')}`,
            total_m: i,
            target_m: 20,
          }) as WeekSummary,
      )}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'View Data' }));
  expect(screen.getAllByRole('rowheader')).toHaveLength(12);
});
