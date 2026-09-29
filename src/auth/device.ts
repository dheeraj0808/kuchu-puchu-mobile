import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { tokenStorage } from './tokenStorage';

/** Backend VerifyOtpDto: deviceId must match /^[A-Za-z0-9._:-]{1,128}$/, deviceName ≤ 128 chars. */
const DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const MAX_DEVICE_NAME = 128;

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
}

let cachedDeviceId: string | null = null;

/**
 * A random per-install identifier. Sending it lets the backend replace this
 * device's previous session on re-login instead of accumulating sessions.
 */
async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  const stored = await tokenStorage.getDeviceId();
  if (stored && DEVICE_ID_PATTERN.test(stored)) {
    cachedDeviceId = stored;
    return stored;
  }
  const generated = `${Platform.OS}:${Crypto.randomUUID()}`;
  await tokenStorage.setDeviceId(generated);
  cachedDeviceId = generated;
  return generated;
}

function getDeviceName(): string {
  const candidates = [
    Device.deviceName,
    [Device.manufacturer, Device.modelName].filter(Boolean).join(' '),
    Platform.OS === 'web' ? 'Web browser' : 'Mobile device',
  ];
  const name = candidates.find((c): c is string => typeof c === 'string' && c.trim().length > 0) ?? 'Device';
  return name.trim().slice(0, MAX_DEVICE_NAME);
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
  return { deviceId: await getDeviceId(), deviceName: getDeviceName() };
}
