import { withReauth } from '@/auth/reauth';
import { session } from '@/auth/session';
import { env } from '@/config/env';

import { authedRequest } from './client';
import { ApiError } from './errors';
import { mockAuth } from './mocks/auth';
import type { DeviceSession, Me, MessageResponse, ReauthRequestResponse, ReauthVerifyResponse } from './types';

/**
 * Authenticated account endpoints (guide M06/M07). With
 * EXPO_PUBLIC_USE_AUTH_MOCK=true they are served by mocks/auth.ts, behind
 * the same REAUTH_REQUIRED handling as real requests.
 */

async function mockToken(): Promise<string> {
  const token = await session.getAccessToken();
  if (!token) throw ApiError.sessionExpired();
  return token;
}

function viaMock<T>(call: (token: string) => Promise<T>): Promise<T> {
  return withReauth(async () => call(await mockToken()));
}

export function getMe(): Promise<Me> {
  if (env.useAuthMock) return viaMock((t) => mockAuth.fetchMe(t));
  return authedRequest<Me>('/auth/me');
}

/** GET /auth/sessions — every device signed in to this account. */
export function listSessions(): Promise<DeviceSession[]> {
  if (env.useAuthMock) return viaMock((t) => mockAuth.listSessions(t));
  return authedRequest<DeviceSession[]>('/auth/sessions');
}

/** DELETE /auth/sessions/:id — signs out one other device. */
export function revokeSession(id: string): Promise<MessageResponse> {
  if (env.useAuthMock) return viaMock((t) => mockAuth.revokeSession(t, id));
  return authedRequest<MessageResponse>(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE', retry: true });
}

/** POST /auth/logout-all — signs out every other device. */
export function logoutAllDevices(): Promise<MessageResponse> {
  if (env.useAuthMock) return viaMock((t) => mockAuth.logoutAll(t));
  return authedRequest<MessageResponse>('/auth/logout-all', { method: 'POST' });
}

/** POST /auth/reauth/request — sends a step-up code to the account's phone or email. */
export function requestReauthCode(): Promise<ReauthRequestResponse> {
  if (env.useAuthMock) return mockToken().then((t) => mockAuth.requestReauth(t));
  return authedRequest<ReauthRequestResponse>('/auth/reauth/request', { method: 'POST' });
}

/** POST /auth/reauth/verify — on success the server allows sensitive actions for a few minutes. */
export function verifyReauthCode(code: string): Promise<ReauthVerifyResponse> {
  if (env.useAuthMock) return mockToken().then((t) => mockAuth.verifyReauth(t, code));
  return authedRequest<ReauthVerifyResponse>('/auth/reauth/verify', { method: 'POST', body: { code } });
}

/** DELETE /account — 403 REAUTH_REQUIRED (→ step-up sheet) unless confirmed recently. */
export function deleteAccount(): Promise<MessageResponse> {
  if (env.useAuthMock) return viaMock((t) => mockAuth.deleteAccount(t));
  return authedRequest<MessageResponse>('/account', { method: 'DELETE' });
}
