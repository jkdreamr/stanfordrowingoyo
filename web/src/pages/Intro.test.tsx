// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createQueryClient } from '../lib/queryClient';
import { createMockApi } from '../mock/handlers';
import Intro from './Intro';
import Privacy from './Privacy';

const clients: ReturnType<typeof createQueryClient>[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllGlobals();
});
function setup({
  fail = false,
  path = '/intro?next=%2Fsettings',
  session = 'user-1' as string | null,
} = {}) {
  const mock = createMockApi({ session });
  let failed = fail;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL, init: RequestInit) => {
      if (url.pathname === '/api/me/intro' && init.method === 'POST' && failed) {
        failed = false;
        throw new TypeError('offline');
      }
      const response = await mock.handle(new Request(String(url), init));
      if (url.pathname === '/api/config') {
        const config = await response.json();
        return Response.json({ ...config, mode_factors: { ...config.mode_factors, bike: 0.5 } });
      }
      return response;
    }),
  );
  const client = createQueryClient();
  clients.push(client);
  const router = createMemoryRouter(
    [
      { path: '/intro', element: <Intro /> },
      { path: '/privacy', element: <Privacy /> },
      { path: '/settings', element: <h1>Settings</h1> },
      { path: '/signup', element: <h1>Signup</h1> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

it('uses live factors, supports Back, and completes all three short steps', async () => {
  setup();
  expect(await screen.findByText('15,000 E-m')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByRole('heading', { name: 'Training Zones' })).toBe(document.activeElement);
  expect(screen.getByText('13,500 E-m')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('heading', { name: 'E-meters' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByText('Your personal target')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Get Started' }));
  expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy();
});

it('keeps the intro open after an offline skip and allows retry', async () => {
  setup({ fail: true });
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  expect(
    await screen.findByText('Could not connect. Check your connection and try again'),
  ).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'E-meters' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy();
});

it('makes privacy available before signup with a signup return link', async () => {
  setup({ path: '/privacy', session: null });
  expect(screen.getByRole('heading', { name: 'Privacy' })).toBeTruthy();
  expect(screen.getByText(/My Fortnight plans are owner-only/)).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: 'Back To Signup' }));
  expect(await screen.findByRole('heading', { name: 'Signup' })).toBeTruthy();
});
