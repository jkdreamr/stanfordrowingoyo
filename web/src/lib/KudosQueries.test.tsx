// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useKudos, useKudosGivers } from './queries';
const request = vi.hoisted(() => vi.fn());
vi.mock('./api', async (original) => ({
  ...(await original<typeof import('./api')>()),
  api: request,
}));
const clients: QueryClient[] = [];
beforeEach(() =>
  request
    .mockReset()
    .mockImplementation(async (endpoint: string) =>
      endpoint === 'GET /api/entries/:id/kudos' ? [] : undefined,
    ),
);
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});
function setup(enabled = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  return renderHook(
    ({ enabled }) => ({ givers: useKudosGivers('one', enabled), kudos: useKudos() }),
    {
      initialProps: { enabled },
      wrapper: ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
}
it('does not fetch givers until enabled', async () => {
  const { result, rerender } = setup(false);
  expect(request).not.toHaveBeenCalled();
  rerender({ enabled: true });
  await waitFor(() => expect(result.current.givers.isSuccess).toBe(true));
  expect(request).toHaveBeenCalledWith(
    'GET /api/entries/:id/kudos',
    expect.objectContaining({ params: { id: 'one' } }),
  );
});
for (const hasKudos of [true, false]) {
  it(`invalidates givers after ${hasKudos ? 'giving' : 'removing'} kudos`, async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.givers.isSuccess).toBe(true));
    await act(async () => {
      await result.current.kudos.mutateAsync({ id: 'one', hasKudos });
    });
    expect(
      request.mock.calls.filter(([endpoint]) => endpoint === 'GET /api/entries/:id/kudos'),
    ).toHaveLength(2);
    expect(request).toHaveBeenCalledWith(`${hasKudos ? 'POST' : 'DELETE'} /api/entries/:id/kudos`, {
      params: { id: 'one' },
    });
  });
}
it('defers invalidated givers while the sheet is closed', async () => {
  const { result, rerender } = setup();
  await waitFor(() => expect(result.current.givers.isSuccess).toBe(true));
  rerender({ enabled: false });
  await act(async () => {
    await result.current.kudos.mutateAsync({ id: 'one', hasKudos: true });
  });
  expect(
    request.mock.calls.filter(([endpoint]) => endpoint === 'GET /api/entries/:id/kudos'),
  ).toHaveLength(1);
  rerender({ enabled: true });
  await waitFor(() =>
    expect(
      request.mock.calls.filter(([endpoint]) => endpoint === 'GET /api/entries/:id/kudos'),
    ).toHaveLength(2),
  );
});
