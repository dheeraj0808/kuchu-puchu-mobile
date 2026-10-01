import * as authApi from '@/api/auth';
import { ErrorCode, errorMessage, isApiError } from '@/api/errors';
import type { IdentifierType, RequestOtpBody, RequestOtpResponse } from '@/api/types';

import { resumeOtpFlowAfterCooldown, startOtpFlow } from './otpFlow';

/** Used when a 429 arrives without retryAfterSeconds. */
export const DEFAULT_WAIT_SECONDS = 60;

export type RequestCodeOutcome =
  /** A code is on its way (or one sent moments ago is still valid): go to screen 03. */
  | { kind: 'sent' }
  /** Rate limited: keep the user here with a countdown on the button. */
  | { kind: 'wait'; until: number }
  /** The server rejected the number/email; the screen shows its own localized message. */
  | { kind: 'invalid' }
  | { kind: 'error'; message: string };

type RequestFn = (body: RequestOtpBody) => Promise<RequestOtpResponse>;

/**
 * Screen 02 "Send code". The server always answers "Code sent", so the app
 * never learns whether an account exists (guide §9.1).
 *
 * - OTP_COOLDOWN (429): a code was sent < 60 s ago and still works, so
 *   continue to screen 03 with the resend countdown from retryAfterSeconds.
 * - Any other 429: stay and count down from retryAfterSeconds.
 */
export async function requestCode(
  identifierType: IdentifierType,
  identifier: string,
  request: RequestFn = authApi.requestOtp,
  now: () => number = Date.now,
): Promise<RequestCodeOutcome> {
  try {
    const response = await request({ identifierType, identifier });
    startOtpFlow(identifierType, identifier, response);
    return { kind: 'sent' };
  } catch (err) {
    if (!isApiError(err)) return { kind: 'error', message: errorMessage(err) };
    const waitSeconds = err.retryAfterSeconds ?? DEFAULT_WAIT_SECONDS;
    if (err.code === ErrorCode.OtpCooldown) {
      resumeOtpFlowAfterCooldown(identifierType, identifier, waitSeconds);
      return { kind: 'sent' };
    }
    if (err.status === 429) return { kind: 'wait', until: now() + waitSeconds * 1000 };
    if (err.fieldErrors.identifier) return { kind: 'invalid' };
    return { kind: 'error', message: err.message };
  }
}
