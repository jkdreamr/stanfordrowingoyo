import { MutationCache, QueryCache, QueryClient, notifyManager } from '@tanstack/react-query';
import { ApiClientError } from './api';
import { qk } from './queries';
import type { Announcement, Notification } from '../../../shared/types';
export function createQueryClient() {
  const expireSession = (error: unknown) => {
    if (
      !(error instanceof ApiClientError) ||
      error.status !== 401 ||
      ['INVALID_CREDENTIALS', 'REAUTH_REQUIRED'].includes(error.detail.code)
    )
      return;
    notifyManager.batch(() => {
      void client.cancelQueries({ queryKey: qk.all }, { revert: false });
      client.removeQueries({
        predicate: (query) =>
          query.queryKey[0] === 'api' &&
          query.queryHash !==
            client.getQueryCache().find({ queryKey: qk.me(), exact: true })?.queryHash,
      });
      client.setQueryData(qk.me(), null);
      client.getQueryCache().find({ queryKey: qk.me(), exact: true })?.setState({
        status: 'error',
        error,
      });
    });
  };
  const client = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        expireSession(error);
        if (
          !(error instanceof ApiClientError) ||
          error.status !== 404 ||
          query.queryKey[2] !== 'GET /api/announcements/:id'
        )
          return;
        const id = (query.queryKey[3] as { params: { id: string } }).params.id;
        notifyManager.batch(() => {
          query.setState({ data: undefined, dataUpdatedAt: 0 });
          client.setQueryData<Announcement[]>(qk.request('GET /api/announcements', {}), (rows) =>
            rows?.filter((row) => row.id !== id),
          );
          client.setQueryData<Notification[]>(qk.request('GET /api/notifications', {}), (rows) =>
            rows?.filter((row) => row.kind !== 'announcement' || row.announcement_id !== id),
          );
          void client.invalidateQueries({ queryKey: qk.request('GET /api/notifications', {}) });
        });
      },
    }),
    mutationCache: new MutationCache({ onError: expireSession }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: (count, error) =>
          !(error instanceof ApiClientError && error.status >= 400 && error.status < 500) &&
          count < 1,
      },
      mutations: { retry: false },
    },
  });
  return client;
}
export const queryClient = createQueryClient();
