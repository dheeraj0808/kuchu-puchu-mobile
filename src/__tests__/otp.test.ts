import { createMockAuth, MOCK_OTP } from '@/api/mocks/auth';
import { ApiError } from '@/api/errors';
import { activeIndex, applyKey, extractCode, secondsUntil } from '@/features/auth/otpCode';
import {
  getOtpFlow,
  resetOtpFlow,
  resumeOtpFlowAfterCooldown,
  setResendCooldown,
  startOtpFlow,
} from '@/features/auth/otpFlow';
import { requestCode } from '@/features/auth/requestCode';
import { formatDuration } from '@/lib/identifier';

jest.mock('expo-secure-store', () => ({}));

const currentFlow = getOtpFlow;

describe('OTP input logic', () => {
  it('appends digits up to the length and ignores extras', () => {
    let code = '';
    for (const key of ['4', '8', '2', '9', '1', '3', '7'] as const) code = applyKey(code, key, 6);
    expect(code).toBe('482913');
  });

  it('backspace removes the last digit and is safe when empty', () => {
    expect(applyKey('482', 'backspace', 6)).toBe('48');
    expect(applyKey('', 'backspace', 6)).toBe('');
  });

  it('highlights the next empty box, or the last one when full', () => {
    expect(activeIndex('', 6)).toBe(0);
    expect(activeIndex('4829', 6)).toBe(4);
    expect(activeIndex('482913', 6)).toBe(5);
  });

  it.each([
    ['482913', '482913'],
    ['482 913', '482913'],
    ['482-913', '482913'],
    ['<#> Your Kuchu Puchu code is 482913. FA+9qCX9VSu', '482913'],
    ['Code: 4 8 2 9 1 3', '482913'],
  ])('extracts a pasted / SMS code from %p', (text, expected) => {
    expect(extractCode(text, 6)).toBe(expected);
  });

  it('refuses text without exactly six digits', () => {
    expect(extractCode('12345', 6)).toBeNull();
    expect(extractCode('call 9876543210', 6)).toBeNull();
    expect(extractCode('no digits', 6)).toBeNull();
  });
});

describe('resend countdown', () => {
  beforeEach(() => resetOtpFlow());

  it('counts down from resendAfterSeconds and never goes negative', () => {
    const now = 1_000_000;
    expect(secondsUntil(now + 60_000, now)).toBe(60);
    expect(secondsUntil(now + 60_000, now + 18_000)).toBe(42);
    expect(formatDuration(secondsUntil(now + 60_000, now + 18_000))).toBe('0:42');
    expect(secondsUntil(now + 60_000, now + 61_000)).toBe(0);
  });

  it('a sent code enables resend after 60 s', () => {
    jest.spyOn(Date, 'now').mockReturnValue(5_000);
    startOtpFlow('phone', '+919876543210', { message: 'Code sent', expiresInSeconds: 300, resendAfterSeconds: 60 });
    expect(currentFlow()).toMatchObject({ resendAvailableAt: 65_000, expiresAt: 305_000, sendCount: 1 });
    jest.restoreAllMocks();
  });

  it('a 429 on resend restarts the countdown from retryAfterSeconds', () => {
    jest.spyOn(Date, 'now').mockReturnValue(10_000);
    startOtpFlow('phone', '+919876543210', { message: 'Code sent', expiresInSeconds: 300, resendAfterSeconds: 60 });
    setResendCooldown(42);
    expect(currentFlow()?.resendAvailableAt).toBe(52_000);
    jest.restoreAllMocks();
  });

  it('cooldown after going back keeps the earlier code usable for the same number', () => {
    jest.spyOn(Date, 'now').mockReturnValue(0);
    startOtpFlow('phone', '+919876543210', { message: 'Code sent', expiresInSeconds: 300, resendAfterSeconds: 60 });
    resumeOtpFlowAfterCooldown('phone', '+919876543210', 30);
    expect(currentFlow()).toMatchObject({ expiresAt: 300_000, resendAvailableAt: 30_000, sendCount: 1 });
    jest.restoreAllMocks();
  });

});

describe('429 handling on Send code', () => {
  beforeEach(() => resetOtpFlow());
  const cooldown = (seconds?: number) =>
    ApiError.fromResponse(429, { code: 'OTP_COOLDOWN', message: 'x', details: seconds ? { retryAfterSeconds: seconds } : {} }, null);

  it('OTP_COOLDOWN continues to the code screen with the countdown from retryAfterSeconds', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(0);
    const outcome = await requestCode('phone', '+919876543210', jest.fn().mockRejectedValue(cooldown(45)));
    expect(outcome).toEqual({ kind: 'sent' });
    expect(currentFlow()).toMatchObject({ identifier: '+919876543210', resendAvailableAt: 45_000, expiresAt: null });
    jest.restoreAllMocks();
  });

  it('other 429s keep the user on screen 02 with a countdown', async () => {
    const limited = ApiError.fromResponse(429, { code: 'TOO_MANY_REQUESTS', message: 'x', details: { retryAfterSeconds: 90 } }, null);
    const outcome = await requestCode('email', 'jane@example.com', jest.fn().mockRejectedValue(limited), () => 1_000);
    expect(outcome).toEqual({ kind: 'wait', until: 91_000 });
    expect(currentFlow()).toBeNull();
  });

  it('a 429 without retryAfterSeconds waits 60 s', async () => {
    const limited = ApiError.fromResponse(429, { code: 'TOO_MANY_REQUESTS', message: 'x' }, null);
    const outcome = await requestCode('phone', '+919876543210', jest.fn().mockRejectedValue(limited), () => 0);
    expect(outcome).toEqual({ kind: 'wait', until: 60_000 });
  });

  it('network failure is reported, not treated as sent', async () => {
    const outcome = await requestCode('phone', '+919876543210', jest.fn().mockRejectedValue(ApiError.network()));
    expect(outcome.kind).toBe('error');
  });
});

describe('auth mock (USE_AUTH_MOCK)', () => {
  it('always says "Code sent", then 429 OTP_COOLDOWN with retryAfterSeconds', async () => {
    let now = 0;
    const mock = createMockAuth(() => now, 0);
    await expect(mock.requestOtp({ identifierType: 'phone', identifier: '+919876543210' })).resolves.toMatchObject({
      message: 'Code sent',
      resendAfterSeconds: 60,
    });
    now = 18_000;
    await expect(mock.requestOtp({ identifierType: 'phone', identifier: '+919876543210' })).rejects.toMatchObject({
      status: 429,
      code: 'OTP_COOLDOWN',
      retryAfterSeconds: 42,
    });
    now = 61_000;
    await expect(mock.requestOtp({ identifierType: 'phone', identifier: '+919876543210' })).resolves.toBeTruthy();
  });

  it(`${MOCK_OTP} signs in with nextStep; anything else is 401 OTP_INVALID`, async () => {
    const mock = createMockAuth(() => 0, 0);
    await mock.requestOtp({ identifierType: 'phone', identifier: '+919876543210' });
    await expect(
      mock.verifyOtp({ identifierType: 'phone', identifier: '+919876543210', otp: '000000' }),
    ).rejects.toMatchObject({ status: 401, code: 'OTP_INVALID' });
    const tokens = await mock.verifyOtp({ identifierType: 'phone', identifier: '+919876543210', otp: MOCK_OTP });
    expect(tokens.user).toMatchObject({ phone: '+919876543210', nextStep: 'done' });
    await expect(mock.refreshSession(tokens.refreshToken)).resolves.toMatchObject({ tokenType: 'Bearer' });
  });
});
