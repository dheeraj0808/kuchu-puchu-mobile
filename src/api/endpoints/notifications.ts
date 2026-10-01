import { env } from '@/config/env';

import { authedRequest } from '../client';
import { mockPreferences } from '../mocks/preferences';
import type { MessageResponse, PushDeviceBody } from '../types';

/** Notification endpoints (guide M20), relative to /api/v1. */
export const NOTIFICATION_ENDPOINTS = { devices: '/notifications/devices' } as const;

const mock = env.useAuthMock ? mockPreferences : null;

/** Screen 16, and on every launch / token change (guide §10.8). `token: null` = "Not now". */
export function putPushDevice(body: PushDeviceBody): Promise<MessageResponse> {
  if (mock) return mock.putPushDevice(body);
  return authedRequest<MessageResponse>(NOTIFICATION_ENDPOINTS.devices, { method: 'PUT', body, retry: true });
}
