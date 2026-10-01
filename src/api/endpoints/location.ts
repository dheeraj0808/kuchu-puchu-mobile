import { env } from '@/config/env';

import { authedRequest } from '../client';
import { mockPreferences } from '../mocks/preferences';
import type { City, LocationBody, UserLocation } from '../types';

/** Location endpoints, relative to /api/v1. */
export const LOCATION_ENDPOINTS = {
  /** Guide M09/M10. */
  profileLocation: '/profile/location',
  /**
   * ASSUMPTION — not in the developer guide. The city picker (deck 17) needs a
   * searchable list; confirm the path and shape with the backend team.
   */
  citySearch: '/catalog/cities',
} as const;

const mock = env.useAuthMock ? mockPreferences : null;

/** Screens 15 and 17. Sent at most once every 15 minutes (see lib/locationThrottle). */
export function putLocation(body: LocationBody): Promise<UserLocation> {
  if (mock) return mock.putLocation(body);
  return authedRequest<UserLocation>(LOCATION_ENDPOINTS.profileLocation, { method: 'PUT', body, retry: true });
}

/** Screen 17. `GET /catalog/cities?q=` (assumed endpoint). */
export function searchCities(query: string, signal?: AbortSignal): Promise<City[]> {
  if (mock) return mock.searchCities(query);
  return authedRequest<City[]>(`${LOCATION_ENDPOINTS.citySearch}?q=${encodeURIComponent(query)}`, { signal });
}
