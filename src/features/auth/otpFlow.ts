import type { IdentifierType, RequestOtpResponse } from '@/api/types';
import { createResettableStore } from '@/lib/stores';

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

const useOtpFlowStore = createResettableStore<{ flow: OtpFlow | null }>(() => ({ flow: null }));

const current = (): OtpFlow | null => useOtpFlowStore.getState().flow;
const set = (flow: OtpFlow | null): void => useOtpFlowStore.setState({ flow });

/** Current flow outside React (tests, event handlers). */
export function getOtpFlow(): OtpFlow | null {
  return current();
}

export function useOtpFlow(): OtpFlow | null {
  return useOtpFlowStore((state) => state.flow);
}

/** Records a successful code request. */
export function startOtpFlow(identifierType: IdentifierType, identifier: string, response: RequestOtpResponse): void {
  const now = Date.now();
  const previous = current();
  set({
    identifierType,
    identifier,
    expiresAt: now + response.expiresInSeconds * 1000,
    resendAvailableAt: now + response.resendAfterSeconds * 1000,
    sendCount: (previous?.identifier === identifier ? previous.sendCount : 0) + 1,
  });
}

/**
 * The backend refused to send a new code because one was sent recently.
 * That earlier code is still usable, so continue to the code screen.
 */
export function resumeOtpFlowAfterCooldown(identifierType: IdentifierType, identifier: string, retryAfterSeconds: number): void {
  const previous = current();
  const same = previous !== null && previous.identifier === identifier && previous.identifierType === identifierType;
  set({
    identifierType,
    identifier,
    expiresAt: same ? previous.expiresAt : null,
    resendAvailableAt: Date.now() + retryAfterSeconds * 1000,
    sendCount: same ? previous.sendCount : 1,
  });
}

export function setResendCooldown(retryAfterSeconds: number): void {
  const previous = current();
  if (!previous) return;
  set({ ...previous, resendAvailableAt: Date.now() + retryAfterSeconds * 1000 });
}

export function resetOtpFlow(): void {
  if (current() !== null) set(null);
}
