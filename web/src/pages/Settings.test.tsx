// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createQueryClient } from '../lib/queryClient';
import { createMockApi } from '../mock/handlers';
import { ThemeProvider } from '../lib/theme';
import { ToastProvider } from '../components/ui';
import Settings from './Settings';

const clients: ReturnType<typeof createQueryClient>[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function setup(fail = false) {
  const mock = createMockApi();
  let failed = fail;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  HTMLDialogElement.prototype.close = function () {};
  const exportData = { format_version: 1, profile: { id: 'me' }, workouts: [], plans: [] };
  const fetcher = vi.fn(async (url: URL, init: RequestInit) => {
    if (url.pathname === '/api/me/export') {
      if (failed) {
        failed = false;
        throw new TypeError('offline');
      }
      return Response.json(exportData);
    }
    return mock.handle(new Request(String(url), init));
  });
  vi.stubGlobal('fetch', fetcher);
  const blob = vi.fn().mockReturnValue('blob:my-data');
  URL.createObjectURL = blob;
  URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const client = createQueryClient();
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ThemeProvider>
          <ToastProvider>
            <Settings />
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { fetcher, blob, click };
}
it('downloads account JSON only when requested, without caching the export', async () => {
  const { fetcher, blob, click } = setup();
  expect(fetcher.mock.calls.some(([url]) => url.pathname === '/api/me/export')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: /Download My Data/ }));
  await screen.findByText('Download started');
  expect(blob).toHaveBeenCalledWith(expect.any(Blob));
  expect(click).toHaveBeenCalledOnce();
  expect(document.querySelector('a[download]')).toBeNull();
});
it('shows a download failure and enables a retry', async () => {
  setup(true);
  fireEvent.click(screen.getByRole('button', { name: /Download My Data/ }));
  expect(
    await screen.findByText('Could not connect. Check your connection and try again'),
  ).toBeTruthy();
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: /Download My Data/ }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: /Download My Data/ }));
  await screen.findByText('Download started');
});
it('follows the device until Match System is turned off, then the glass switch sets the theme', () => {
  localStorage.removeItem('theme');
  setup();
  const follow = screen.getByRole('switch', { name: 'Match System' });
  const dark = screen.getByRole('switch', { name: 'Dark Mode' }) as HTMLButtonElement;
  expect(follow.getAttribute('aria-checked')).toBe('true');
  expect(dark.disabled).toBe(true);
  expect(screen.getByText('Following this device')).toBeTruthy();
  fireEvent.click(follow);
  expect(dark.disabled).toBe(false);
  expect(localStorage.getItem('theme')).toBe('light');
  fireEvent.click(dark);
  expect(dark.getAttribute('aria-checked')).toBe('true');
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  expect(localStorage.getItem('theme')).toBe('dark');
  expect(document.documentElement.classList.contains('theme-anim')).toBe(true);
  fireEvent.click(follow);
  expect(localStorage.getItem('theme')).toBe('system');
  expect(document.documentElement.classList.contains('dark')).toBe(false);
});
