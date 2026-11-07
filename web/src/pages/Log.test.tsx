// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createQueryClient } from '../lib/queryClient';
import { createMockApi } from '../mock/handlers';
import { ToastProvider } from '../components/ui';
import Log from './Log';
const clients: ReturnType<typeof createQueryClient>[] = [];
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  clients.forEach((c) => c.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
});
function setup(path = '/log', fail = false) {
  const mock = createMockApi();
  mock.state.imageLinks = {};
  const editId = mock.state.entries.find((e) => e.user_id === 'user-1')!.id;
  if (path === 'edit') {
    mock.state.tags[editId] = ['user-36', 'user-37', 'user-2'];
    path = `/log?edit=${editId}`;
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((url: URL, init: RequestInit) => {
      if (fail && init?.method === 'POST') return Promise.reject(new TypeError('fetch'));
      return mock.handle(new Request(String(url), init));
    }),
  );
  const client = createQueryClient();
  clients.push(client);
  const router = createMemoryRouter(
    [
      { path: '/log', element: <Log /> },
      { path: '/', element: <h1>Training Home</h1> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { mock, router, editId };
}
it('prefills validated personal plan values without changing the meter convention', async () => {
  setup('/log?modality=bike&zone=R%2FE&distance=12000');
  expect(((await screen.findByLabelText('Meters')) as HTMLInputElement).value).toBe('12000');
  expect(screen.getByRole('radio', { name: 'Bike' }).getAttribute('aria-checked')).toBe('true');
  expect((screen.getByRole('radio', { name: 'Zone R/E' }) as HTMLInputElement).checked).toBe(true);
});
it('ignores invalid prefill and does not apply it to presets or edits', async () => {
  setup('/log?modality=swim&zone=Z&distance=200001');
  expect(((await screen.findByLabelText('Meters')) as HTMLInputElement).value).toBe('');
  expect(screen.getByRole('radio', { name: 'Erg' }).getAttribute('aria-checked')).toBe('true');
});
it('previews and saves a valid session, with optional details', async () => {
  const { mock } = setup();
  const meters = await screen.findByLabelText('Meters');
  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(meters, { target: { value: '12000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Details' }));
  fireEvent.change(screen.getByLabelText('Time'), { target: { value: '48:00' } });
  expect(screen.getByText('= 12,000 E-meters')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Training Home' });
  expect(mock.state.entries.at(-1)?.avg_split_s).toBe(120);
  expect(screen.getByText('Session saved')).toBeTruthy();
});
it('shows field errors before submit and disables Save at the worker bounds', async () => {
  setup();
  fireEvent.change(await screen.findByLabelText('Meters'), { target: { value: '1000' } });
  const save = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
  expect(save().disabled).toBe(false);
  for (const [label, value, message] of [
    ['Title', 'x'.repeat(121), 'Keep the title to 120 characters'],
    ['Notes', 'x'.repeat(2001), 'Keep notes to 2,000 characters'],
  ]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(screen.getByText(message)).toBeTruthy();
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(label), { target: { value: '' } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Add Details' }));
  for (const [label, value, message] of [
    ['Stroke Rate', '61', 'Enter a whole stroke rate from 10 to 60'],
    ['Average HR', '241', 'Enter a whole heart rate from 30 to 240'],
    ['Time', '86401', 'Enter a duration from 1 second to 24 hours'],
    ['Split /500m', '10:00.1', 'Enter a split from 1:00.0 to 10:00.0'],
  ]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(screen.getByText(message)).toBeTruthy();
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(label), { target: { value: '' } });
  }
  fireEvent.change(screen.getByLabelText('Time'), { target: { value: '1' } });
  expect(screen.getByText('Enter a split from 1:00.0 to 10:00.0')).toBeTruthy();
  expect(save().disabled).toBe(true);
});
it('retains a draft on failure and confirms unsaved cancellation', async () => {
  setup('/log', true);
  fireEvent.change(await screen.findByLabelText('Meters'), { target: { value: '12000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText('Could not connect. Check your connection and try again');
  expect((screen.getByLabelText('Meters') as HTMLInputElement).value).toBe('12000');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  const dialog = await screen.findByRole('dialog', { name: 'Discard Changes?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Keep Editing' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard Changes' }),
  );
  await screen.findByRole('heading', { name: 'Training Home' });
});
it('selects a formula preset and requests meters', async () => {
  setup();
  await screen.findByLabelText('Meters');
  fireEvent.click(screen.getByRole('button', { name: 'Choose From Workout Menu' }));
  const dialog = screen.getByRole('dialog', { name: 'Workout Menu' });
  const row = within(dialog).getByText('Enter meters rowed').closest('button')!;
  fireEvent.click(row);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect((screen.getByLabelText('Meters') as HTMLInputElement).value).toBe('');
  expect(screen.getByText('Enter meters rowed', { selector: 'p' })).toBeTruthy();
});
it('loads an edit session and deletes only after confirmation', async () => {
  const { mock, editId } = setup('edit');
  await screen.findByRole('heading', { name: 'Edit Session' });
  fireEvent.click(screen.getByRole('button', { name: 'Delete Session' }));
  expect(mock.state.entries.some((e) => e.id === editId)).toBe(true);
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Session' }),
  );
  await screen.findByRole('heading', { name: 'Training Home' });
  expect(mock.state.entries.some((e) => e.id === editId)).toBe(false);
});

it('selects teammates, excludes self, enforces ten and sends the full tag set', async () => {
  const { mock } = setup();
  fireEvent.change(await screen.findByLabelText('Meters'), { target: { value: '1000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tag Teammates' }));
  const dialog = screen.getByRole('dialog', { name: 'Tag Teammates' });
  await within(dialog).findByRole('button', { name: 'Kannan Alford' });
  expect(within(dialog).queryByRole('button', { name: 'Marcus Albrecht' })).toBeNull();
  fireEvent.change(within(dialog).getByLabelText('Search Teammates'), {
    target: { value: 'Kannan' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Kannan Alford' }));
  fireEvent.change(within(dialog).getByLabelText('Search Teammates'), { target: { value: '' } });
  const rows = within(dialog)
    .getAllByRole('button')
    .filter((b) => b.hasAttribute('aria-pressed'));
  for (const row of rows.filter((b) => b.getAttribute('aria-pressed') === 'false').slice(0, 9))
    fireEvent.click(row);
  expect(rows.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(10);
  expect(
    rows
      .filter((b) => b.getAttribute('aria-pressed') === 'false')
      .every((b) => (b as HTMLButtonElement).disabled),
  ).toBe(true);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Training Home' });
  expect(mock.state.tags[mock.state.entries.at(-1)!.id]).toHaveLength(10);
});
it('prefills edit tags and replaces the full set on PATCH', async () => {
  const { mock, editId } = setup('edit');
  await screen.findByLabelText('Meters');
  expect(screen.getByRole('button', { name: /Tag Teammates.*3 Teammates/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Tag Teammates/ }));
  const dialog = screen.getByRole('dialog', { name: 'Tag Teammates' });
  const kannan = await within(dialog).findByRole('button', { name: 'Kannan Alford' });
  expect(kannan.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(kannan);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Training Home' });
  expect(mock.state.tags[editId]).toEqual(['user-37', 'user-2']);
});
