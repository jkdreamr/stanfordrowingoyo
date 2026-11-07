// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../../lib/queryClient';
import { createMockApi } from '../../mock/handlers';
import { ToastProvider } from '../../components/ui';
import Reports from './Reports';

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
  clients.splice(0).forEach((c) => c.clear());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function setup({ fail = false, empty = false } = {}) {
  const mock = createMockApi();
  const call = (path: string, body: unknown) =>
    mock.handle(
      new Request(`http://localhost${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  const entry = mock.state.entries.find((e) => e.user_id === 'user-2')!;
  entry.title = 'Reported Erg';
  if (!empty)
    await call('/api/reports', {
      target_type: 'entry',
      target_id: entry.id,
      reason: 'Please review this',
    });
  await call('/api/auth/login', {
    email: mock.state.users.find((u) => u.id === 'user-39')!.email,
    password: 'password',
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL, init: RequestInit) =>
      fail
        ? new Response(JSON.stringify({ error: { code: 'ERROR', message: 'Unavailable' } }), {
            status: 500,
          })
        : mock.handle(new Request(String(url), init)),
    ),
  );
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <Reports />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { mock, entry };
}
it('reviews reporter and content, dismisses and keeps a dismissed history', async () => {
  await setup();
  await screen.findByText('Reported Erg');
  expect(screen.getByRole('article', { name: 'Report by Marcus Albrecht' })).toBeTruthy();
  expect(screen.getByText('Please review this')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  await screen.findByText('No Open Reports');
  fireEvent.click(screen.getByRole('radio', { name: 'Dismissed' }));
  await screen.findByText('Reported Erg');
  expect(screen.queryByRole('button', { name: 'Delete Content' })).toBeNull();
});
it('confirms deletion and keeps a deleted report without the content', async () => {
  const { mock, entry } = await setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Content' }));
  const confirm = screen.getByRole('dialog', { name: 'Delete Reported Content' });
  fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
  await screen.findByText('No Open Reports');
  expect(mock.state.entries.some((e) => e.id === entry.id)).toBe(false);
  fireEvent.click(screen.getByRole('radio', { name: 'Deleted' }));
  await screen.findByText('Content Deleted');
  expect(screen.getByText('Please review this')).toBeTruthy();
});
it('shows an empty queue and retryable loading errors', async () => {
  await setup({ empty: true });
  await screen.findByText('No Open Reports');
  cleanup();
  await setup({ fail: true });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy());
});
