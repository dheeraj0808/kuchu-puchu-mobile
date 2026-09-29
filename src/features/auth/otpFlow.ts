import { useSyncExternalStore } from 'react';

import type { IdentifierType, RequestOtpResponse } from '@/api/types';

/**
 * In-memory state for an in-progress OTP sign-in. Kept out of route params so
 * the email/phone number never appears in a URL, and never persisted.
 */
export interface OtpFlow {
  identifierType: IdentifierType;
  /** Normalized exactly as the backend normalizes it. */
  identifier: string;
  /** Epoch ms when the current code expires; null when unknown (cooldown hit). */
  expiresAt: number | null;
  /** Epoch ms when a new code may be requested. */
  resendAvailableAt: number;
  /** Incremented on every successful (re)send, so screens can reset. */
  sendCount: number;
}

let current: OtpFlow | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): OtpFlow | null {
  return current;
}

export function useOtpFlow(): OtpFlow | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Records a successful code request. */
export function startOtpFlow(identifierType: IdentifierType, identifier: string, response: RequestOtpResponse): void {
  const now = Date.now();
  current = {
    identifierType,
    identifier,
    expiresAt: now + response.expiresInSeconds * 1000,
    resendAvailableAt: now + response.resendAfterSeconds * 1000,
    sendCount: (current?.identifier === identifier ? current.sendCount : 0) + 1,
  };
  emit();
}

/**
 * The backend refused to send a new code because one was sent recently.
 * That earlier code is still usable, so continue to the code screen.
 */
export function resumeOtpFlowAfterCooldown(identifierType: IdentifierType, identifier: string, retryAfterSeconds: number): void {
  const now = Date.now();
  const sameIdentifier = current?.identifier === identifier && current.identifierType === identifierType;
  current = {
    identifierType,
    identifier,
    expiresAt: sameIdentifier ? current!.expiresAt : null,
    resendAvailableAt: now + retryAfterSeconds * 1000,
    sendCount: sameIdentifier ? current!.sendCount : 1,
  };
  emit();
}

export function setResendCooldown(retryAfterSeconds: number): void {
  if (!current) return;
  current = { ...current, resendAvailableAt: Date.now() + retryAfterSeconds * 1000 };
  emit();
}

export function resetOtpFlow(): void {
  if (current === null) return;
  current = null;
  emit();
}
