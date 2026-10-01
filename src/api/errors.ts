import { t, tOptional } from '@/i18n';

/**
 * Normalized API errors. The app reacts to `code`, never to the server's
 * message (guide §6, §11): `ApiError.message` always comes from the locale
 * file for that code, so it is safe to show and can be translated.
 */

/** Mirrors backend/src/common/exceptions/error-codes.ts, plus client-side codes. */
export const ErrorCode = {
  // 400 / 413
  ValidationError: 'VALIDATION_ERROR',
  PhotoInvalidFile: 'PHOTO_INVALID_FILE',
  InvalidRequest: 'INVALID_REQUEST',
  PayloadTooLarge: 'PAYLOAD_TOO_LARGE',
  InvalidInterests: 'INVALID_INTERESTS',
  // 401
  Unauthorized: 'UNAUTHORIZED',
  OtpInvalid: 'OTP_INVALID',
  InvalidRefreshToken: 'INVALID_REFRESH_TOKEN',
  // 403
  Forbidden: 'FORBIDDEN',
  AccountRestricted: 'ACCOUNT_RESTRICTED',
  ReauthRequired: 'REAUTH_REQUIRED',
  OnboardingIncomplete: 'ONBOARDING_INCOMPLETE',
  EntitlementRequired: 'ENTITLEMENT_REQUIRED',
  // 404
  NotFound: 'NOT_FOUND',
  UserNotFound: 'USER_NOT_FOUND',
  ProfileNotFound: 'PROFILE_NOT_FOUND',
  MatchNotFound: 'MATCH_NOT_FOUND',
  ReportTargetInvalid: 'REPORT_TARGET_INVALID',
  // 409
  ProfileAlreadyExists: 'PROFILE_ALREADY_EXISTS',
  PhotoLimitReached: 'PHOTO_LIMIT_REACHED',
  DiscoveryNotReady: 'DISCOVERY_NOT_READY',
  InteractionAlreadyLiked: 'INTERACTION_ALREADY_LIKED',
  // 422
  ProfileDobLocked: 'PROFILE_DOB_LOCKED',
  Underage: 'UNDERAGE',
  ContactDetailsNotAllowed: 'CONTACT_DETAILS_NOT_ALLOWED',
  ContactSharingLocked: 'CONTACT_SHARING_LOCKED',
  PhotoFaceMismatch: 'PHOTO_FACE_MISMATCH',
  PurchaseInvalid: 'PURCHASE_INVALID',
  PurchaseAlreadyLinked: 'PURCHASE_ALREADY_LINKED',
  // 429
  OtpCooldown: 'OTP_COOLDOWN',
  TooManyRequests: 'TOO_MANY_REQUESTS',
  LikeLimitReached: 'LIKE_LIMIT_REACHED',
  MessageAwaitingReply: 'MESSAGE_AWAITING_REPLY',
  VerificationAttemptsExceeded: 'VERIFICATION_ATTEMPTS_EXCEEDED',
  // 5xx
  InternalError: 'INTERNAL_ERROR',
  OtpDeliveryFailed: 'OTP_DELIVERY_FAILED',
  ProviderUnavailable: 'PROVIDER_UNAVAILABLE',
  // Client-side only
  Conflict: 'CONFLICT',
  Network: 'NETWORK_ERROR',
  Timeout: 'TIMEOUT',
  Aborted: 'ABORTED',
  InvalidResponse: 'INVALID_RESPONSE',
  SessionExpired: 'SESSION_EXPIRED',
} as const;

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'aborted' | 'invalid_response' | 'session';

/** Used for framework errors that arrive without a code. */
const STATUS_CODES: Record<number, string> = {
  400: ErrorCode.InvalidRequest,
  401: ErrorCode.Unauthorized,
  403: ErrorCode.Forbidden,
  404: ErrorCode.NotFound,
  409: ErrorCode.Conflict,
  413: ErrorCode.PayloadTooLarge,
  422: ErrorCode.ValidationError,
  429: ErrorCode.TooManyRequests,
};

interface ApiErrorInit {
  kind: ApiErrorKind;
  code: string;
  status?: number | null;
  details?: Record<string, unknown>;
  fieldErrors?: Record<string, string>;
  retryAfterSeconds?: number | null;
  requestId?: string;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly code: string;
  readonly status: number | null;
  readonly details: Record<string, unknown> | undefined;
  readonly fieldErrors: Record<string, string>;
  readonly retryAfterSeconds: number | null;
  readonly requestId: string | undefined;
  /**
   * What support can search for (guide §6 "Error code: …"): the server's
   * requestId, or a short client reference when the server was never reached.
   */
  readonly reference: string;

