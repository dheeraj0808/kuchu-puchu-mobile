import { env } from '@/config/env';

import { authedRequest } from '../client';
import { mockDiscovery } from '../mocks/discovery';
import type { DiscoveryCard, LikeResult, MessageResponse, ProfileDetail } from '../types';

/** Discovery, likes, passes and profiles (guide M16–M18), relative to /api/v1. */
export const DISCOVERY_ENDPOINTS = {
  discovery: '/discovery',
  likes: '/likes',
  passes: '/passes',
  profile: (userId: string) => `/profiles/${encodeURIComponent(userId)}`,
} as const;

const mock = env.useAuthMock ? mockDiscovery : null;

/** 409 DISCOVERY_NOT_READY {missing}. `exclude` = ids already in the local queue. */
export function getDiscovery(exclude: readonly string[]): Promise<DiscoveryCard[]> {
  if (mock) return mock.getDiscovery(exclude);
  const query = exclude.length ? `?exclude=${exclude.map(encodeURIComponent).join(',')}` : '';
  return authedRequest<DiscoveryCard[]>(`${DISCOVERY_ENDPOINTS.discovery}${query}`);
}

/** 404 USER_NOT_FOUND · 409 INTERACTION_ALREADY_LIKED · 429 LIKE_LIMIT_REACHED {retryAfterSeconds}. */
export function likeUser(targetUserId: string): Promise<LikeResult> {
  if (mock) return mock.like(targetUserId);
  return authedRequest<LikeResult>(DISCOVERY_ENDPOINTS.likes, { method: 'POST', body: { targetUserId } });
}

export function passUser(targetUserId: string): Promise<MessageResponse> {
  if (mock) return mock.pass(targetUserId);
  return authedRequest<MessageResponse>(DISCOVERY_ENDPOINTS.passes, { method: 'POST', body: { targetUserId }, retry: true });
}

/** 404 → "This profile is no longer available" (blocked, hidden and deleted look the same). */
export function getProfileDetail(userId: string): Promise<ProfileDetail> {
  if (mock) return mock.getProfile(userId);
  return authedRequest<ProfileDetail>(DISCOVERY_ENDPOINTS.profile(userId));
}
