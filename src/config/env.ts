import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { OnboardingStep } from '@/api/types';

/**
 * Public runtime configuration. EXPO_PUBLIC_* variables are inlined at build
 * time, so they must be read with static `process.env.EXPO_PUBLIC_X` access.
 * Nothing here may be secret.
 */

export type AppEnv = 'development' | 'staging' | 'production';

/** Backend global prefix is /api/v1 (backend/src/common/constants.ts). */
const DEV_FALLBACK_API_URL = 'http://localhost:3000/api/v1';
const DEFAULT_WEBSITE_URL = 'https://kuchupuchu.in';

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

/** The installed build's version (what the store shipped), not the JS bundle's. */
function readAppVersion(): string {
  return Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.0.0';
}

/** Backend accepts X-Platform android | ios; other platforms send none. */
function readPlatform(): 'android' | 'ios' | null {
  return Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : null;
}

function readNextStep(raw: string | undefined): OnboardingStep {
  const steps: readonly OnboardingStep[] = ['selfie', 'photos', 'profile', 'preferences', 'done'];
  return steps.find((step) => step === raw) ?? 'done';
}

const appEnv = readAppEnv(process.env.EXPO_PUBLIC_APP_ENV);
const websiteUrl = (process.env.EXPO_PUBLIC_WEBSITE_URL?.trim() || DEFAULT_WEBSITE_URL).replace(/\/+$/, '');

export const env = {
  appEnv,
  apiUrl: readApiUrl(process.env.EXPO_PUBLIC_API_URL, appEnv),
  appVersion: readAppVersion(),
  /** Store build number (Android versionCode), shown as "Version 1.0.0 (42)". */
  buildNumber: Application.nativeBuildVersion ?? null,
  platform: readPlatform(),
  /** Android package / iOS bundle id of this build; used for the store link. */
  applicationId: Application.applicationId,
  termsUrl: `${websiteUrl}/terms`,
  privacyUrl: `${websiteUrl}/privacy`,
  /**
   * USE_AUTH_MOCK: serve auth from src/api/mocks/auth.ts until backend M06
   * ships the guide's contract. Ignored in production builds.
   */
  useAuthMock: appEnv !== 'production' && process.env.EXPO_PUBLIC_USE_AUTH_MOCK === 'true',
  /** nextStep the mock returns after sign-in (routes the gate). */
  authMockNextStep: readNextStep(process.env.EXPO_PUBLIC_AUTH_MOCK_NEXT_STEP),
  /** Mirrors backend OTP_LENGTH (backend accepts 4–10 digits). */
  otpLength: readInt(process.env.EXPO_PUBLIC_OTP_LENGTH, 6, 4, 10),
  /** Mirrors backend OTP_MAX_ATTEMPTS; used only to guide the user. */
  otpMaxAttempts: readInt(process.env.EXPO_PUBLIC_OTP_MAX_ATTEMPTS, 5, 1, 20),
  /** Guide §6: 15 s default. */
  requestTimeoutMs: 15_000,
  logoutTimeoutMs: 5_000,
  /** Guide §6: GET and idempotent writes retry at most twice. */
  maxRetries: 2,
  retryBaseDelayMs: 500,
} as const;
