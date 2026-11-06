// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createQueryClient } from '../lib/queryClient';
import { useWeekStats } from '../lib/queries';
import { createMockApi } from '../mock/handlers';
import { ToastProvider } from '../components/ui';
import WeeklyTarget from './WeeklyTarget';
const clients: ReturnType<typeof createQueryClient>[] = [];
function StatsSubscription() {
  useWeekStats();
  return null;
}
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
});
function setup({ failSave = false, holdRefresh = false } = {}) {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  const mock = createMockApi();
  let saved = false;
  let release!: () => void;
  const refreshing = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fetcher = vi.fn(async (url: URL, init: RequestInit) => {
    if (init.method === 'PUT') {
      if (failSave) throw new TypeError('fetch');
      saved = true;
    }
    if (holdRefresh && saved && url.pathname === '/api/stats/week' && init.method === 'GET')
      await refreshing;
    return mock.handle(new Request(String(url), init));
  });
  vi.stubGlobal('fetch', fetcher);
  const client = createQueryClient();
  clients.push(client);
  const router = createMemoryRouter([{ path: '/me/target', element: <WeeklyTarget /> }], {
    initialEntries: ['/me/target'],
  });
  render(
    <QueryClientProvider client={client}>
      <StatsSubscription />
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { fetcher, release };
}
it('confirms a saved target after refetch has remounted the form', async () => {
  const { release } = setup({ holdRefresh: true });
  const input = await screen.findByLabelText('Personal Target');
  fireEvent.change(input, { target: { value: '50000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  await screen.findByText('50,000 E-meters');
  expect(input.isConnected).toBe(false);
  expect(screen.queryByText('Weekly target saved')).toBeNull();
  release();
  expect(await screen.findByText('Weekly target saved')).toBeTruthy();
});
it('does not submit an empty or invalid target', async () => {
  const { fetcher } = setup();
  const input = await screen.findByLabelText('Personal Target');
  for (const value of ['', '0', '-1', '1.5']) {
    fireEvent.change(input, { target: { value } });
    expect(
      (screen.getByRole('button', { name: 'Save Target' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  }
  expect(fetcher.mock.calls.some(([, init]) => init.method === 'PUT')).toBe(false);
});
it('retains the entered target and reports save errors without a success toast', async () => {
  setup({ failSave: true });
  fireEvent.change(await screen.findByLabelText('Personal Target'), { target: { value: '50000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  expect(
    await screen.findByText('Could not connect. Check your connection and try again'),
  ).toBeTruthy();
  expect((screen.getByLabelText('Personal Target') as HTMLInputElement).value).toBe('50000');
  expect(screen.queryByText('Weekly target saved')).toBeNull();
});
