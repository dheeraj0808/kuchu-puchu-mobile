import { authedRequest } from './client';
import type { MessageResponse, User } from './types';

/** Authenticated account endpoints (backend/src/auth/auth.controller.ts). */

export function getCurrentUser(): Promise<User> {
  return authedRequest<User>('/auth/me');
}

export function logoutAllDevices(): Promise<MessageResponse> {
  return authedRequest<MessageResponse>('/auth/logout-all', { method: 'POST' });
}
