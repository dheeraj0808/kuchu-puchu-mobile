import { putLocation } from '@/api/endpoints/location';
import type { LocationBody, UserLocation } from '@/api/types';
import { locationThrottle } from '@/lib/locationThrottle';

/**
 * PUT /profile/location, never more than once per 15 minutes for GPS fixes
 * (guide §13 rule 4). A city choice is the user's explicit pick and always goes.
 * Returns null when a GPS update was skipped by the throttle.
 */
export async function sendLocation(
  body: LocationBody,
  deps = { put: putLocation, throttle: locationThrottle },
): Promise<UserLocation | null> {
  const isGps = 'lat' in body;
  if (isGps && !deps.throttle.canSend()) return null;
  const result = await deps.put(body);
  if (isGps) deps.throttle.markSent();
  return result;
}
