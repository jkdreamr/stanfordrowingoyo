// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ExamplePlan } from '../../../../shared/types';
import { PlanWeek } from './PlanWeek';
import { scheduleWeek, scheduleWeeks } from './schedule';

afterEach(cleanup);
const plan: ExamplePlan = {
  slots: [
    {
      group_key: 'normal',
      week: 1,
      day: 0,
      slot: 'AM',
      kind: 'oyo',
      zone: 'E',
      text: 'OYO 12 km Steady State',
    },
  ],
  totals: [{ group_key: 'normal', week: 1, label: '80 km + Strength' }],
};

it('preserves rower heading levels, viewport layouts, totals and slot content', () => {
  const { container } = render(<PlanWeek week={scheduleWeeks(plan)[0]} />);
  expect(screen.getByRole('heading', { level: 3, name: 'Week 1' })).toBeTruthy();
  expect(screen.getByRole('heading', { level: 4, name: 'Monday' })).toBeTruthy();
  expect(screen.getByText('80 km + Strength')).toBeTruthy();
  expect(screen.getAllByText('12 km Steady State')).toHaveLength(2);
  expect(screen.queryByText('OYO 12 km Steady State')).toBeNull();
  expect(container.querySelector('.lg\\:hidden')).toBeTruthy();
  expect(container.querySelector('.lg\\:grid')).toBeTruthy();
  expect(container.querySelector('section')?.hasAttribute('aria-label')).toBe(false);
});

it('uses the same sessions with a named region and container layouts for the editor preview', () => {
  render(<PlanWeek week={scheduleWeeks(plan, 'normal')[0]} preview />);
  const preview = screen.getByRole('region', { name: 'Week 1 Preview' });
  expect(within(preview).getByRole('heading', { level: 2, name: 'Week 1' })).toBeTruthy();
  expect(within(preview).getByRole('heading', { level: 3, name: 'Monday' })).toBeTruthy();
  expect(within(preview).getAllByText('12 km Steady State')).toHaveLength(2);
  expect(preview.className).toBe('[container-type:inline-size]');
});

it('renders missing and explicitly off days without session cards or a missing total', () => {
  render(
    <PlanWeek
      week={scheduleWeeks({ slots: [{ ...plan.slots[0], kind: 'off' }], totals: [] })[0]}
    />,
  );
  expect(screen.getAllByText('Off')).toHaveLength(14);
  expect(screen.queryByText('12 km Steady State')).toBeNull();
  expect(screen.queryByText('80 km + Strength')).toBeNull();
});

it('renders dated null-zone OYO and multiline seed text, with today highlighted and AM/PM labels', () => {
  const week = scheduleWeek({
    week_start: '2026-11-09',
    slots: [{ day: 0, slot: 'PM1', kind: 'oyo', zone: null, text: 'First line\nSecond line' }],
    total: null,
  });
  const { container } = render(<PlanWeek week={week} today="2026-11-09" />);
  expect(screen.getByRole('heading', { name: 'Week of Nov 9' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Monday' }).getAttribute('aria-current')).toBe('date');
  const paragraphs = Array.from(container.querySelectorAll('p')).filter(
    (node) => node.textContent === 'First line\nSecond line',
  );
  expect(paragraphs).toHaveLength(2);
  expect(paragraphs.every((node) => node.classList.contains('whitespace-pre-line'))).toBe(true);
  expect(screen.queryByText('PM1')).toBeNull();
  expect(screen.getAllByText('PM').length).toBeGreaterThan(0);
});
