import * as Location from 'expo-location';

import { roundCoordinate } from '@/lib/locationThrottle';

/**
 * Screen 15: foreground permission only (never background, guide §12.1),
 * low accuracy, coordinates rounded to ~1 km before they leave this function.
 * Nothing is stored or logged on the phone.
 */
export type LocationOutcome =
  | { kind: 'granted'; lat: number; lng: number }
  /** Permission refused (or "Don't ask again"): offer the city picker (screen 17). */
  | { kind: 'denied' }
  /** Permission given but no fix (GPS off, timeout): also fall back to the city picker. */
  | { kind: 'unavailable' };

export interface LocationDeps {
  requestPermission: () => Promise<{ granted: boolean }>;
  getPosition: () => Promise<{ coords: { latitude: number; longitude: number } }>;
}

const nativeDeps: LocationDeps = {
  requestPermission: () => Location.requestForegroundPermissionsAsync(),
  getPosition: () => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
};

export async function requestApproximateLocation(deps: LocationDeps = nativeDeps): Promise<LocationOutcome> {
  const permission = await deps.requestPermission().catch(() => ({ granted: false }));
  if (!permission.granted) return { kind: 'denied' };
  try {
    const { coords } = await deps.getPosition();
    return { kind: 'granted', lat: roundCoordinate(coords.latitude), lng: roundCoordinate(coords.longitude) };
  } catch {
    return { kind: 'unavailable' };
  }
}
