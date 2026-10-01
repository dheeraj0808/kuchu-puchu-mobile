import { env } from '@/config/env';

import { authedRequest } from '../client';
import { mockVerification } from '../mocks/verification';
import type { FaceResult, FaceSession, VerificationState } from '../types';

/** Live selfie (guide M11), relative to /api/v1. */
export const VERIFICATION_ENDPOINTS = {
  status: '/verification',
  faceSession: '/verification/face/session',
  faceComplete: '/verification/face/complete',
} as const;

/** Bump when the consent text on screen 06 changes; sent with every session. */
export const SELFIE_CONSENT_VERSION = '2026-10-01';

const mock = env.useAuthMock ? mockVerification : null;

/** 429 VERIFICATION_ATTEMPTS_EXCEEDED when the daily attempts are used up. */
export function createFaceSession(consentVersion: string = SELFIE_CONSENT_VERSION): Promise<FaceSession> {
  if (mock) return mock.createFaceSession(consentVersion);
  return authedRequest<FaceSession>(VERIFICATION_ENDPOINTS.faceSession, { method: 'POST', body: { consentVersion } });
}

/** The server's decision — the app never shows "verified" from the provider result alone. */
export function completeFaceSession(sessionId: string): Promise<FaceResult> {
  if (mock) return mock.completeFaceSession(sessionId);
  return authedRequest<FaceResult>(VERIFICATION_ENDPOINTS.faceComplete, { method: 'POST', body: { sessionId } });
}

export function getVerification(): Promise<VerificationState> {
  if (mock) return mock.getVerification();
  return authedRequest<VerificationState>(VERIFICATION_ENDPOINTS.status);
}
