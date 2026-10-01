import { env } from '@/config/env';

import { authedRequest } from '../client';
import { mockPreferences } from '../mocks/preferences';
import type { Preferences } from '../types';

/** Discovery preferences (guide M10), relative to /api/v1. */
export const PREFERENCES_ENDPOINTS = { preferences: '/preferences' } as const;

const mock = env.useAuthMock ? mockPreferences : null;

/** Screen 14 (and the Filters sheet later). Saving also flushes the local discovery queue (guide §7). */
export function putPreferences(body: Preferences): Promise<Preferences> {
  if (mock) return mock.putPreferences(body);
  return authedRequest<Preferences>(PREFERENCES_ENDPOINTS.preferences, { method: 'PUT', body, retry: true });
}
