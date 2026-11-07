// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListRow } from './ListRow';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
afterEach(cleanup);
it('reserves default row chevrons for links and allows explicit overrides', () => {
  const { container } = render(
    <MemoryRouter>
      <ListRow title="Navigate" to="/" />
      <ListRow title="Action" onClick={() => {}} />
      <ListRow title="Delete" tone="destructive" onClick={() => {}} />
      <ListRow title="Explicit" onClick={() => {}} chevron />
      <ListRow title="Hidden" to="/" chevron={false} />
    </MemoryRouter>,
  );
  expect(
    [...container.querySelectorAll('.ui-row')].map((row) => !!row.querySelector('svg')),
  ).toEqual([true, false, false, true, false]);
});
it('keeps destructive and plain styling independent', () => {
  const { getByRole } = render(
    <>
      <Button variant="destructive">Delete</Button>
      <Button variant="plain">Cancel</Button>
    </>,
  );
  expect(getByRole('button', { name: 'Delete' }).classList.contains('ui-button-destructive')).toBe(
    true,
  );
  expect(getByRole('button', { name: 'Cancel' }).classList.contains('ui-button-plain')).toBe(true);
});
it.each([undefined, ''])('omits empty-state prose when the body is %s', (body) => {
  const { container, getByRole } = render(
    <EmptyState
      icon={<span />}
      title="No Sessions Yet"
      body={body}
      action={<Button>Log Session</Button>}
    />,
  );
  expect(getByRole('heading', { name: 'No Sessions Yet' })).toBeTruthy();
  expect(getByRole('button', { name: 'Log Session' })).toBeTruthy();
  expect(container.querySelector('p')).toBeNull();
});
it('retains recovery text and actions in an empty state', () => {
  const { getByText, getByRole } = render(
    <EmptyState
      icon={<span />}
      title="Could Not Load"
      body="Check your connection and try again"
      action={<Button>Try Again</Button>}
    />,
  );
  expect(getByText('Check your connection and try again')).toBeTruthy();
  expect(getByRole('button', { name: 'Try Again' })).toBeTruthy();
});
