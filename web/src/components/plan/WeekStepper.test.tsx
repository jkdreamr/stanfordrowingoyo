// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WeekStepper } from './WeekStepper';
afterEach(cleanup);
it('steps whole Monday weeks and offers an explicit return to this week', () => {
  const change = vi.fn();
  const { rerender } = render(
    <WeekStepper week="2026-11-09" today="2026-11-15" onChange={change} />,
  );
  expect(screen.getByRole('heading', { name: 'Week of Nov 9' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'This Week' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Next Week' }));
  expect(change).toHaveBeenLastCalledWith('2026-11-16');
  fireEvent.click(screen.getByRole('button', { name: 'Previous Week' }));
  expect(change).toHaveBeenLastCalledWith('2026-11-02');
  rerender(<WeekStepper week="2026-11-16" today="2026-11-15" onChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: 'This Week' }));
  expect(change).toHaveBeenLastCalledWith('2026-11-09');
});
it('disables navigation at date bounds and during pending work', () => {
  const { rerender } = render(
    <WeekStepper week="2000-01-03" today="2026-11-09" onChange={vi.fn()} />,
  );
  expect(
    (screen.getByRole('button', { name: 'Previous Week' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  rerender(<WeekStepper week="2027-11-08" today="2026-11-09" onChange={vi.fn()} />);
  expect((screen.getByRole('button', { name: 'Next Week' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  rerender(<WeekStepper week="2026-11-09" today="2026-11-09" onChange={vi.fn()} disabled />);
  expect(
    screen.getAllByRole('button').every((button) => (button as HTMLButtonElement).disabled),
  ).toBe(true);
});
