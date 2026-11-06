import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from './api';
export function createQueryClient() {
  return new QueryClient({
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
}
export const queryClient = createQueryClient();
