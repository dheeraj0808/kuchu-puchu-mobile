import { env } from '@/config/env';

import { httpRequest } from './http';
import { mockAuth } from './mocks/auth';
import type {
  AuthTokens,
  Me,
  MessageResponse,
  RequestOtpBody,
  RequestOtpResponse,
  VerifyOtpBody,
} from './types';

/**
 * Auth endpoints (backend/src/auth/auth.controller.ts) used by the session
 * itself. Payloads are rebuilt field by field so nothing outside the DTO is
 * ever sent (the backend rejects unknown properties).
 *
 * With EXPO_PUBLIC_USE_AUTH_MOCK=true every call is served by mocks/auth.ts.
 */

const mock = env.useAuthMock ? mockAuth : null;

export function requestOtp(input: RequestOtpBody): Promise<RequestOtpResponse> {
  if (mock) return mock.requestOtp(input);
  const body: RequestOtpBody = { identifierType: input.identifierType, identifier: input.identifier };
  return httpRequest<RequestOtpResponse>('/auth/request-otp', { method: 'POST', body });
}

export function verifyOtp(input: VerifyOtpBody): Promise<AuthTokens> {
  if (mock) return mock.verifyOtp(input);
  const body: VerifyOtpBody = {
    identifierType: input.identifierType,
    identifier: input.identifier,
    otp: input.otp,
  };
  if (input.deviceId) body.deviceId = input.deviceId;
  if (input.deviceName) body.deviceName = input.deviceName;
  return httpRequest<AuthTokens>('/auth/verify-otp', { method: 'POST', body });
}

/** Never retried: the backend rotates refresh tokens and treats a replay as theft. */
export function refreshSession(refreshToken: string): Promise<AuthTokens> {
  if (mock) return mock.refreshSession(refreshToken);
  return httpRequest<AuthTokens>('/auth/refresh', { method: 'POST', body: { refreshToken } });
}

export function logout(refreshToken: string): Promise<MessageResponse> {
  if (mock) return mock.logout(refreshToken);
  return httpRequest<MessageResponse>('/auth/logout', {
    method: 'POST',
    body: { refreshToken },
    timeoutMs: env.logoutTimeoutMs,
  });
}

/** GET /auth/me with an access token the session just obtained. */
export function fetchMe(accessToken: string): Promise<Me> {
  if (mock) return mock.fetchMe(accessToken);
  return httpRequest<Me>('/auth/me', { accessToken });
}
