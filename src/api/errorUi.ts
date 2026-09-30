import { ApiError, ErrorCode, isApiError } from './errors';

/**
 * Error code → what the app does (guide §11). Screens call `resolveErrorUi`
 * and switch on `action`; nothing inspects `err.message` or HTTP text.
 */
export type ErrorUiAction =
  /** Show `fieldErrors` under inputs plus the generic message. */
  | 'fieldErrors'
  /** The session is gone; the gate routes to sign-in by itself. */
  | 'signIn'
  /** Screen 46 (Account suspended). */
  | 'restricted'
  /** OTP step-up sheet, then repeat the action. */
  | 'reauth'
  /** Route to `details.nextStep`. */
  | 'onboarding'
  /** Paywall highlighting `details.entitlement`. */
  | 'paywall'
  /** "No longer available"; remove the item from lists. */
  | 'notFound'
  /** Countdown from `retryAfterSeconds`. */
  | 'countdown'
  /** Screen 22 (Out of likes). */
  | 'outOfLikes'
  /** Screen 33 (Number blocked in chat) with the contact-exchange offer. */
  | 'contactLocked'
  /** Offer restore purchases and support. */
  | 'purchaseSupport'
  /** Support link. */
  | 'support'
  /** Offline banner / screen 50. */
  | 'offline'
  /** Generic error with retry and the reference code. */
  | 'retry'
  /** Show the message; nothing else to do. */
  | 'message';

export interface ErrorUi {
  action: ErrorUiAction;
  code: string;
  message: string;
  /** Shown as "Error code: …" so support can find the request. */
  reference: string | null;
  retryAfterSeconds: number | null;
  fieldErrors: Record<string, string>;
  /** ONBOARDING_INCOMPLETE → details.nextStep. */
  nextStep: string | null;
  /** ENTITLEMENT_REQUIRED → details.entitlement. */
  entitlement: string | null;
}

const ACTION_BY_CODE: Record<string, ErrorUiAction> = {
  [ErrorCode.ValidationError]: 'fieldErrors',
  [ErrorCode.Unauthorized]: 'signIn',
  [ErrorCode.InvalidRefreshToken]: 'signIn',
  [ErrorCode.SessionExpired]: 'signIn',
  [ErrorCode.OtpInvalid]: 'message',
  [ErrorCode.AccountRestricted]: 'restricted',
  [ErrorCode.ReauthRequired]: 'reauth',
  [ErrorCode.OnboardingIncomplete]: 'onboarding',
  [ErrorCode.EntitlementRequired]: 'paywall',
  [ErrorCode.NotFound]: 'notFound',
  [ErrorCode.UserNotFound]: 'notFound',
  [ErrorCode.ProfileNotFound]: 'notFound',
  [ErrorCode.MatchNotFound]: 'notFound',
  [ErrorCode.PhotoLimitReached]: 'message',
  [ErrorCode.DiscoveryNotReady]: 'onboarding',
  [ErrorCode.InteractionAlreadyLiked]: 'message',
  [ErrorCode.ContactDetailsNotAllowed]: 'fieldErrors',
  [ErrorCode.ContactSharingLocked]: 'contactLocked',
  [ErrorCode.PhotoFaceMismatch]: 'message',
  [ErrorCode.PhotoInvalidFile]: 'message',
  [ErrorCode.OtpCooldown]: 'countdown',
  [ErrorCode.TooManyRequests]: 'countdown',
  [ErrorCode.LikeLimitReached]: 'outOfLikes',
  [ErrorCode.MessageAwaitingReply]: 'message',
  [ErrorCode.VerificationAttemptsExceeded]: 'support',
  [ErrorCode.PurchaseInvalid]: 'purchaseSupport',
  [ErrorCode.PurchaseAlreadyLinked]: 'purchaseSupport',
  [ErrorCode.Network]: 'offline',
  [ErrorCode.Timeout]: 'offline',
  [ErrorCode.Aborted]: 'message',
};

export function resolveErrorUi(err: unknown): ErrorUi {
  const error = isApiError(err) ? err : new ApiError({ kind: 'http', code: ErrorCode.InternalError, status: 500 });
  const action = ACTION_BY_CODE[error.code] ?? fallbackAction(error);

  return {
    action,
    code: error.code,
    message: error.message,
    reference: action === 'retry' || action === 'offline' ? error.reference : (error.requestId ?? null),
    retryAfterSeconds: error.retryAfterSeconds,
    fieldErrors: error.fieldErrors,
    nextStep: stringDetail(error, 'nextStep'),
    entitlement: stringDetail(error, 'entitlement'),
  };
}

/** Codes this build doesn't know yet: decide by HTTP class. */
function fallbackAction(error: ApiError): ErrorUiAction {
  if (error.isNetworkError) return 'offline';
  if (error.status === 429) return 'countdown';
  if (error.status === 404) return 'notFound';
  if (error.status === null || error.status >= 500 || error.kind === 'invalid_response') return 'retry';
  return 'message';
}

function stringDetail(error: ApiError, key: string): string | null {
  const value = error.details?.[key];
  return typeof value === 'string' ? value : null;
}
