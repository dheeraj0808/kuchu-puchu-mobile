import { QueryClient } from '@tanstack/react-query';

/**
 * The app's single server-state cache (guide §7). Retries are handled once,
 * in the HTTP client, so React Query does not add its own on top.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 60_000, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});

export const queryKeys = {
  appConfig: ['appConfig'] as const,
  me: ['me'] as const,
};
