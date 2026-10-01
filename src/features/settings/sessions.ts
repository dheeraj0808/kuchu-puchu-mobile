import { useQuery } from '@tanstack/react-query';

import * as accountApi from '@/api/account';
import type { DeviceSession } from '@/api/types';
import { t } from '@/i18n';
import { queryKeys } from '@/lib/queryClient';

export interface SplitSessions {
  current: DeviceSession | null;
  others: DeviceSession[];
}

/** Screen 45: this device on top, the rest most recent first. */
export function splitSessions(sessions: readonly DeviceSession[]): SplitSessions {
  const current = sessions.find((s) => s.isCurrent) ?? null;
  const others = sessions
    .filter((s) => !s.isCurrent)
    .sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt));
  return { current, others };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "active now", "5 minutes ago", "2 days ago", "3 weeks ago". */
export function formatLastActive(iso: string, now: number = Date.now()): string {
  const elapsed = Math.max(0, now - Date.parse(iso));
  if (!Number.isFinite(elapsed) || elapsed < 5 * MINUTE) return t('devices.activeNow');
  const pick = (count: number, one: Parameters<typeof t>[0], many: Parameters<typeof t>[0]) =>
    t(count === 1 ? one : many, { count });
  if (elapsed < HOUR) return pick(Math.floor(elapsed / MINUTE), 'devices.minuteAgo', 'devices.minutesAgo');
  if (elapsed < DAY) return pick(Math.floor(elapsed / HOUR), 'devices.hourAgo', 'devices.hoursAgo');
  if (elapsed < 14 * DAY) return pick(Math.floor(elapsed / DAY), 'devices.dayAgo', 'devices.daysAgo');
  return pick(Math.floor(elapsed / (7 * DAY)), 'devices.weekAgo', 'devices.weeksAgo');
}

/** "Bengaluru, active now" / "Mumbai, 2 days ago" / "2 days ago" when the city is unknown. */
export function describeSession(session: DeviceSession, now: number = Date.now()): string {
  const when = session.isCurrent ? t('devices.activeNow') : formatLastActive(session.lastActiveAt, now);
  return session.city ? t('devices.cityAndTime', { city: session.city, time: when }) : when;
}

export function useSessions() {
  return useQuery({ queryKey: queryKeys.sessions, queryFn: accountApi.listSessions, staleTime: 30_000 });
}
