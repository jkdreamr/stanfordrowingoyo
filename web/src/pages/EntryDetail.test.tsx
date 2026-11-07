// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../lib/queryClient';
import { createMockApi } from '../mock/handlers';
import { ToastProvider } from '../components/ui';
import Home from './Home';
import EntryDetail from './EntryDetail';
import Log from './Log';

const clients: ReturnType<typeof createQueryClient>[] = [];
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
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
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup(scope: 'home' | 'other' | 'missing' = 'home') {
  const mock = createMockApi({ now: () => new Date('2026-11-06T18:00:00Z') });
  const entry = mock.state.entries.find((e) => e.user_id === 'user-1' && e.date >= '2026-11-02')!;
  entry.title = 'Evening Erg';
  const other = mock.state.entries.find((e) => e.user_id !== 'user-1' && e.visibility === 'team')!;
  vi.stubGlobal('fetch', (url: URL, init: RequestInit) =>
    mock.handle(new Request(String(url), init)),
  );
  const client = createQueryClient();
  clients.push(client);
  const router = createMemoryRouter(
    [
      { path: '/', element: <Home /> },
      { path: '/entries/:id', element: <EntryDetail /> },
      { path: '/log', element: <Log /> },
    ],
    {
      initialEntries: [
        scope === 'home' ? '/' : `/entries/${scope === 'other' ? other.id : 'missing'}`,
      ],
    },
  );
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { entry, router, client };
}
it('keeps Home rows linked to detail and reaches a prefilled own-session editor', async () => {
  const { entry, router } = setup();
  const row = await screen.findByRole('link', { name: /Evening Erg/ });
  expect(row.getAttribute('href')).toBe(`/entries/${entry.id}`);
  fireEvent.click(row);
  fireEvent.click(await screen.findByRole('button', { name: 'More' }));
  fireEvent.click(await screen.findByRole('link', { name: 'Edit Workout' }));
  await screen.findByRole('heading', { name: 'Edit Session' });
  expect(router.state.location.pathname).toBe('/log');
  expect(router.state.location.search).toBe(`?edit=${entry.id}`);
  expect(((await screen.findByLabelText('Title')) as HTMLInputElement).value).toBe(entry.title);
  expect((screen.getByLabelText('Meters') as HTMLInputElement).value).toBe(
    String(entry.distance_m),
  );
  expect(screen.getByRole('button', { name: 'Delete Session' })).toBeTruthy();
});
for (const scope of ['other', 'missing'] as const) {
  it(`omits workout actions for ${scope} entries`, async () => {
    const { client } = setup(scope);
    await screen.findByRole('heading', {
      name: scope === 'missing' ? 'Workout Not Found' : 'Workout',
    });
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });
}
