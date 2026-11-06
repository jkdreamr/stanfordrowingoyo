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
  if (path === 'edit') path = `/log?edit=${editId}`;
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
