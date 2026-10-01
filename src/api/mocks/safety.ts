import { session } from '@/auth/session';
import { env } from '@/config/env';

import { ApiError, ErrorCode } from '../errors';
import type { BlockedUser, MessageResponse, ReportBody } from '../types';
import { mockAuth, type MockAccount } from './auth';

/**
 * In-app stand-in for M13 (reports), M14 (blocks) and M15 (appeals):
 *   POST /reports · POST /blocks · GET /blocks · DELETE /blocks/:id · POST /account/appeals
 * Reports are stored and never answered with an outcome.
 */

const LATENCY_MS = 400;

/** People the mock knows about. Unknown ids answer 404 USER_NOT_FOUND (blocked, hidden and deleted look the same). */
export const MOCK_PEOPLE: Record<string, string> = {
  'user-rohan': 'Rohan',
  'user-vikram': 'Vikram',
  'user-aman': 'Aman',
  'user-sid': 'Sid',
};

export const REPORT_DETAILS_MAX = 1000;
export const APPEAL_MIN = 10;
export const APPEAL_MAX = 1000;

interface MockSafetyAccount extends MockAccount {
  blocks?: BlockedUser[];
  reports?: ReportBody[];
  appeals?: string[];
}

const seededBlocks = (): BlockedUser[] => [
  { id: 'block-vikram', userId: 'user-vikram', name: 'Vikram', blockedAt: '2026-09-12T10:00:00.000Z' },
  { id: 'block-aman', userId: 'user-aman', name: 'Aman', blockedAt: '2026-09-02T10:00:00.000Z' },
  { id: 'block-sid', userId: 'user-sid', name: 'Sid', blockedAt: '2026-08-18T10:00:00.000Z' },
];

export function createMockSafety(
  resolve: (accessToken: string) => MockSafetyAccount,
  resolveUnrestricted: (accessToken: string) => MockSafetyAccount,
  token: () => Promise<string | null>,
  options = { now: Date.now, delay: LATENCY_MS, appealAllowed: () => env.mockAppealAllowed },
) {
  const wait = () => (options.delay > 0 ? new Promise<void>((r) => setTimeout(r, options.delay)) : Promise.resolve());
  const fail = (status: number, code: string, details?: Record<string, unknown>): never => {
    throw ApiError.fromResponse(status, { success: false, code, message: code, details, requestId: 'mock' }, null);
  };
  const tokenOrFail = async () => {
    await wait();
    const t = await token();
    if (!t) throw ApiError.sessionExpired();
    return t;
  };
  const account = async () => resolve(await tokenOrFail());
  const blocksOf = (acc: MockSafetyAccount) => (acc.blocks ??= seededBlocks());
  const isBlocked = (acc: MockSafetyAccount, userId: string) => blocksOf(acc).some((b) => b.userId === userId);

  return {
    async submitReport(body: ReportBody): Promise<MessageResponse> {
      const acc = await account();
      if (!MOCK_PEOPLE[body.targetUserId]) fail(404, ErrorCode.ReportTargetInvalid);
      if ((body.details?.length ?? 0) > REPORT_DETAILS_MAX) fail(400, ErrorCode.ValidationError, { errors: ['details must be at most 1000 characters'] });
      (acc.reports ??= []).push({ ...body });
      // Same answer for every report: the outcome is never shared.
      return { message: 'Report received' };
    },

    async blockUser(targetUserId: string): Promise<BlockedUser> {
      const acc = await account();
      const name = MOCK_PEOPLE[targetUserId] ?? fail(404, ErrorCode.UserNotFound);
      const existing = blocksOf(acc).find((b) => b.userId === targetUserId);
      if (existing) return existing;
      const block = { id: `block-${targetUserId}-${options.now()}`, userId: targetUserId, name, blockedAt: new Date(options.now()).toISOString() };
      blocksOf(acc).unshift(block);
      return block;
    },

    async listBlocks(): Promise<BlockedUser[]> {
      const acc = await account();
      return [...blocksOf(acc)];
    },

    async unblock(blockId: string): Promise<MessageResponse> {
      const acc = await account();
      const list = blocksOf(acc);
      if (!list.some((b) => b.id === blockId)) fail(404, ErrorCode.NotFound);
      acc.blocks = list.filter((b) => b.id !== blockId);
      return { message: 'Unblocked' };
    },

    async submitAppeal(message: string): Promise<MessageResponse> {
      const acc = resolveUnrestricted(await tokenOrFail());
      if (!options.appealAllowed()) fail(403, ErrorCode.Forbidden);
      const text = message.trim();
      if (text.length < APPEAL_MIN || text.length > APPEAL_MAX) fail(400, ErrorCode.ValidationError, { errors: ['message must be 10–1000 characters'] });
      (acc.appeals ??= []).push(text);
      return { message: 'Appeal received' };
    },

    /** Test helpers. */
    isBlocked,
  };
}

export const mockSafety = createMockSafety(
  (t) => mockAuth.accountFor(t) as MockSafetyAccount,
  (t) => mockAuth.accountForUnrestricted(t) as MockSafetyAccount,
  () => session.getAccessToken(),
);
