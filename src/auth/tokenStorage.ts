import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Persistent storage for the refresh token and device id only.
 * The access token is short-lived and is kept in memory, never persisted.
 *
 * Native: Keychain / Keystore via expo-secure-store, device-bound.
 * Web: SecureStore is unavailable and the backend issues bearer tokens (no
 * httpOnly cookies), so sessionStorage is used — scoped to the tab and
 * cleared when it closes.
 *
 * All operations swallow storage failures: auth must degrade to an
 * in-memory session rather than crash.
 */

const KEYS = {
  refreshToken: 'kp.refresh_token',
  deviceId: 'kp.device_id',
} as const;

type Key = (typeof KEYS)[keyof typeof KEYS];

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const isWeb = Platform.OS === 'web';

function webStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

async function getItem(key: Key): Promise<string | null> {
  try {
    if (isWeb) return webStorage()?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key, SECURE_OPTIONS);
  } catch {
    return null;
  }
}

async function setItem(key: Key, value: string): Promise<boolean> {
  try {
    if (isWeb) {
      const storage = webStorage();
      if (!storage) return false;
      storage.setItem(key, value);
      return true;
    }
    await SecureStore.setItemAsync(key, value, SECURE_OPTIONS);
    return true;
  } catch {
    return false;
  }
}

async function removeItem(key: Key): Promise<void> {
  try {
    if (isWeb) {
      webStorage()?.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key, SECURE_OPTIONS);
  } catch {
    // Nothing more we can do; the in-memory session is cleared regardless.
  }
}

export const tokenStorage = {
  getRefreshToken: () => getItem(KEYS.refreshToken),
  setRefreshToken: (token: string) => setItem(KEYS.refreshToken, token),
  clearRefreshToken: () => removeItem(KEYS.refreshToken),
  getDeviceId: () => getItem(KEYS.deviceId),
  setDeviceId: (id: string) => setItem(KEYS.deviceId, id),
};
