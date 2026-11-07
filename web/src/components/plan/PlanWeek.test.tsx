// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { Plan } from '../../../../shared/types';
import { PlanWeek } from './PlanWeek';
import { scheduleWeeks } from './schedule';

afterEach(cleanup);
const plan: Plan = {
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
