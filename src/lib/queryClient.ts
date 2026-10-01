import { QueryClient } from '@tanstack/react-query';

/**
 * The app's single server-state cache (guide §7). Retries are handled once,
 * in the HTTP client, so React Query does not add its own on top.
 *
 * networkMode 'always': requests always run and the HTTP client reports
 * offline as an error (→ Offline screen / banner). With React Query's default
 * the query is silently *paused* whenever NetInfo thinks there is no
 * internet — which it often reports wrongly on emulators and captive or
 * LAN-only Wi-Fi — leaving the launch gate on a blank screen forever.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 60_000, refetchOnWindowFocus: true, networkMode: 'always' },
    mutations: { retry: false, networkMode: 'always' },
  },
});

export const queryKeys = {
  appConfig: ['appConfig'] as const,
  me: ['me'] as const,
  sessions: ['sessions'] as const,
};
