import type { Preferences, ShowMe } from '@/api/types';

/** Guide §9.2 screen 12: age range 18–100, distance 1–200 km. */
export const AGE_MIN = 18;
export const AGE_MAX = 100;
export const DISTANCE_MIN_KM = 1;
export const DISTANCE_MAX_KM = 200;
export const DEFAULT_DISTANCE_KM = 25;

export type PreferencesProblem = 'showMe' | 'ageOrder' | 'ageRange' | 'distance' | null;

export function preferencesProblem(p: Partial<Preferences>): PreferencesProblem {
  if (!p.showMe) return 'showMe';
  const { ageMin = NaN, ageMax = NaN, maxDistanceKm = NaN } = p;
  if (![ageMin, ageMax].every((a) => Number.isInteger(a) && a >= AGE_MIN && a <= AGE_MAX)) return 'ageRange';
  if (ageMin > ageMax) return 'ageOrder';
  if (!Number.isInteger(maxDistanceKm) || maxDistanceKm < DISTANCE_MIN_KM || maxDistanceKm > DISTANCE_MAX_KM) return 'distance';
  return null;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** A sensible starting range around the user's own age (deck: 26 → 24 to 32). */
export function defaultAgeRange(age: number | null): [number, number] {
  if (age === null) return [24, 32];
  return [clamp(age - 2, AGE_MIN, AGE_MAX), clamp(age + 6, AGE_MIN, AGE_MAX)];
}

export const SHOW_ME: readonly ShowMe[] = ['men', 'women', 'everyone'];
