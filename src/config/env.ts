/**
 * Public runtime configuration. EXPO_PUBLIC_* variables are inlined at build
 * time, so they must be read with static `process.env.EXPO_PUBLIC_X` access.
 * Nothing here may be secret.
 */

export type AppEnv = 'development' | 'staging' | 'production';

const DEV_FALLBACK_API_URL = 'http://localhost:3000/api';

function readInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

function readAppEnv(raw: string | undefined): AppEnv {
  if (raw === 'staging' || raw === 'production') return raw;
  return 'development';
}

function readApiUrl(raw: string | undefined, appEnv: AppEnv): string {
  const value = raw?.trim().replace(/\/+$/, '');
  if (!value) {
    if (appEnv !== 'development') {
      throw new Error('EXPO_PUBLIC_API_URL must be set outside development');
    }
    return DEV_FALLBACK_API_URL;
  }
  if (appEnv !== 'development' && !value.startsWith('https://')) {
    throw new Error('EXPO_PUBLIC_API_URL must use HTTPS outside development');
  }
  return value;
}

const appEnv = readAppEnv(process.env.EXPO_PUBLIC_APP_ENV);

export const env = {
  appEnv,
  apiUrl: readApiUrl(process.env.EXPO_PUBLIC_API_URL, appEnv),
  /** Mirrors backend OTP_LENGTH (backend accepts 4–10 digits). */
  otpLength: readInt(process.env.EXPO_PUBLIC_OTP_LENGTH, 6, 4, 10),
  /** Mirrors backend OTP_MAX_ATTEMPTS; used only to guide the user. */
  otpMaxAttempts: readInt(process.env.EXPO_PUBLIC_OTP_MAX_ATTEMPTS, 5, 1, 20),
  requestTimeoutMs: 15_000,
  logoutTimeoutMs: 5_000,
} as const;
