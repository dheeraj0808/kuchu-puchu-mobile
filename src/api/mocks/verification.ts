import { session } from '@/auth/session';
import { env } from '@/config/env';
import { MAX_FILE_BYTES, MIN_APPROVED_PHOTOS, MIN_SIDE_PX, PHOTO_SLOTS } from '@/features/verification/photoRules';

import { ApiError, ErrorCode } from '../errors';
import type { FaceResult, FaceSession, MessageResponse, OnboardingStep, Photo, PhotoStatus, PhotoUpload, VerificationState } from '../types';
import { mockAuth, registerMeExtension, type MockAccount } from './auth';

/**
 * In-app stand-in for M11 (live selfie) and M12 (photos), guide contracts:
 *   POST /verification/face/session · POST /verification/face/complete · GET /verification
 *   GET/POST /profile/photos · PUT /profile/photos/order · DELETE /profile/photos/:id
 * Settings: EXPO_PUBLIC_MOCK_SELFIE_RESULT (approved | review | rejected; a
 * review approves itself after 30 s) and EXPO_PUBLIC_MOCK_PHOTO_EXCEPTION
 * (the 4th upload stays in review or is rejected). Photos auto-approve after 3 s.
 */

const LATENCY_MS = 500;
const MAX_ATTEMPTS = 3;
export const REVIEW_AUTO_APPROVE_MS = 30_000;
export const PHOTO_APPROVE_MS = 3_000;

interface MockPhoto {
  id: string;
  uri: string;
  uploadedAt: number;
  /** Fixed outcome; null = approve after PHOTO_APPROVE_MS. */
  outcome: Exclude<PhotoStatus, 'approved'> | null;
}

export interface MockVerificationAccount extends MockAccount {
  face?: { status: 'none' | 'review' | 'approved' | 'rejected'; submittedAt: number | null; reviewedAt: number | null; attemptsLeft: number };
  photos?: MockPhoto[];
  uploads?: number;
  openSession?: string | null;
}

export interface MockVerificationOptions {
  selfieResult: () => 'approved' | 'review' | 'rejected';
  photoException: () => 'none' | 'review' | 'rejected';
}

