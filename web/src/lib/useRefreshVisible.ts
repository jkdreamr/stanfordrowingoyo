import { useQueryClient } from '@tanstack/react-query';
import { qk } from './queries';

export function useRefreshVisible() {
  const client = useQueryClient();
  return () =>
    Promise.all(
      client
        .getQueryCache()
        .findAll({ queryKey: qk.all, type: 'active' })
        .map((query) =>
          client.refetchQueries(
            { queryKey: query.queryKey, exact: true, type: 'active' },
            { throwOnError: true },
          ),
        ),
    );
}
