// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { qk, useKudos } from './queries';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('rolls optimistic kudos back when the network mutation fails', async () => {
  let reject!: (error: Error) => void;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise((_resolve, no) => {
          reject = no;
        }),
    ),
  );
  const client = createQueryClient();
  const entry = { id: 'one', has_kudos: false, kudos_count: 2 };
  client.setQueryData(qk.entry('one'), entry);
  const { result } = renderHook(() => useKudos(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  act(() => result.current.mutate({ id: 'one', hasKudos: true }));
  await waitFor(() =>
    expect(client.getQueryData(qk.entry('one'))).toEqual({
      ...entry,
      has_kudos: true,
      kudos_count: 3,
    }),
  );
  await act(async () => reject(new Error('Network unavailable')));
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(client.getQueryData(qk.entry('one'))).toEqual(entry);
  client.clear();
});
