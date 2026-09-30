import { authedRequest } from './client';
import type { Me } from './types';

/** Authenticated account endpoints (backend/src/auth/auth.controller.ts). */

export function getMe(): Promise<Me> {
  return authedRequest<Me>('/auth/me');
}
