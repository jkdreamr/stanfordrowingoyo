// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { NotificationSync } from './NotificationSync';
import { NOTIFICATION_POLL_MS } from '../lib/queries';

const setAppBadge = vi.fn().mockResolvedValue(undefined);
const clearAppBadge = vi.fn().mockResolvedValue(undefined);
let unread = 1;
const fetchMock = vi.fn(async (input: URL | string) =>
  String(input).includes('/api/notifications')
    ? Response.json(
        Array.from({ length: unread }, (_, i) => ({ id: String(i), read_at: null })).concat({
          id: 'read',
          read_at: '2026-01-01T00:00:00Z',
        } as never),
      )
    : new Response(null, { status: 204 }),
);
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  unread = 1;
  vi.stubGlobal('fetch', fetchMock);
  Object.assign(navigator, { setAppBadge, clearAppBadge });
  focusManager.setFocused(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockClear();
  setAppBadge.mockClear();
  focusManager.setFocused(undefined);
});
const calls = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/notifications')).length;
it('refreshes every minute only while visible and keeps the app badge current', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NotificationSync />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await vi.waitFor(() => expect(setAppBadge).toHaveBeenCalledWith(1));
  expect(calls()).toBe(1);
  unread = 3;
  await act(() => vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS));
  await vi.waitFor(() => expect(setAppBadge).toHaveBeenLastCalledWith(3));
  expect(calls()).toBe(2);
  focusManager.setFocused(false);
  await act(() => vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS * 3));
  expect(calls()).toBe(2);
  unread = 0;
  await act(async () => focusManager.setFocused(true));
  await vi.waitFor(() => expect(clearAppBadge).toHaveBeenCalled());
  expect(calls()).toBe(3);
});
