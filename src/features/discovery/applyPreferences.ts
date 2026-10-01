import { putPreferences } from '@/api/endpoints/preferences';
import type { Preferences } from '@/api/types';

import { discoveryQueue } from './queue';

/** Screen 25 "Widen distance to 50 km" (and further each time, up to 200). */
export function widenedDistance(currentKm: number): number {
  if (currentKm < 50) return 50;
  return Math.min(200, currentKm + 50);
}

interface Deps {
  save: (p: Preferences) => Promise<unknown>;
  reloadUser: () => Promise<unknown>;
  flush: () => Promise<void>;
}

/**
 * Filters (20) and the empty state (25): PUT /preferences, refresh /auth/me,
 * then flush the local queue and refetch (guide §7: save → flush the discovery queue).
 */
export async function applyPreferences(prefs: Preferences, deps: Omit<Deps, 'save' | 'flush'> & Partial<Deps>): Promise<void> {
  await (deps.save ?? putPreferences)(prefs);
  await deps.reloadUser().catch(() => undefined);
  await (deps.flush ?? discoveryQueue.flush)();
}