export function createMockVerification(
  resolve: (accessToken: string) => MockVerificationAccount,
  token: () => Promise<string | null>,
  now: () => number = Date.now,
  delay = LATENCY_MS,
  options: MockVerificationOptions = { selfieResult: () => env.mockSelfieResult, photoException: () => env.mockPhotoException },
) {
  const wait = () => (delay > 0 ? new Promise<void>((r) => setTimeout(r, delay)) : Promise.resolve());
  const fail = (status: number, code: string, details?: Record<string, unknown>): never => {
    throw ApiError.fromResponse(status, { success: false, code, message: code, details, requestId: 'mock' }, null);
  };
  const account = async (): Promise<MockVerificationAccount> => {
    await wait();
    const t = await token();
    if (!t) throw ApiError.sessionExpired();
    return resolve(t);
  };
  const face = (acc: MockVerificationAccount) => {
    acc.face ??= { status: 'none', submittedAt: null, reviewedAt: null, attemptsLeft: MAX_ATTEMPTS };
    // A human reviewer "approves" a pending selfie after 30 s.
    if (acc.face.status === 'review' && acc.face.submittedAt !== null && now() - acc.face.submittedAt >= REVIEW_AUTO_APPROVE_MS) {
      acc.face.status = 'approved';
      acc.face.reviewedAt = now();
    }
    return acc.face;
  };
  const statusOf = (p: MockPhoto): PhotoStatus => p.outcome ?? (now() - p.uploadedAt >= PHOTO_APPROVE_MS ? 'approved' : 'review');
  const view = (p: MockPhoto): Photo => ({
    id: p.id,
    status: statusOf(p),
    rejectionReason: p.outcome === 'rejected' ? 'Your face needs to be clearly visible.' : null,
    urls: { thumb: p.uri, medium: p.uri, large: p.uri },
  });
  const photosOf = (acc: MockVerificationAccount) => (acc.photos ??= []);

  /** Server-side nextStep for the selfie and photos steps. */
  const progress = (acc: MockVerificationAccount): OnboardingStep => {
    if (acc.nextStep !== 'selfie' && acc.nextStep !== 'photos') return acc.nextStep;
    if (face(acc).status !== 'approved') return 'selfie';
    const approved = photosOf(acc).filter((p) => statusOf(p) === 'approved').length;
    return approved >= MIN_APPROVED_PHOTOS ? 'profile' : 'photos';
  };

  return {
    /** Called by mock /auth/me so the gate sees the current step. */
    sync(acc: MockVerificationAccount) {
      acc.nextStep = progress(acc);
      return { faceStatus: face(acc).status };
    },

    async createFaceSession(consentVersion: string): Promise<FaceSession> {
      const acc = await account();
      if (!consentVersion) fail(400, ErrorCode.ValidationError);
      const f = face(acc);
      if (f.status === 'approved') fail(409, ErrorCode.InvalidRequest);
      if (f.attemptsLeft <= 0) fail(429, ErrorCode.VerificationAttemptsExceeded, { retryAfterSeconds: 86_400 });
      acc.openSession = `face-${now()}`;
      return { sessionId: acc.openSession, provider: 'mock' };
    },

    async completeFaceSession(sessionId: string): Promise<FaceResult> {
      const acc = await account();
      if (!acc.openSession || acc.openSession !== sessionId) fail(400, ErrorCode.InvalidRequest);
      acc.openSession = null;
      const f = face(acc);
      const result = options.selfieResult();
      f.submittedAt = now();
      if (result === 'rejected') {
        f.attemptsLeft -= 1;
        f.status = 'rejected';
        return { status: 'rejected', reason: 'We could not see your whole face. Try again in good light.', attemptsLeft: f.attemptsLeft };
      }
      f.status = result;
      if (result === 'approved') f.reviewedAt = now();
      return { status: result };
    },

    async getVerification(): Promise<VerificationState> {
      const acc = await account();
      const f = face(acc);
      const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString());
      return { face: { status: f.status, submittedAt: iso(f.submittedAt), reviewedAt: iso(f.reviewedAt) } };
    },

    async listPhotos(): Promise<Photo[]> {
      const acc = await account();
      return photosOf(acc).map(view);
    },

    async uploadPhoto(file: PhotoUpload, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<Photo> {
      const acc = await account();
      for (const f of [0.25, 0.5, 0.75, 1]) {
        if (signal?.aborted) throw ApiError.aborted();
        onProgress?.(f);
        if (delay > 0) await new Promise((r) => setTimeout(r, delay / 2));
      }
      if (signal?.aborted) throw ApiError.aborted();
      const list = photosOf(acc);
      if (list.length >= PHOTO_SLOTS) fail(409, ErrorCode.PhotoLimitReached);
      const tooSmall = file.width < MIN_SIDE_PX || file.height < MIN_SIDE_PX;
      if (file.type !== 'image/jpeg' || tooSmall || (file.size ?? 0) > MAX_FILE_BYTES) fail(400, ErrorCode.PhotoInvalidFile);
      acc.uploads = (acc.uploads ?? 0) + 1;
      const exception = options.photoException();
      const photo: MockPhoto = {
        id: `photo-${now()}-${acc.uploads}`,
        uri: file.uri,
        uploadedAt: now(),
        outcome: acc.uploads === 4 && exception !== 'none' ? exception : null,
      };
      list.push(photo);
      return view(photo);
    },

    async reorderPhotos(ids: string[]): Promise<Photo[]> {
      const acc = await account();
      const list = photosOf(acc);
      if (ids.length !== list.length || !ids.every((id) => list.some((p) => p.id === id))) fail(400, ErrorCode.ValidationError);
      const reordered = ids.map((id) => list.find((p) => p.id === id)!);
      // The main photo must clearly show the verified face: a rejected one can't lead.
      if (statusOf(reordered[0]!) === 'rejected') fail(422, ErrorCode.PhotoFaceMismatch);
      acc.photos = reordered;
      return reordered.map(view);
    },

    async deletePhoto(id: string): Promise<MessageResponse> {
      const acc = await account();
      const list = photosOf(acc);
      if (!list.some((p) => p.id === id)) fail(404, ErrorCode.NotFound);
      acc.photos = list.filter((p) => p.id !== id);
      return { message: 'Photo deleted' };
    },
  };
}

export const mockVerification = createMockVerification(
  (t) => mockAuth.accountFor(t) as MockVerificationAccount,
  () => session.getAccessToken(),
);

registerMeExtension((acc) => mockVerification.sync(acc as MockVerificationAccount));
