import { ApiError, ErrorCode, parseFieldErrors } from '@/api/errors';
import { resolveErrorUi } from '@/api/errorUi';

// Bodies shaped like backend/src/common/filters/all-exceptions.filter.ts output.
const base = { success: false, requestId: 'req-1' };
const fromBody = (status: number, code: string, details?: Record<string, unknown>, header: string | null = null) =>
  ApiError.fromResponse(status, { ...base, code, message: 'Server wording that may change', details }, header);

describe('ApiError.fromResponse', () => {
  it('keeps code, status, retryAfterSeconds and requestId', () => {
    const err = fromBody(429, 'OTP_COOLDOWN', { retryAfterSeconds: 51 });
    expect(err).toMatchObject({ code: ErrorCode.OtpCooldown, status: 429, retryAfterSeconds: 51, requestId: 'req-1' });
    expect(err.reference).toBe('req-1');
  });

  it('never shows the server message: text comes from the locale file by code', () => {
    expect(fromBody(401, 'OTP_INVALID').message).toBe("That code isn't right or has expired.");
    expect(fromBody(429, 'TOO_MANY_REQUESTS').message).not.toMatch(/Server wording/);
  });

  it('reads Retry-After when details has none', () => {
    expect(fromBody(429, 'TOO_MANY_REQUESTS', undefined, '60').retryAfterSeconds).toBe(60);
  });

  it('maps validation errors to fields', () => {
    const err = fromBody(400, 'VALIDATION_ERROR', {
      errors: ['identifier must be a phone number in E.164 format (e.g. +919876543210)'],
    });
    expect(err.fieldErrors).toEqual({ identifier: 'Must be a phone number in E.164 format (e.g. +919876543210)' });
  });

  it('handles non-JSON bodies and unknown codes by HTTP class', () => {
    expect(ApiError.fromResponse(502, null, null).code).toBe(ErrorCode.InternalError);
    expect(ApiError.fromResponse(502, null, null).message).toMatch(/went wrong/);
    expect(ApiError.fromResponse(409, null, null).code).toBe(ErrorCode.Conflict);
    expect(fromBody(418, 'SOMETHING_NEW').message).toMatch(/wasn't right/);
  });
});

describe('resolveErrorUi (guide §11)', () => {
  it.each([
    [400, 'VALIDATION_ERROR', 'fieldErrors'],
    [401, 'UNAUTHORIZED', 'signIn'],
    [401, 'OTP_INVALID', 'message'],
    [403, 'ACCOUNT_RESTRICTED', 'restricted'],
    [403, 'REAUTH_REQUIRED', 'reauth'],
    [403, 'ONBOARDING_INCOMPLETE', 'onboarding'],
    [403, 'ENTITLEMENT_REQUIRED', 'paywall'],
    [404, 'USER_NOT_FOUND', 'notFound'],
    [404, 'MATCH_NOT_FOUND', 'notFound'],
    [409, 'DISCOVERY_NOT_READY', 'onboarding'],
    [422, 'CONTACT_DETAILS_NOT_ALLOWED', 'fieldErrors'],
    [422, 'CONTACT_SHARING_LOCKED', 'contactLocked'],
    [422, 'PURCHASE_INVALID', 'purchaseSupport'],
    [429, 'OTP_COOLDOWN', 'countdown'],
    [429, 'LIKE_LIMIT_REACHED', 'outOfLikes'],
    [429, 'VERIFICATION_ATTEMPTS_EXCEEDED', 'support'],
    [500, 'INTERNAL_ERROR', 'retry'],
  ])('%i %s → %s', (status, code, action) => {
    expect(resolveErrorUi(fromBody(status, code)).action).toBe(action);
  });

  it('decides by code even when the server message changes', () => {
    const a = ApiError.fromResponse(403, { code: 'ENTITLEMENT_REQUIRED', message: 'v1 text' }, null);
    const b = ApiError.fromResponse(403, { code: 'ENTITLEMENT_REQUIRED', message: 'totally different v2 text' }, null);
    expect(resolveErrorUi(a)).toEqual(resolveErrorUi(b));
  });

  it('passes nextStep and entitlement from details', () => {
    expect(resolveErrorUi(fromBody(403, 'ONBOARDING_INCOMPLETE', { nextStep: 'photos' })).nextStep).toBe('photos');
    expect(resolveErrorUi(fromBody(403, 'ENTITLEMENT_REQUIRED', { entitlement: 'undo_pass' })).entitlement).toBe(
      'undo_pass',
    );
  });

  it('network and timeout → offline with a client reference', () => {
    const ui = resolveErrorUi(ApiError.network());
    expect(ui.action).toBe('offline');
    expect(ui.reference).toMatch(/^NET-[0-9A-F]{4}$/);
    expect(resolveErrorUi(ApiError.timeout()).action).toBe('offline');
  });

  it('unknown codes fall back by HTTP class; non-ApiErrors become retry', () => {
    expect(resolveErrorUi(fromBody(429, 'NEW_LIMIT')).action).toBe('countdown');
    expect(resolveErrorUi(fromBody(503, 'NEW_OUTAGE')).action).toBe('retry');
    expect(resolveErrorUi(new Error('boom')).action).toBe('retry');
  });
});

describe('parseFieldErrors', () => {
  it('ignores whitelist errors and keeps the first message per field', () => {
    expect(
      parseFieldErrors({ errors: ['property foo should not exist', 'otp must be 4-10 digits', 'otp must be a string'] }),
    ).toEqual({ otp: 'Must be 4-10 digits' });
  });
});
