// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { HomeDays } from './Home';
afterEach(cleanup);
it('shows seven chronological days across month boundaries and marks logged days once', () => {
  render(
    <HomeDays
      start="2026-03-30"
      today="2026-04-02"
      dates={['2026-03-30', '2026-03-30', '2026-04-01', '2026-03-29']}
    />,
  );
  const days = within(screen.getByRole('list', { name: 'Days Logged This Week' })).getAllByRole(
    'listitem',
  );
  expect(days).toHaveLength(7);
  expect(screen.getByText('Monday, logged')).toBeTruthy();
  expect(screen.getByText('Wednesday, logged')).toBeTruthy();
  expect(days.filter((day) => day.querySelector('.is-logged'))).toHaveLength(2);
  expect(days[3].getAttribute('aria-current')).toBe('date');
  expect(screen.getByText('Thursday, today, not logged')).toBeTruthy();
  expect(days[6].textContent).toContain('5');
});
it('keeps an empty week readable without inventing activity', () => {
  const { container } = render(<HomeDays start="2026-03-30" today="2026-04-06" dates={[]} />);
  expect(container.querySelector('.is-logged')).toBeNull();
  expect(container.querySelector('[aria-current]')).toBeNull();
  expect(screen.getByText('Sunday, not logged')).toBeTruthy();
});
