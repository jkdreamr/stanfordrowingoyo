// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { ReactElement } from 'react';
import { createQueryClient } from '../lib/queryClient';
import { createMockApi } from '../mock/handlers';
import { ToastProvider } from '../components/ui';
import Home from './Home';
import Leaderboard from './Leaderboard';
import Notifications from './Notifications';
import Feed from './Feed';
import Announcements from './Announcements';
import Presets from './admin/Presets';
import AdminAnnouncements from './admin/Announcements';

const clients: ReturnType<typeof createQueryClient>[] = [];
beforeEach(() => {
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
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
});
function setup(element: ReactElement) {
  const mock = createMockApi({ session: 'user-39' });
  mock.state.entries = [];
  mock.state.notifications = [];
  mock.state.announcements = [];
  let fail = false;
  const fetch = vi.fn((url: string, init: RequestInit) => {
    const path = new URL(String(url), 'http://localhost').pathname;
    if (fail) return Promise.resolve(new Response(null, { status: 500 }));
    if (['/api/leaderboard', '/api/admin/presets'].includes(path))
      return Promise.resolve(Response.json([]));
    return mock.handle(new Request(String(url), init));
  });
  vi.stubGlobal('fetch', fetch);
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  clients.push(client);
  const router = createMemoryRouter([
    { path: '/', element },
    { path: '/log', element: <h1>Log Destination</h1> },
    { path: '/feed', element: <h1>Feed Destination</h1> },
  ]);
  const view = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return {
    ...view,
    client,
    fetch,
    router,
    fail: () => {
      fail = true;
    },
  };
}
function pull(root: Element) {
  fireEvent.touchStart(root, { touches: [{ clientX: 0, clientY: 0 }] });
  fireEvent.touchMove(root, { touches: [{ clientX: 0, clientY: 160 }] });
  fireEvent.touchEnd(root, { touches: [] });
}
for (const [label, element, title, action, destination] of [
  ['Home', <Home />, 'No Sessions Yet', 'Log Workout', '/log'],
  ['Leaderboard', <Leaderboard />, 'No Rankings Yet', 'Log Workout', '/log'],
  ['Notifications', <Notifications />, 'No Notifications Yet', 'Open Feed', '/feed'],
] as const) {
  it(`${label} refreshes every active visible query and links its empty-state action`, async () => {
    const { container, client, router } = setup(element);
    await screen.findByRole('heading', { name: title });
    await waitFor(() => expect(client.isFetching()).toBe(0));
    const active = client.getQueryCache().findAll({ type: 'active' });
    const refetches = active.map((query) => vi.spyOn(query, 'fetch'));
    pull(container.querySelector('.social-refresh-slot')!.parentElement!);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(`${label} updated`));
    for (const refetch of refetches) expect(refetch).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('link', { name: action }));
    expect(router.state.location.pathname).toBe(destination);
  });
}
it('does not announce an unsuccessful screen refresh as updated', async () => {
  const { container, client, fail, fetch } = setup(<Notifications />);
  await screen.findByRole('heading', { name: 'No Notifications Yet' });
  await waitFor(() => expect(client.isFetching()).toBe(0));
  fetch.mockClear();
  fail();
  await act(async () => pull(container.querySelector('.social-refresh-slot')!.parentElement!));
  await waitFor(() => expect(client.isFetching()).toBe(0));
  expect(fetch).toHaveBeenCalled();
  expect(screen.getByRole('status').textContent).toBe('');
});
for (const [element, title, action, destination] of [
  [<Feed />, 'No Workouts Yet', 'Log Workout', '/log'],
  [<Announcements />, 'No Announcements Yet', 'Open Feed', '/feed'],
] as const) {
  it(`${title} exposes one next-step link that navigates`, async () => {
    const { router } = setup(element);
    await screen.findByRole('heading', { name: title });
    fireEvent.click(screen.getByRole('link', { name: action }));
    expect(router.state.location.pathname).toBe(destination);
  });
}
for (const [element, title, action] of [
  [<Presets />, 'No Presets Yet', 'Add Preset'],
  [<AdminAnnouncements />, 'No Announcements Yet', 'New Announcement'],
] as const) {
  it(`${title} opens the existing staff create sheet`, async () => {
    setup(element);
    const titleElement = await screen.findByRole('heading', { name: title });
    const button = titleElement.parentElement!.querySelector('button')!;
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.click(button);
    expect(screen.getByRole('dialog', { name: action })).toBeTruthy();
  });
}
