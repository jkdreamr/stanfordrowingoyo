// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListRow } from './ListRow';
import { Button } from './Button';
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
