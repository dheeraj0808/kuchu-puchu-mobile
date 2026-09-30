import { ApiError, ErrorCode, parseFieldErrors } from '@/api/errors';

// Bodies captured from the running backend (see backend/src/common/filters/all-exceptions.filter.ts).
const base = { success: false, timestamp: '2026-09-29T20:08:33.882Z', requestId: 'req-1' };

describe('ApiError.fromResponse', () => {
  it('maps OTP cooldown with retryAfterSeconds and keeps the client-safe message', () => {
    const err = ApiError.fromResponse(
      429,
      {
        ...base,
        message: 'Please wait before requesting another verification code.',
        code: 'OTP_COOLDOWN',
        path: '/api/auth/request-otp',
        details: { retryAfterSeconds: 51 },
      },
      null,
    );
    expect(err.code).toBe(ErrorCode.OtpCooldown);
    expect(err.status).toBe(429);
    expect(err.retryAfterSeconds).toBe(51);
    expect(err.message).toBe('Please wait before requesting another verification code.');
    expect(err.requestId).toBe('req-1');
  });

  it('never shows the raw throttler message and reads Retry-After', () => {
    const err = ApiError.fromResponse(
      429,
      { ...base, message: 'ThrottlerException: Too Many Requests', code: 'TOO_MANY_REQUESTS', path: '/api/auth/request-otp' },
      '60',
    );
    expect(err.message).not.toMatch(/Throttler/);
    expect(err.retryAfterSeconds).toBe(60);
  });

  it('maps validation errors to fields', () => {
    const err = ApiError.fromResponse(
      400,
      {
        ...base,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        path: '/api/auth/request-otp',
        details: { errors: ['identifier must be a phone number in E.164 format (e.g. +919876543210)'] },
      },
      null,
    );
    expect(err.code).toBe(ErrorCode.ValidationError);
    expect(err.fieldErrors).toEqual({ identifier: 'Must be a phone number in E.164 format (e.g. +919876543210)' });
  });

  it('maps OTP_INVALID to a friendly message', () => {
    const err = ApiError.fromResponse(
      401,
      { ...base, message: 'Invalid or expired verification code', code: 'OTP_INVALID', path: '/api/auth/verify-otp' },
      null,
    );
    expect(err.code).toBe(ErrorCode.OtpInvalid);
    expect(err.message).toBe('That code is incorrect or has expired.');
  });

  it('hides server errors and handles non-JSON bodies', () => {
    const err = ApiError.fromResponse(502, null, null);
    expect(err.code).toBe(ErrorCode.InternalError);
    expect(err.message).toMatch(/went wrong/);
    expect(ApiError.fromResponse(409, null, null).message).toMatch(/conflicts/);
  });
});

describe('parseFieldErrors', () => {
  it('ignores whitelist errors and keeps the first message per field', () => {
    expect(
      parseFieldErrors({ errors: ['property foo should not exist', 'otp must be 4-10 digits', 'otp must be a string'] }),
    ).toEqual({ otp: 'Must be 4-10 digits' });
  });
});
