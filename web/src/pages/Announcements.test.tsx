// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createQueryClient } from '../lib/queryClient';
import { createMockApi } from '../mock/handlers';
import Announcements from './Announcements';
import Home from './Home';
import Notifications from './Notifications';
import { qk } from '../lib/queries';

const clients: ReturnType<typeof createQueryClient>[] = [];
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
});
function setup({
  path = '/announcements',
  empty = false,
  fail = false,
  loading = false,
  stale = false,
  missing = false,
} = {}) {
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
  const mock = createMockApi();
  const announcement = mock.state.announcements[0];
  mock.state.announcements = empty
    ? []
    : [
        {
          ...announcement,
          id: 'older',
          title: 'Earlier Update',
          body: 'Older team news',
          pinned: true,
          created_at: '2026-10-01T12:00:00Z',
        },
        {
          ...announcement,
          id: 'newer',
          title: 'Latest Update',
          body: 'First line\nSecond line',
          pinned: false,
          created_at: '2026-11-01T12:00:00Z',
        },
      ];
  let failed = fail;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: URL, init: RequestInit) => {
      if (url.pathname === '/api/announcements') {
        if (loading) return new Promise<Response>(() => {});
        if (failed) return Promise.reject(new TypeError('fetch'));
      }
      return mock.handle(new Request(String(url), init));
    }),
  );
  const client = createQueryClient();
  if (stale) {
    client.setQueryData(qk.request('GET /api/announcements', {}), [mock.state.announcements[0]]);
    const latest = mock.state.announcements[1];
    mock.state.notifications = [
      {
        id: 'live-alert',
        user_id: 'user-1',
        actor_id: latest.author_id,
        actor: latest.author,
        kind: 'announcement',
        entry_id: null,
        entry_title: null,
        announcement_id: missing ? 'removed' : latest.id,
        created_at: latest.created_at,
        read_at: null,
      },
    ];
  }
  client.setDefaultOptions({ queries: { retry: false } });
  clients.push(client);
  const router = createMemoryRouter(
    [
      { path: '/', element: <Home /> },
      { path: '/announcements', element: <Announcements /> },
      { path: '/notifications', element: <Notifications /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return {
    recover: () => {
      failed = false;
    },
  };
}
it('fetches an announcement missing from the fresh but stale list cache by its notification id', async () => {
  setup({ path: '/notifications', stale: true });
  fireEvent.click(await screen.findByRole('button', { name: /posted an announcement/ }));
  const sheet = await screen.findByRole('dialog', { name: 'Announcements' });
  expect(await within(sheet).findByRole('heading', { name: 'Latest Update' })).toBeTruthy();
  expect(within(sheet).queryByRole('heading', { name: 'Earlier Update' })).toBeNull();
  expect(
    vi
      .mocked(fetch)
      .mock.calls.some(([url]) => new URL(String(url)).pathname === '/api/announcements/newer'),
  ).toBe(true);
});
it('does not show an unrelated announcement when the notification target was removed', async () => {
  setup({ path: '/notifications', stale: true, missing: true });
  fireEvent.click(await screen.findByRole('button', { name: /posted an announcement/ }));
  const sheet = await screen.findByRole('dialog', { name: 'Announcements' });
  expect(await within(sheet).findByText('Announcement Removed')).toBeTruthy();
  expect(within(sheet).queryByText('Earlier Update')).toBeNull();
});
it('opens a specific announcement from the push deep link', async () => {
  setup({ path: '/announcements?announcement=newer' });
  expect(await screen.findByRole('article', { name: 'Latest Update' })).toBeTruthy();
  expect(screen.queryByRole('article', { name: 'Earlier Update' })).toBeNull();
});
it('shows a removed state for a deleted push target without substituting another announcement', async () => {
  setup({ path: '/announcements?announcement=removed' });
  expect(await screen.findByText('Announcement Removed')).toBeTruthy();
  expect(screen.queryByRole('article')).toBeNull();
  expect(screen.getByRole('link', { name: 'All Announcements' }).getAttribute('href')).toBe(
    '/announcements',
  );
});
it('shows pinned and unpinned announcements newest first with full bodies and authors', async () => {
  setup();
  await screen.findByRole('article', { name: 'Latest Update' });
  const articles = screen.getAllByRole('article');
  expect(within(articles[0]).getByRole('heading', { name: 'Latest Update' })).toBeTruthy();
  expect(within(articles[0]).getByText('First line Second line')).toBeTruthy();
  expect(within(articles[1]).getByRole('heading', { name: 'Earlier Update' })).toBeTruthy();
  expect(within(articles[1]).getByText('Pinned ·')).toBeTruthy();
  expect(articles[0].querySelector('time')?.getAttribute('datetime')).toBe('2026-11-01T12:00:00Z');
  expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/');
});
it('shows an empty state', async () => {
  setup({ empty: true });
  expect(await screen.findByText('No Announcements Yet')).toBeTruthy();
});
it('shows loading without claiming the archive is empty', () => {
  setup({ loading: true });
  expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
  expect(screen.queryByText('No Announcements Yet')).toBeNull();
});
it('retries a failed archive request', async () => {
  const { recover } = setup({ fail: true });
  await screen.findByText('Could Not Load This Screen');
  recover();
  fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
  expect(await screen.findByRole('article', { name: 'Latest Update' })).toBeTruthy();
});
it('keeps announcements reachable from Home when none are pinned or published', async () => {
  setup({ path: '/', empty: true });
  fireEvent.click(await screen.findByRole('link', { name: 'Announcements' }));
  expect(await screen.findByText('No Announcements Yet')).toBeTruthy();
});
