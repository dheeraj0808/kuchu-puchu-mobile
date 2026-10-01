import { env } from '@/config/env';

import { ApiError, ErrorCode } from '../errors';
import type {
  AuthTokens,
  DeviceSession,
  Me,
  OnboardingStep,
  Preferences,
  Profile,
  UserLocation,
  MessageResponse,
  RequestOtpBody,
  RequestOtpResponse,
  ReauthRequestResponse,
  ReauthVerifyResponse,
  VerifyOtpBody,
} from '../types';

/**
 * In-app stand-in for backend M06/M07 (enabled by EXPO_PUBLIC_USE_AUTH_MOCK).
 * Follows the guide's contracts:
 *
 *   POST   /auth/otp/request {phone | email}       → always "Code sent"; 429 OTP_COOLDOWN + retryAfterSeconds
 *   POST   /auth/otp/verify  {phone | email, code} → tokens + user with nextStep; 401 OTP_INVALID
 *   GET    /auth/sessions                          → [{id, deviceName, city, lastActiveAt, isCurrent}]
 *   DELETE /auth/sessions/:id                      → sign out one device
 *   POST   /auth/logout-all                        → sign out every other device
 *   POST   /auth/reauth/request | /auth/reauth/verify → OTP step-up
 *   DELETE /account                                → 403 REAUTH_REQUIRED unless stepped up in the last 5 min
 *
 * Code 123456 succeeds everywhere, anything else fails. Refresh, /auth/me
 * and logout are mocked too, so a mocked session survives app restarts
 * without reaching the real backend.
 */

export const MOCK_OTP = '123456';

/** 403 ACCOUNT_RESTRICTED details for the EXPO_PUBLIC_MOCK_ACCOUNT_STATUS setting, or null when active. */
export function mockRestriction(now: number = Date.now()) {
  if (env.mockAccountStatus === 'active') return null;
  const banned = env.mockAccountStatus === 'banned';
  return {
    status: env.mockAccountStatus,
    reasonCategory: 'harassment',
    endsAt: banned ? null : new Date(now + 11 * 86_400_000).toISOString(),
    appealAllowed: env.mockAppealAllowed,
  };
}

/**
 * Other mocks (verification) add fields to /auth/me and may move nextStep,
 * without this file importing them (which would be circular).
 */
type MeExtension = (account: MockAccount) => Partial<Me>;
const meExtensions: MeExtension[] = [];
export function registerMeExtension(extension: MeExtension): void {
  meExtensions.push(extension);
}

const RESEND_AFTER_SECONDS = 60;
const EXPIRES_IN_SECONDS = 300;
const ACCESS_TTL_SECONDS = 900;
const REAUTH_VALID_SECONDS = 300;
const LATENCY_MS = 400;
const DAY_MS = 86_400_000;
const DEFAULT_IDENTIFIER = '+919876543210';

type IdentifierType = RequestOtpBody['identifierType'];
type ErrorFields = { status: number; code: string; details?: Record<string, unknown> };

/** Server-side account state: where onboarding is and the saved profile. */
export interface MockAccount {
  nextStep: OnboardingStep;
  profile: Profile | null;
  preferences?: Preferences | null;
  location?: UserLocation | null;
  notificationsChoiceAt?: string | null;
}

interface MockSession {
  id: string;
  identifier: string;
  identifierType: IdentifierType;
  refreshToken: string;
  accessToken: string;
  deviceName: string;
  city: string | null;
  lastActiveAt: number;
  /** Epoch ms of the last successful step-up on this session. */
  reauthAt: number | null;
}

