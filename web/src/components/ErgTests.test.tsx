// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ErgTest } from '../../../shared/types';
import { PrTimeline } from './ErgTests';
import { ToastProvider } from './ui';
import { createQueryClient } from '../lib/queryClient';
import { createMockApi } from '../mock/handlers';
import Me from '../pages/Me';
import RowerProfile from '../pages/RowerProfile';
const clients: ReturnType<typeof createQueryClient>[] = [];
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
});
async function setup(profile = false, fail = false) {
  const mock = createMockApi({ now: () => new Date('2026-03-16T18:00:00Z') });
  mock.state.entries = [];
  const request = (path: string, method = 'GET', body?: unknown) =>
    mock.handle(
      new Request('https://oyo.test/api' + path, {
        method,
        ...(body === undefined
          ? {}
          : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      }),
    );
  for (const row of (await (await request('/users/user-1/tests')).json()) as ErgTest[])
    await request('/me/tests/' + row.id, 'DELETE');
  if (profile) await request('/me/tests', 'POST', { kind: '2k', date: '2026-03-09', split_s: 100 });
  const fetch = vi.fn((url: URL, init: RequestInit) =>
    fail && init?.method === 'POST'
      ? Promise.reject(new Error('Unavailable'))
      : mock.handle(new Request(String(url), init)),
  );
  vi.stubGlobal('fetch', fetch);
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  clients.push(client);
  render(
    <MemoryRouter initialEntries={[profile ? '/users/user-1' : '/me']}>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <Routes>
            <Route path="/me" element={<Me />} />
            <Route path="/users/:id" element={<RowerProfile />} />
          </Routes>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { mock, fetch, request };
}
it('renders ascending improvement and PR points with a visible data list fallback', () => {
  const rows = [
    { id: 'fast', date: '2026-03-10', split_s: 95, is_pr: true },
    { id: 'slower', date: '2026-03-09', split_s: 105, is_pr: false },
    { id: 'first', date: '2026-03-01', split_s: 100, is_pr: true },
  ] as ErgTest[];
  const { container, rerender } = render(<PrTimeline tests={rows} kind="2k" />);
  expect(screen.getByRole('img', { name: '2k split history, faster at top' })).toBeTruthy();
  const points = container.querySelectorAll('circle');
  expect(points).toHaveLength(3);
  expect(Number(points[2].getAttribute('cy'))).toBeLessThan(Number(points[0].getAttribute('cy')));
  expect(container.querySelectorAll('[data-pr="true"]')).toHaveLength(2);
  expect(screen.getByText('Faster At Top')).toBeTruthy();
  rerender(<PrTimeline tests={[]} kind="2k" />);
  expect(container.innerHTML).toBe('');
});
it('adds, edits and deletes tests on Me and refreshes best times', async () => {
  const { fetch } = await setup();
  await screen.findByText('No Tests Yet');
  fireEvent.click(screen.getByRole('button', { name: 'Add Test' }));
  let sheet = await screen.findByRole('dialog', { name: 'Add Test' });
  expect((within(sheet).getByLabelText('Date') as HTMLInputElement).value).toBe('2026-03-16');
  fireEvent.change(within(sheet).getByLabelText('Time'), { target: { value: '6:40.0' } });
  expect(within(sheet).getByRole('status').textContent).toBe('1:40.0');
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save Test' }));
  await screen.findByText('Test Added');
  const region = screen.getByRole('region', { name: 'Erg Tests' });
  await waitFor(() => expect(within(region).getAllByText('6:40.0')).toHaveLength(2));
  expect(within(region).getByText('PR')).toBeTruthy();
  fireEvent.click(within(region).getByRole('button', { name: 'Edit 2k Test 2026-03-16' }));
  sheet = await screen.findByRole('dialog', { name: 'Edit Test' });
  fireEvent.click(within(sheet).getByRole('radio', { name: 'Split' }));
  fireEvent.change(within(sheet).getByLabelText('Split'), { target: { value: '1:35.0' } });
  expect(within(sheet).getByRole('status').textContent).toBe('6:20.0');
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save Test' }));
  await screen.findByText('Test Updated');
  await waitFor(() => expect(within(region).getAllByText('6:20.0')).toHaveLength(2));
  expect(
    fetch.mock.calls.some(
      ([url, init]) => String(url).includes('/api/me/tests/') && init?.method === 'PATCH',
    ),
  ).toBe(true);
  fireEvent.click(within(region).getByRole('button', { name: 'Edit 2k Test 2026-03-16' }));
  fireEvent.click(
    within(await screen.findByRole('dialog', { name: 'Edit Test' })).getByRole('button', {
      name: 'Delete',
    }),
  );
  const confirm = await screen.findByRole('dialog', { name: 'Delete Test?' });
  fireEvent.click(within(confirm).getByRole('button', { name: 'Delete Test' }));
  await screen.findByText('Test Deleted');
  await screen.findByText('No Tests Yet');
  expect(
    fetch.mock.calls.some(
      ([url, init]) => String(url).includes('/api/me/tests/') && init?.method === 'DELETE',
    ),
  ).toBe(true);
});
it('keeps invalid values unsavable and reports save errors without losing the draft', async () => {
  await setup(false, true);
  await screen.findByText('No Tests Yet');
  fireEvent.click(screen.getByRole('button', { name: 'Add Test' }));
  const sheet = await screen.findByRole('dialog', { name: 'Add Test' }),
    input = within(sheet).getByLabelText('Time');
  fireEvent.change(input, { target: { value: 'bad' } });
  expect(
    (within(sheet).getByRole('button', { name: 'Save Test' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.change(input, { target: { value: '6:40.0' } });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save Test' }));
  await screen.findByText('Could Not Save Test');
  expect((input as HTMLInputElement).value).toBe('6:40.0');
  expect(screen.getByRole('dialog', { name: 'Add Test' })).toBeTruthy();
});
it('shows teammate history read-only and switches test kinds', async () => {
  await setup(true);
  await screen.findByRole('figure', { name: '2k PR Timeline' });
  const region = screen.getByRole('region', { name: 'Erg Tests' });
  expect(within(region).queryByRole('button', { name: 'Add Test' })).toBeNull();
  expect(within(region).queryByRole('button', { name: /Edit 2k Test/ })).toBeNull();
  expect(within(region).getByText('PR')).toBeTruthy();
  fireEvent.click(within(region).getByRole('radio', { name: '6k' }));
  await within(region).findByText('No Tests Yet');
});