  constructor(init: ApiErrorInit) {
    super(messageForCode(init.code, init.status ?? null));
    this.name = 'ApiError';
    this.kind = init.kind;
    this.code = init.code;
    this.status = init.status ?? null;
    this.details = init.details;
    this.fieldErrors = init.fieldErrors ?? {};
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
    this.requestId = init.requestId;
    this.reference = init.requestId ?? clientReference(init.kind);
  }

  get isNetworkError(): boolean {
    return this.kind === 'network' || this.kind === 'timeout';
  }

  get hasFieldErrors(): boolean {
    return Object.keys(this.fieldErrors).length > 0;
  }

  static network(): ApiError {
    return new ApiError({ kind: 'network', code: ErrorCode.Network });
  }

  static timeout(): ApiError {
    return new ApiError({ kind: 'timeout', code: ErrorCode.Timeout });
  }

  static aborted(): ApiError {
    return new ApiError({ kind: 'aborted', code: ErrorCode.Aborted });
  }

  static sessionExpired(): ApiError {
    return new ApiError({ kind: 'session', code: ErrorCode.SessionExpired, status: 401 });
  }

  static invalidResponse(status: number | null): ApiError {
    return new ApiError({ kind: 'invalid_response', code: ErrorCode.InvalidResponse, status });
  }

  /** Builds an error from a non-2xx response and its (possibly non-JSON) body. */
  static fromResponse(status: number, body: unknown, retryAfterHeader: string | null): ApiError {
    const envelope = isRecord(body) ? body : {};
    const code =
      typeof envelope.code === 'string'
        ? envelope.code
        : status >= 500
          ? ErrorCode.InternalError
          : (STATUS_CODES[status] ?? ErrorCode.InvalidRequest);
    const details = isRecord(envelope.details) ? envelope.details : undefined;

    return new ApiError({
      kind: 'http',
      status,
      code,
      details,
      fieldErrors: parseFieldErrors(details),
      retryAfterSeconds: parseRetryAfter(details, retryAfterHeader),
      requestId: typeof envelope.requestId === 'string' ? envelope.requestId : undefined,
    });
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/** Converts anything thrown into a displayable message. */
export function errorMessage(err: unknown): string {
  if (isApiError(err)) return err.message;
  return t('errors.INTERNAL_ERROR');
}

function messageForCode(code: string, status: number | null): string {
  const known = tOptional(`errors.${code}`);
  if (known) return known;
  if (status !== null && status >= 500) return t('errors.INTERNAL_ERROR');
  const fallback = status !== null ? STATUS_CODES[status] : undefined;
  return tOptional(`errors.${fallback ?? ErrorCode.InvalidRequest}`) ?? t('errors.INVALID_REQUEST');
}

/** `NET-7F3A`: lets support tell apart reports of failures that never reached the server. */
function clientReference(kind: ApiErrorKind): string {
  const prefix = kind === 'timeout' ? 'TMO' : kind === 'http' || kind === 'invalid_response' ? 'API' : 'NET';
  const suffix = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
  return `${prefix}-${suffix}`;
}

/**
 * class-validator messages look like "identifier must be a valid email address".
 * The first word is the DTO property; map it so forms can show inline errors.
 * Whitelist errors ("property x should not exist") are not field errors.
 */
export function parseFieldErrors(details: Record<string, unknown> | undefined): Record<string, string> {
  const errors = details?.errors;
  if (!Array.isArray(errors)) return {};
  const result: Record<string, string> = {};
  for (const entry of errors) {
    if (typeof entry !== 'string') continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/.exec(entry.trim());
    if (!match || match[1] === 'property') continue;
    const [, field, rest] = match;
    if (result[field]) continue;
    result[field] = rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  return result;
}

function parseRetryAfter(details: Record<string, unknown> | undefined, header: string | null): number | null {
  const fromDetails = details?.retryAfterSeconds;
  if (typeof fromDetails === 'number' && Number.isFinite(fromDetails) && fromDetails > 0) {
    return Math.ceil(fromDetails);
  }
  if (header) {
    const seconds = Number.parseInt(header, 10);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
