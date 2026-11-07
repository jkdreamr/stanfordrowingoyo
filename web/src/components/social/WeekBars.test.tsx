// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WeekSummary } from '../../../../shared/types';
import { WeekBars } from './WeekBars';
afterEach(cleanup);
const week = (week_start: string, total_m: number, target_m: number) =>
  ({ week_start, total_m, target_m }) as WeekSummary;
it('shows per-week targets and exposes matching click, focus and table details', () => {
  render(<WeekBars weeks={[week('2026-11-02', 12000, 10000), week('2026-11-09', 0, 20000)]} />);
  expect(document.querySelectorAll('line[stroke-dasharray="4 4"]').length).toBe(2);
  const bar = screen.getByRole('button', { name: /Week of Mon, Nov 2:/ });
  fireEvent.focus(bar);
  expect(screen.getByRole('status').textContent).toContain('12,000 E-meters');
  fireEvent.keyDown(bar, { key: 'Enter' });
  expect(bar.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'View Data' }));
  expect(screen.getByRole('table').textContent).toContain('20,000 m');
});
it('handles empty and all-zero weeks without invalid SVG dimensions', () => {
  const { rerender } = render(<WeekBars weeks={[]} />);
  expect(screen.getByText('No weekly data yet')).toBeTruthy();
  rerender(<WeekBars weeks={[week('2026-11-02', 0, 0)]} />);
  expect(document.querySelector('svg')?.outerHTML).not.toMatch(/NaN|Infinity/);
});
it('limits the chart and data table to the last twelve weeks', () => {
  render(
    <WeekBars
      weeks={Array.from({ length: 14 }, (_, i) =>
        week(`2026-01-${String(i + 1).padStart(2, '0')}`, i, 20),
      )}
    />,
  );
  expect(document.querySelectorAll('svg [role="button"]').length).toBe(12);
});
it('uses one zero-based domain for totals and targets, including missing targets and large totals', () => {
  render(
    <WeekBars
      weeks={[
        week('2026-11-02', 0, 10000),
        week('2026-11-09', 10000, 0),
        week('2026-11-16', 40000, 10000),
        week('2026-11-23', 10000, 40000),
      ]}
    />,
  );
  const columns = document.querySelectorAll('.social-week-column');
  const bar = (i: number) => columns[i].querySelector('rect[fill="var(--accent)"]')!;
  const target = (i: number) => columns[i].querySelector('line[stroke-dasharray]');
  expect(bar(0).getAttribute('height')).toBe('0');
  expect(target(0)?.getAttribute('y1')).toBe('145');
  expect(bar(1).getAttribute('y')).toBe('145');
  expect(target(1)).toBeNull();
  expect(bar(2).getAttribute('y')).toBe('40');
  expect(target(2)?.getAttribute('y1')).toBe('145');
  expect(target(3)?.getAttribute('y1')).toBe('40');
  fireEvent.focus(columns[1].querySelector('[role="button"]')!);
  expect(screen.getByRole('status').textContent).toContain('No target');
  expect(document.querySelectorAll('.social-week-selection').length).toBe(1);
  expect(document.querySelector('.social-week-selection')?.getAttribute('y1')).toBe('218');
  fireEvent.click(screen.getByRole('button', { name: 'View Data' }));
  expect(screen.getByRole('table').textContent).toContain('No target');
});
