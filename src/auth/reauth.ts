import { ApiError, ErrorCode, isApiError } from '@/api/errors';
import { createResettableStore } from '@/lib/stores';

/**
 * Global REAUTH_REQUIRED handling (guide §6, §11): when a request is refused
 * with 403 REAUTH_REQUIRED, the OTP step-up sheet opens, and once the user
 * confirms the request is repeated. Concurrent refusals share one prompt.
 */

export const REAUTH_CANCELLED = 'REAUTH_CANCELLED';

interface ReauthState {
  /** True while the ReauthSheet should be on screen. */
  visible: boolean;
  /** Increments per prompt so the sheet starts clean each time. */
  round: number;
}

export const useReauthStore = createResettableStore<ReauthState>(() => ({ visible: false, round: 0 }));

let pending: { promise: Promise<void>; resolve: () => void; reject: (err: ApiError) => void } | null = null;

/** Opens the sheet (or joins the one already open) and resolves once the user has confirmed. */
export function requestReauth(): Promise<void> {
  if (!pending) {
    let resolve!: () => void;
    let reject!: (err: ApiError) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    pending = { promise, resolve, reject };
    useReauthStore.setState((s) => ({ visible: true, round: s.round + 1 }));
  }
  return pending.promise;
}

/** Called by the sheet after POST /auth/reauth/verify succeeds. */
export function completeReauth(): void {
  const current = pending;
  pending = null;
  useReauthStore.setState({ visible: false });
  current?.resolve();
}

/** Called when the user closes the sheet. The original action fails with REAUTH_CANCELLED. */
export function cancelReauth(): void {
  const current = pending;
  pending = null;
  useReauthStore.setState({ visible: false });
  current?.reject(new ApiError({ kind: 'aborted', code: REAUTH_CANCELLED }));
}

export function isReauthCancelled(err: unknown): boolean {
  return isApiError(err) && err.code === REAUTH_CANCELLED;
}

/**
 * Runs `action`; on REAUTH_REQUIRED asks for the step-up and runs it exactly
 * once more. A second REAUTH_REQUIRED is returned to the caller (no loop).
 */
export async function withReauth<T>(action: () => Promise<T>, ask: () => Promise<void> = requestReauth): Promise<T> {
  try {
    return await action();
  } catch (err) {
    if (!isApiError(err) || err.code !== ErrorCode.ReauthRequired) throw err;
  }
  await ask();
  return action();
}
