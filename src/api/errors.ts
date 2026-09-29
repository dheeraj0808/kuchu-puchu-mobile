/**
 * Normalized API errors. `ApiError.message` is always safe to show to users:
 * raw backend text is only surfaced for codes whose messages the backend
 * explicitly designs for clients.
 */

/** Mirrors backend/src/common/exceptions/app.exception.ts ErrorCode. */
export const ErrorCode = {
  InvalidRequest: 'INVALID_REQUEST',
  ValidationError: 'VALIDATION_ERROR',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  TooManyRequests: 'TOO_MANY_REQUESTS',
  OtpInvalid: 'OTP_INVALID',
  OtpCooldown: 'OTP_COOLDOWN',
  OtpDeliveryFailed: 'OTP_DELIVERY_FAILED',
  InvalidRefreshToken: 'INVALID_REFRESH_TOKEN',
  AccountRestricted: 'ACCOUNT_RESTRICTED',
  InternalError: 'INTERNAL_ERROR',
  // Client-side only
  Network: 'NETWORK_ERROR',
  Timeout: 'TIMEOUT',
  Aborted: 'ABORTED',
  InvalidResponse: 'INVALID_RESPONSE',
  SessionExpired: 'SESSION_EXPIRED',
} as const;

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'aborted' | 'invalid_response' | 'session';

/** Codes whose backend `message` is written for end users. */
const CLIENT_SAFE_MESSAGE_CODES = new Set<string>([
  ErrorCode.OtpCooldown,
  ErrorCode.OtpDeliveryFailed,
  ErrorCode.AccountRestricted,
]);

const CODE_MESSAGES: Record<string, string> = {
  [ErrorCode.ValidationError]: 'Please check the highlighted details and try again.',
  [ErrorCode.InvalidRequest]: 'Something about that request was not right. Please try again.',
  [ErrorCode.Unauthorized]: 'Your session has ended. Please sign in again.',
  [ErrorCode.InvalidRefreshToken]: 'Your session has ended. Please sign in again.',
  [ErrorCode.SessionExpired]: 'Your session has ended. Please sign in again.',
  [ErrorCode.Forbidden]: 'You don’t have access to do that.',
  [ErrorCode.NotFound]: 'We couldn’t find what you were looking for.',
  [ErrorCode.TooManyRequests]: 'Too many attempts. Please wait a moment and try again.',
  [ErrorCode.OtpInvalid]: 'That code is incorrect or has expired.',
  [ErrorCode.InternalError]: 'Something went wrong on our side. Please try again shortly.',
  [ErrorCode.Network]: 'Can’t reach Kuchu Puchu. Check your connection and try again.',
  [ErrorCode.Timeout]: 'The server is taking too long to respond. Please try again.',
  [ErrorCode.InvalidResponse]: 'We received an unexpected response. Please try again.',
  [ErrorCode.Aborted]: 'The request was cancelled.',
};

const STATUS_CODES: Record<number, string> = {
  400: ErrorCode.InvalidRequest,
  401: ErrorCode.Unauthorized,
  403: ErrorCode.Forbidden,
  404: ErrorCode.NotFound,
  429: ErrorCode.TooManyRequests,
};

const STATUS_MESSAGES: Record<number, string> = {
  409: 'That conflicts with information we already have.',
  422: 'Please check the highlighted details and try again.',
};

interface ApiErrorInit {
  kind: ApiErrorKind;
  code: string;
  message: string;
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

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.code = init.code;
    this.status = init.status ?? null;
    this.details = init.details;
    this.fieldErrors = init.fieldErrors ?? {};
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
    this.requestId = init.requestId;
  }

  get isNetworkError(): boolean {
    return this.kind === 'network' || this.kind === 'timeout';
  }

  get hasFieldErrors(): boolean {
    return Object.keys(this.fieldErrors).length > 0;
  }

  static network(): ApiError {
    return new ApiError({ kind: 'network', code: ErrorCode.Network, message: CODE_MESSAGES[ErrorCode.Network] });
  }

  static timeout(): ApiError {
    return new ApiError({ kind: 'timeout', code: ErrorCode.Timeout, message: CODE_MESSAGES[ErrorCode.Timeout] });
  }

  static aborted(): ApiError {
    return new ApiError({ kind: 'aborted', code: ErrorCode.Aborted, message: CODE_MESSAGES[ErrorCode.Aborted] });
  }

  static sessionExpired(): ApiError {
    return new ApiError({
      kind: 'session',
      code: ErrorCode.SessionExpired,
      status: 401,
      message: CODE_MESSAGES[ErrorCode.SessionExpired],
    });
  }

  static invalidResponse(status: number | null): ApiError {
    return new ApiError({
      kind: 'invalid_response',
      code: ErrorCode.InvalidResponse,
      status,
      message: CODE_MESSAGES[ErrorCode.InvalidResponse],
    });
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
    const serverMessage = typeof envelope.message === 'string' ? envelope.message : undefined;

    return new ApiError({
      kind: 'http',
      status,
      code,
      details,
      message: friendlyMessage(code, status, serverMessage),
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
  return CODE_MESSAGES[ErrorCode.InternalError];
}

function friendlyMessage(code: string, status: number, serverMessage: string | undefined): string {
  if (serverMessage && CLIENT_SAFE_MESSAGE_CODES.has(code)) return serverMessage;
  if (status >= 500) return CODE_MESSAGES[ErrorCode.InternalError];
  return CODE_MESSAGES[code] ?? STATUS_MESSAGES[status] ?? CODE_MESSAGES[ErrorCode.InvalidRequest];
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
