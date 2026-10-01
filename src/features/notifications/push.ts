import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { env } from '@/config/env';

/** Guide §12.2 Android notification channels. */
export const ANDROID_CHANNELS = [
  { id: 'matches', name: 'Matches', importance: Notifications.AndroidImportance.HIGH },
  { id: 'messages', name: 'Messages', importance: Notifications.AndroidImportance.HIGH },
  { id: 'likes', name: 'Likes', importance: Notifications.AndroidImportance.DEFAULT },
  { id: 'account_security', name: 'Account & security', importance: Notifications.AndroidImportance.HIGH },
  { id: 'calls', name: 'Calls', importance: Notifications.AndroidImportance.MAX },
] as const;

export interface PushDeps {
  platform: typeof Platform.OS;
  setChannel: (id: string, channel: { name: string; importance: Notifications.AndroidImportance }) => Promise<unknown>;
  requestPermission: () => Promise<{ granted: boolean }>;
  getDeviceToken: () => Promise<{ data: unknown }>;
  useMock: boolean;
  fakeToken: () => string;
}

const nativeDeps: PushDeps = {
  platform: Platform.OS,
  setChannel: (id, channel) => Notifications.setNotificationChannelAsync(id, channel),
  requestPermission: () => Notifications.requestPermissionsAsync(),
  getDeviceToken: () => Notifications.getDevicePushTokenAsync(),
  useMock: env.useAuthMock,
  fakeToken: () => `mock-fcm-${Crypto.randomUUID()}`,
};

/**
 * Creates the channels. On Android 13+ a channel must exist before the OS
 * will show the notification permission prompt, so this runs first.
 */
export async function ensureNotificationChannels(deps: PushDeps = nativeDeps): Promise<void> {
  if (deps.platform !== 'android') return;
  await Promise.all(ANDROID_CHANNELS.map((c) => deps.setChannel(c.id, { name: c.name, importance: c.importance })));
}

export type PushOutcome = { granted: false } | { granted: true; token: string | null };

/**
 * Screen 16 "Turn on notifications": channels → OS prompt → native FCM token.
 * Without Firebase configured (Expo Go, web, no google-services.json) the
 * token call fails; mock mode then uses a fake token so the flow completes.
 */
export async function enablePush(deps: PushDeps = nativeDeps): Promise<PushOutcome> {
  await ensureNotificationChannels(deps).catch(() => undefined);
  const permission = await deps.requestPermission().catch(() => ({ granted: false }));
  if (!permission.granted) return { granted: false };
  try {
    const { data } = await deps.getDeviceToken();
    return { granted: true, token: typeof data === 'string' && data ? data : null };
  } catch {
    return { granted: true, token: deps.useMock ? deps.fakeToken() : null };
  }
}

export function pushPlatform(os: typeof Platform.OS = Platform.OS): 'android' | 'ios' | 'web' {
  return os === 'ios' ? 'ios' : os === 'android' ? 'android' : 'web';
}