export function createMockAuth(now: () => number = Date.now, delay = LATENCY_MS) {
  /** identifier → epoch ms of the last code sent. */
  const sentAt = new Map<string, number>();
  const sessions = new Map<string, MockSession>();
  const accounts = new Map<string, MockAccount>();
  /** New accounts start at EXPO_PUBLIC_AUTH_MOCK_NEXT_STEP (e.g. `profile`). */
  const accountOf = (identifier: string): MockAccount => {
    let account = accounts.get(identifier);
    if (!account) {
      account = { nextStep: env.authMockNextStep, profile: null };
      accounts.set(identifier, account);
    }
    return account;
  };
  let reauthSentAt: number | null = null;
  let counter = 0;

  const wait = () => (delay > 0 ? new Promise<void>((r) => setTimeout(r, delay)) : Promise.resolve());

  const fail = ({ status, code, details }: ErrorFields): never => {
    throw ApiError.fromResponse(status, { success: false, code, message: code, details, requestId: 'mock' }, null);
  };

  /** The session behind a token, without the restriction check (appeals, sign-out). */
  const sessionOf = (accessToken: string): MockSession => {
    for (const s of sessions.values()) if (s.accessToken === accessToken) return s;
    return fail({ status: 401, code: ErrorCode.Unauthorized });
  };
  /** Every other authenticated call: a restricted account gets 403 ACCOUNT_RESTRICTED (guide M15). */
  const byAccess = (accessToken: string): MockSession => {
    const s = sessionOf(accessToken);
    const restriction = mockRestriction(now());
    if (restriction) fail({ status: 403, code: ErrorCode.AccountRestricted, details: restriction });
    return s;
  };

  const rotate = (s: MockSession): AuthTokens => {
    counter += 1;
    s.refreshToken = `mock-refresh-${counter}`;
    s.accessToken = `mock-access-${counter}`;
    s.lastActiveAt = now();
    return {
      accessToken: s.accessToken,
      refreshToken: s.refreshToken,
      tokenType: 'Bearer',
      accessTokenExpiresIn: ACCESS_TTL_SECONDS,
      refreshTokenExpiresAt: new Date(now() + 7 * DAY_MS).toISOString(),
      user: mockUser(s.identifier, s.identifierType, accountOf(s.identifier).nextStep),
    };
  };

  /** A new sign-in on this device, plus one older device so screen 45 has something to show. */
  const openSession = (identifier: string, identifierType: IdentifierType, deviceName: string): AuthTokens => {
    counter += 1;
    const session: MockSession = {
      id: `sess-${counter}`,
      identifier,
      identifierType,
      refreshToken: '',
      accessToken: '',
      deviceName,
      city: 'Bengaluru',
      lastActiveAt: now(),
      reauthAt: null,
    };
    sessions.set(session.id, session);
    const hasOther = [...sessions.values()].some((s) => s.identifier === identifier && s.id !== session.id);
    if (!hasOther) {
      sessions.set(`sess-old-${counter}`, {
        ...session,
        id: `sess-old-${counter}`,
        refreshToken: `mock-other-${counter}`,
        accessToken: `mock-other-access-${counter}`,
        deviceName: 'Redmi Note 11',
        city: 'Mumbai',
        lastActiveAt: now() - 2 * DAY_MS,
      });
    }
    return rotate(session);
  };

  return {
    /** For other mocks (profile): the account behind an access token. */
    accountFor(accessToken: string): MockAccount {
      return accountOf(byAccess(accessToken).identifier);
    },

    /** Same, but allowed while restricted (POST /account/appeals). */
    accountForUnrestricted(accessToken: string): MockAccount {
      return accountOf(sessionOf(accessToken).identifier);
    },

    async requestOtp(body: RequestOtpBody): Promise<RequestOtpResponse> {
      await wait();
      const last = sentAt.get(body.identifier);
      const elapsed = last === undefined ? Infinity : (now() - last) / 1000;
      if (elapsed < RESEND_AFTER_SECONDS) {
        fail({ status: 429, code: ErrorCode.OtpCooldown, details: { retryAfterSeconds: Math.ceil(RESEND_AFTER_SECONDS - elapsed) } });
      }
      sentAt.set(body.identifier, now());
      // Same reply whether or not an account exists.
      return { message: 'Code sent', expiresInSeconds: EXPIRES_IN_SECONDS, resendAfterSeconds: RESEND_AFTER_SECONDS };
    },

    async verifyOtp(body: VerifyOtpBody): Promise<AuthTokens> {
      await wait();
      const sent = sentAt.get(body.identifier);
      const expired = sent === undefined || now() - sent > EXPIRES_IN_SECONDS * 1000;
      if (expired || body.otp !== MOCK_OTP) fail({ status: 401, code: ErrorCode.OtpInvalid });
      return openSession(body.identifier, body.identifierType, body.deviceName ?? 'This phone');
    },

    async refreshSession(refreshToken: string): Promise<AuthTokens> {
      await wait();
      for (const s of sessions.values()) if (s.refreshToken === refreshToken) return rotate(s);
      // After an app restart the in-memory state is empty: rebuild a session from any mock token.
      if (refreshToken.startsWith('mock-refresh-')) return openSession(DEFAULT_IDENTIFIER, 'phone', 'This phone');
      return fail({ status: 401, code: ErrorCode.InvalidRefreshToken });
    },

    async logout(refreshToken: string): Promise<MessageResponse> {
      await wait();
      for (const s of sessions.values()) if (s.refreshToken === refreshToken) sessions.delete(s.id);
      return { message: 'Logged out' };
    },

    async fetchMe(accessToken: string): Promise<Me> {
      await wait();
      const s = byAccess(accessToken);
      const account = accountOf(s.identifier);
      const extra = Object.assign({}, ...meExtensions.map((extend) => extend(account))) as Partial<Me>;
      return {
        ...extra,
        ...mockUser(s.identifier, s.identifierType, account.nextStep),
        profile: account.profile,
        preferences: account.preferences ?? null,
        location: account.location ?? null,
        notificationsChoiceAt: account.notificationsChoiceAt ?? null,
        plan: 'plus',
      };
    },

    async listSessions(accessToken: string): Promise<DeviceSession[]> {
      await wait();
      const current = byAccess(accessToken);
      current.lastActiveAt = now();
      return [...sessions.values()]
        .filter((s) => s.identifier === current.identifier)
        .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
        .map((s) => ({
          id: s.id,
          deviceName: s.deviceName,
          city: s.city,
          lastActiveAt: new Date(s.lastActiveAt).toISOString(),
          isCurrent: s.id === current.id,
        }));
    },

    async revokeSession(accessToken: string, id: string): Promise<MessageResponse> {
      await wait();
      const current = byAccess(accessToken);
      const target = sessions.get(id);
      if (!target || target.identifier !== current.identifier) fail({ status: 404, code: ErrorCode.NotFound });
      sessions.delete(id);
      return { message: 'Signed out' };
    },

    async logoutAll(accessToken: string): Promise<MessageResponse> {
      await wait();
      const current = byAccess(accessToken);
      for (const s of [...sessions.values()]) {
        if (s.identifier === current.identifier && s.id !== current.id) sessions.delete(s.id);
      }
      return { message: 'Signed out of all other devices' };
    },

    async requestReauth(accessToken: string): Promise<ReauthRequestResponse> {
      await wait();
      byAccess(accessToken);
      const elapsed = reauthSentAt === null ? Infinity : (now() - reauthSentAt) / 1000;
      if (elapsed < RESEND_AFTER_SECONDS) {
        fail({ status: 429, code: ErrorCode.OtpCooldown, details: { retryAfterSeconds: Math.ceil(RESEND_AFTER_SECONDS - elapsed) } });
      }
      reauthSentAt = now();
      return { expiresInSeconds: EXPIRES_IN_SECONDS, resendAfterSeconds: RESEND_AFTER_SECONDS };
    },

    async verifyReauth(accessToken: string, code: string): Promise<ReauthVerifyResponse> {
      await wait();
      const current = byAccess(accessToken);
      if (code !== MOCK_OTP) fail({ status: 401, code: ErrorCode.OtpInvalid });
      current.reauthAt = now();
      reauthSentAt = null;
      return { validForSeconds: REAUTH_VALID_SECONDS };
    },

    async deleteAccount(accessToken: string): Promise<MessageResponse> {
      await wait();
      const current = byAccess(accessToken);
      const fresh = current.reauthAt !== null && now() - current.reauthAt <= REAUTH_VALID_SECONDS * 1000;
      if (!fresh) fail({ status: 403, code: ErrorCode.ReauthRequired });
      for (const s of [...sessions.values()]) if (s.identifier === current.identifier) sessions.delete(s.id);
      accounts.delete(current.identifier);
      return { message: 'Account deleted' };
    },
  };
}

export type MockAuth = ReturnType<typeof createMockAuth>;

function mockUser(identifier: string, type: IdentifierType, nextStep: OnboardingStep) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email: type === 'email' ? identifier : null,
    phone: type === 'phone' ? identifier : null,
    emailVerified: type === 'email',
    phoneVerified: type === 'phone',
    status: 'active' as const,
    role: 'user' as const,
    createdAt: '2026-10-01T00:00:00.000Z',
    nextStep,
  };
}

export const mockAuth = createMockAuth();
