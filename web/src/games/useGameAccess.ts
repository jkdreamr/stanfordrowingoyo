import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { qk, useConfig } from '../lib/queries';

export function useGameAccess() {
  const config = useConfig();
  return useQuery({
    queryKey: [...qk.root('games'), 'access', config.data?.today],
    queryFn: ({ signal }) => api('GET /api/games/access', { signal }),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}
export function useGamesToday() {
  const config = useConfig();
  return useQuery({
    queryKey: [...qk.root('games'), 'today', config.data?.today],
    queryFn: ({ signal }) => api('GET /api/games', { signal }),
  });
}
