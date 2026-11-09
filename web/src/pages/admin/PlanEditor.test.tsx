// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createQueryClient } from '../../lib/queryClient';
import { createMockApi } from '../../mock/handlers';
import { ToastProvider } from '../../components/ui';
import PlanEditor from './PlanEditor';
const clients: ReturnType<typeof createQueryClient>[] = [];
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllGlobals();
});
function setup({ week = '2026-11-16', failCopy = false, failSave = false } = {}) {
  const mock = createMockApi({ now: () => new Date('2026-11-16T18:00:00Z'), session: 'user-39' });
  const fetch = vi.fn((url: URL, init: RequestInit) =>
    (failCopy &&
      url.pathname === '/api/admin/plan' &&
      url.searchParams.get('week') === '2026-11-09') ||
    (failSave && init.method === 'PUT')
      ? Promise.reject(new Error('Unavailable'))
      : mock.handle(new Request(String(url), init)),
  );
  vi.stubGlobal('fetch', fetch);
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  clients.push(client);
  const router = createMemoryRouter(
    [
      { path: '/admin/plan', element: <PlanEditor /> },
      { path: '/admin', element: <p>Admin</p> },
    ],
    { initialEntries: [`/admin/plan?week=${week}`] },
  );
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { fetch, mock, router };
}
it('copies the previous week into an empty draft, previews multiline null-zone OYO, and publishes only on save', async () => {
  const { fetch, mock } = setup();
  await screen.findByRole('heading', { name: 'Week of Nov 16' });
  expect(screen.queryByRole('radiogroup', { name: 'Plan Group' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Copy Previous Week' }));
  await screen.findByText('Previous week copied to draft');
  expect(fetch.mock.calls.filter(([, init]) => init.method === 'PUT')).toHaveLength(0);
  fireEvent.click(screen.getByRole('radio', { name: 'Preview' }));
  const preview = await screen.findByRole('region', { name: 'Week of Nov 16 Preview' });
  expect(within(preview).getAllByText('Athlete Driven OYO or OFF')).toHaveLength(6);
  expect(
    within(preview)
      .getAllByText(/15' Mobility\/Activation/)
      .every((node) => node.classList.contains('whitespace-pre-line')),
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Save Plan' }));
  await screen.findByText('Plan saved');
  expect((screen.getByRole('button', { name: 'Save Plan' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  const saved = await (
    await mock.handle(new Request('http://localhost/api/plan?week=2026-11-16'))
  ).json();
  expect(saved.slots).toHaveLength(14);
  expect(saved.slots.every((row: { zone: unknown }) => row.zone === null)).toBe(true);
});
it('guards dirty week navigation and confirms before overwriting a nonempty draft', async () => {
  const { router } = setup({ week: '2026-11-09' });
  await screen.findByLabelText('Week Total Label');
  fireEvent.change(screen.getByLabelText('Week Total Label'), { target: { value: 'Draft label' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next Week' }));
  let confirm = await screen.findByRole('dialog', { name: 'Discard Changes?' });
  fireEvent.click(within(confirm).getByRole('button', { name: 'Keep Editing' }));
  expect(router.state.location.search).toBe('?week=2026-11-09');
  expect((screen.getByLabelText('Week Total Label') as HTMLInputElement).value).toBe('Draft label');
  fireEvent.click(screen.getByRole('button', { name: 'Copy Previous Week' }));
  confirm = await screen.findByRole('dialog', { name: 'Replace Draft?' });
  fireEvent.click(within(confirm).getByRole('button', { name: 'Keep Editing' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Replace Draft?' })).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Next Week' }));
  confirm = await screen.findByRole('dialog', { name: 'Discard Changes?' });
  fireEvent.click(within(confirm).getByRole('button', { name: 'Discard Changes' }));
  await screen.findByRole('heading', { name: 'Week of Nov 16' });
});
it('copies an empty previous week only after confirmation, without saving', async () => {
  const { fetch } = setup({ week: '2026-11-09' });
  await screen.findByLabelText('Week Total Label');
  fireEvent.click(screen.getByRole('button', { name: 'Copy Previous Week' }));
  const confirm = await screen.findByRole('dialog', { name: 'Replace Draft?' });
  fireEvent.click(within(confirm).getByRole('button', { name: 'Copy Previous Week' }));
  await screen.findByText('Previous week is empty');
  expect(screen.getByText('Unsaved changes')).toBeTruthy();
  expect(fetch.mock.calls.filter(([, init]) => init.method === 'PUT')).toHaveLength(0);
});
it('keeps an empty draft usable after copy failure', async () => {
  setup({ failCopy: true });
  await screen.findByRole('heading', { name: 'Week of Nov 16' });
  fireEvent.click(screen.getByRole('button', { name: 'Copy Previous Week' }));
  await screen.findByRole('alert');
  expect(
    (screen.getByRole('button', { name: 'Copy Previous Week' }) as HTMLButtonElement).disabled,
  ).toBe(false);
  expect(screen.getByText('Saved', { exact: true })).toBeTruthy();
});
it('keeps unsaved edits after save failure and allows null-zone multiline OYO editing', async () => {
  setup({ failSave: true });
  await screen.findByRole('button', { name: 'Edit Monday AM' });
  fireEvent.click(screen.getByRole('button', { name: 'Edit Monday AM' }));
  const sheet = await screen.findByRole('dialog', { name: 'Monday AM' });
  fireEvent.click(within(sheet).getByRole('radio', { name: 'OYO' }));
  fireEvent.change(within(sheet).getByLabelText('Session Text'), {
    target: { value: 'Line 1\nLine 2' },
  });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Apply To Draft' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Monday AM' })).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Save Plan' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Edit Monday AM' }).textContent).toContain(
    'Line 1\nLine 2',
  );
  expect(screen.getByRole('status').textContent).toBe('Unsaved changes');
});
