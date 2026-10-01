import { session } from '@/auth/session';
import { preferencesProblem } from '@/features/onboarding/preferences';

import { ApiError, ErrorCode } from '../errors';
import type { City, LocationBody, MessageResponse, Preferences, PushDeviceBody, UserLocation } from '../types';
import { mockAuth, type MockAccount } from './auth';

/**
 * In-app stand-in for M10 (preferences, location) and M20 (push devices):
 *   PUT /preferences · PUT /profile/location · GET /catalog/cities?q= (assumed) · PUT /notifications/devices
 * Once preferences, location and the notifications choice are all saved,
 * nextStep moves from `preferences` to `done`. Coordinates are accepted and
 * immediately reduced to a city; they are never kept.
 */

const LATENCY_MS = 400;

export const CITIES: City[] = [
  { id: 'blr', name: 'Bengaluru', state: 'Karnataka' },
  { id: 'bgm', name: 'Belagavi', state: 'Karnataka' },
  { id: 'blr-rural', name: 'Bengaluru Rural', state: 'Karnataka' },
  { id: 'bpl', name: 'Bhopal', state: 'Madhya Pradesh' },
  { id: 'mum', name: 'Mumbai', state: 'Maharashtra' },
  { id: 'pune', name: 'Pune', state: 'Maharashtra' },
  { id: 'del', name: 'New Delhi', state: 'Delhi' },
  { id: 'hyd', name: 'Hyderabad', state: 'Telangana' },
  { id: 'chn', name: 'Chennai', state: 'Tamil Nadu' },
  { id: 'kol', name: 'Kolkata', state: 'West Bengal' },
  { id: 'jai', name: 'Jaipur', state: 'Rajasthan' },
  { id: 'ahd', name: 'Ahmedabad', state: 'Gujarat' },
  { id: 'koc', name: 'Kochi', state: 'Kerala' },
  { id: 'lko', name: 'Lucknow', state: 'Uttar Pradesh' },
];

export function createMockPreferences(
  resolve: (accessToken: string) => MockAccount,
  token: () => Promise<string | null>,
  now: () => number = Date.now,
  delay = LATENCY_MS,
) {
  const wait = () => (delay > 0 ? new Promise<void>((r) => setTimeout(r, delay)) : Promise.resolve());
  const fail = (status: number, code: string, details?: Record<string, unknown>): never => {
    throw ApiError.fromResponse(status, { success: false, code, message: code, details, requestId: 'mock' }, null);
  };
  const account = async (): Promise<MockAccount> => {
    await wait();
    const t = await token();
    if (!t) throw ApiError.sessionExpired();
    return resolve(t);
  };
  const advance = (acc: MockAccount) => {
    if (acc.nextStep === 'preferences' && acc.preferences && acc.location && acc.notificationsChoiceAt) acc.nextStep = 'done';
  };

  return {
    async putPreferences(body: Preferences): Promise<Preferences> {
      const acc = await account();
      if (preferencesProblem(body)) fail(400, ErrorCode.ValidationError, { errors: ['preferences are out of range'] });
      acc.preferences = { ...body };
      advance(acc);
      return acc.preferences;
    },

    async putLocation(body: LocationBody): Promise<UserLocation> {
      const acc = await account();
      if ('cityId' in body) {
        const city = CITIES.find((c) => c.id === body.cityId) ?? fail(404, ErrorCode.NotFound);
        acc.location = { source: 'city', city: city.name };
      } else {
        const valid = Math.abs(body.lat) <= 90 && Math.abs(body.lng) <= 180;
        if (!valid) fail(400, ErrorCode.ValidationError);
        // A real server would reverse-geocode; the mock just keeps "near you".
        acc.location = { source: 'gps', city: null };
      }
      advance(acc);
      return acc.location;
    },

    async searchCities(query: string): Promise<City[]> {
      await wait();
      const q = query.trim().toLowerCase();
      if (!q) return [];
      return CITIES.filter((c) => c.name.toLowerCase().startsWith(q) || c.name.toLowerCase().includes(` ${q}`)).slice(0, 8);
    },

    async putPushDevice(body: PushDeviceBody): Promise<MessageResponse> {
      const acc = await account();
      acc.notificationsChoiceAt = acc.notificationsChoiceAt ?? new Date(now()).toISOString();
      advance(acc);
      return { message: body.token ? 'Device registered' : 'Push declined' };
    },
  };
}

export const mockPreferences = createMockPreferences(
  (t) => mockAuth.accountFor(t),
  () => session.getAccessToken(),
);
