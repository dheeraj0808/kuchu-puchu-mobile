import { useQuery } from '@tanstack/react-query';

import { fetchLaunchState, type LaunchState } from '@/api/appConfig';
import { ApiError, isApiError } from '@/api/errors';
import { queryKeys } from '@/lib/queryClient';

export type LaunchGate =
  | { kind: 'checking' }
  | LaunchState
  | { kind: 'offline'; error: ApiError }
  | { kind: 'error'; error: ApiError };

export interface UseLaunchState {
  gate: LaunchGate;
  /** Re-checks /app/config (Try again on screens 05 and 50). */
  recheck: () => Promise<void>;
  rechecking: boolean;
}

/** While the app is blocked, re-check every minute so it unblocks on its own. */
const BLOCKED_RECHECK_MS = 60_000;

/**
 * /app/config decides whether the app may start (guide §6 "Force update").
 * Re-checked on every return to the foreground and when the network comes back.
 */
export function useLaunchState(): UseLaunchState {
  const query = useQuery({
    queryKey: queryKeys.appConfig,
    queryFn: () => fetchLaunchState(),
    staleTime: 5 * 60_000,
    // Offline or planned downtime: poll so the user doesn't have to.
    refetchInterval: (q) => {
      const data = q.state.data;
      return q.state.error || data?.kind === 'maintenance' ? BLOCKED_RECHECK_MS : false;
    },
  });

  const recheck = async (): Promise<void> => {
    await query.refetch();
  };

  return { gate: toGate(query.data, query.error), recheck, rechecking: query.isFetching };
}

function toGate(data: LaunchState | undefined, error: unknown): LaunchGate {
  // A successful earlier check keeps the app usable through a later failed re-check.
  if (data) return data;
  if (!error) return { kind: 'checking' };
  const apiError = isApiError(error) ? error : ApiError.network();
  return apiError.isNetworkError ? { kind: 'offline', error: apiError } : { kind: 'error', error: apiError };
}
