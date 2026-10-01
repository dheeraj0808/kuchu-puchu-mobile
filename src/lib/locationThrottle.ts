/**
 * Guide §13 rule 4: location is sent at most every 15 minutes and never
 * stored on the phone. Only the time of the last send is kept, in memory.
 */
export const LOCATION_MIN_INTERVAL_MS = 15 * 60_000;

export function createLocationThrottle(now: () => number = Date.now, interval = LOCATION_MIN_INTERVAL_MS) {
  let lastSentAt: number | null = null;
  return {
    /** True when a new location may be sent now. */
    canSend(): boolean {
      return lastSentAt === null || now() - lastSentAt >= interval;
    },
    markSent(): void {
      lastSentAt = now();
    },
    reset(): void {
      lastSentAt = null;
    },
  };
}

export const locationThrottle = createLocationThrottle();

/** ~1 km precision: the server only needs the approximate area (deck 15). */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}
