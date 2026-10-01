import { env } from '@/config/env';

import { authedRequest } from '../client';
import { mockSafety } from '../mocks/safety';
import type { BlockedUser, MessageResponse, ReportBody } from '../types';

/** Safety endpoints (guide M13–M15), relative to /api/v1. */
export const SAFETY_ENDPOINTS = {
  reports: '/reports',
  blocks: '/blocks',
  block: (id: string) => `/blocks/${encodeURIComponent(id)}`,
  appeals: '/account/appeals',
} as const;

const mock = env.useAuthMock ? mockSafety : null;

/** 404 USER_NOT_FOUND / REPORT_TARGET_INVALID → "no longer available". Never returns an outcome. */
export function submitReport(body: ReportBody): Promise<MessageResponse> {
  if (mock) return mock.submitReport(body);
  return authedRequest<MessageResponse>(SAFETY_ENDPOINTS.reports, { method: 'POST', body });
}

export function blockUser(targetUserId: string): Promise<BlockedUser> {
  if (mock) return mock.blockUser(targetUserId);
  return authedRequest<BlockedUser>(SAFETY_ENDPOINTS.blocks, { method: 'POST', body: { targetUserId }, retry: true });
}

export function listBlocks(): Promise<BlockedUser[]> {
  if (mock) return mock.listBlocks();
  return authedRequest<BlockedUser[]>(SAFETY_ENDPOINTS.blocks);
}

/** Unblocking never restores the old match (guide §9.5). */
export function unblock(blockId: string): Promise<MessageResponse> {
  if (mock) return mock.unblock(blockId);
  return authedRequest<MessageResponse>(SAFETY_ENDPOINTS.block(blockId), { method: 'DELETE', retry: true });
}

/** Allowed while restricted (when appealAllowed). */
export function submitAppeal(message: string): Promise<MessageResponse> {
  if (mock) return mock.submitAppeal(message);
  return authedRequest<MessageResponse>(SAFETY_ENDPOINTS.appeals, { method: 'POST', body: { message } });
}
