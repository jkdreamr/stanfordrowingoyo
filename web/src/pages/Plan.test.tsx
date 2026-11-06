// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createQueryClient } from '../lib/queryClient';
import { createMockApi } from '../mock/handlers';
import Plan from './Plan';
const clients: ReturnType<typeof createQueryClient>[] = [];
afterEach(() => {
  cleanup();
  clients.forEach((c) => c.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
});
function setup(path: string, fail = false) {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  const mock = createMockApi();
  vi.stubGlobal(
    'fetch',
    vi.fn((url: URL, init: RequestInit) =>
      fail ? Promise.reject(new TypeError('fetch')) : mock.handle(new Request(String(url), init)),
    ),
  );
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  clients.push(client);
  const router = createMemoryRouter([{ path: '/plan', element: <Plan /> }], {
    initialEntries: [path],
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
it('opens a deep-linked calculator and replaces the tab query on selection', async () => {
  const router = setup('/plan?tab=calculator');
  await screen.findByLabelText('Best 6k Split');
  expect(screen.getAllByRole('tab')).toHaveLength(4);
  fireEvent.change(screen.getByLabelText('Best 6k Split'), { target: { value: 'invalid' } });
  expect(screen.getByText('Enter a split like 1:45.0')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Guidance' }));
  await screen.findByText('OYO Workouts Per Fortnight');
  expect(router.state.location.search).toBe('?tab=guidance');
  expect(router.state.historyAction).toBe('REPLACE');
});
it('normalizes unknown tabs and loads the group schedule', async () => {
  const router = setup('/plan?tab=unknown');
  await screen.findByRole('radiogroup', { name: 'Group' });
  await screen.findByRole('heading', { name: 'Week 1' });
  expect(router.state.location.search).toBe('?tab=schedule');
  expect(screen.getByRole('radio', { name: 'Normal' }).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('radio', { name: 'Frosh' }));
  await screen.findByText('40k Equivalent + Monday PM');
});
it('shows a retry action when initial data fails', async () => {
  setup('/plan', true);
  await screen.findByText('Could Not Load This Screen');
  expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy();
});
