import { useState } from 'react';

import type { AppConfig } from '@/api/appConfig';
import type { ApiError } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';

import { useLaunchState } from './useLaunchState';

export type Blocker = 'updateRequired' | 'maintenance' | 'offline' | 'error';

export interface LaunchBlocker {
  /** Still checking config or the stored session: keep the splash screen up. */
  pending: boolean;
  blocker: Blocker | null;
  error: ApiError | null;
  config: AppConfig | null;
  /** Re-checks /app/config and, if needed, the stored session. */
  retry: () => Promise<void>;
  retrying: boolean;
}

/**
 * Everything that can stop the app from opening normally, in priority order:
 * update required (screen 04) → maintenance (05) → offline (50) → error.
 * Combines /app/config with the session restore, which run in parallel.
 */
export function useLaunchBlocker(): LaunchBlocker {
  const { gate, recheck, rechecking } = useLaunchState();
  const { status, restoreError, retryRestore } = useAuth();
  const [restoring, setRestoring] = useState(false);

  const retry = async (): Promise<void> => {
    setRestoring(true);
    try {
      await Promise.all([recheck(), status === 'unknown' ? retryRestore() : Promise.resolve()]);
    } finally {
      setRestoring(false);
    }
  };

  const base = { retry, retrying: rechecking || restoring };
  const config = 'config' in gate ? gate.config : null;

  if (gate.kind === 'updateRequired') return { ...base, pending: false, blocker: 'updateRequired', error: null, config };
  if (gate.kind === 'maintenance') return { ...base, pending: false, blocker: 'maintenance', error: null, config };
  if (gate.kind === 'offline') return { ...base, pending: false, blocker: 'offline', error: gate.error, config };
  if (gate.kind === 'error') return { ...base, pending: false, blocker: 'error', error: gate.error, config };

  if (status === 'unknown' && restoreError) {
    const blocker: Blocker = restoreError.isNetworkError ? 'offline' : 'error';
    return { ...base, pending: false, blocker, error: restoreError, config };
  }

  const pending = gate.kind === 'checking' || status === 'unknown';
  return { ...base, pending, blocker: null, error: null, config };
}
