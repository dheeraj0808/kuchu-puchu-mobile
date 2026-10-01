import { ApiError, ErrorCode } from '@/api/errors';
import { createMockAuth, MOCK_OTP } from '@/api/mocks/auth';
import type { AuthTokens, DeviceSession } from '@/api/types';
import { cancelReauth, completeReauth, isReauthCancelled, useReauthStore, withReauth } from '@/auth/reauth';
import { SessionManager } from '@/auth/session';
import { getOtpFlow, startOtpFlow } from '@/features/auth/otpFlow';
import { deleteMyAccount } from '@/features/settings/deleteAccount';
import { describeSession, formatLastActive, splitSessions } from '@/features/settings/sessions';
import { maskEmail, maskPhone } from '@/lib/identifier';
import { queryClient, queryKeys } from '@/lib/queryClient';

jest.mock('expo-secure-store', () => ({}));

// Seeded queries start React Query's 5-minute GC timers, which would keep Jest alive.
afterAll(() => queryClient.clear());

const NOW = Date.parse('2026-10-01T12:00:00Z');
const session = (id: string, isCurrent: boolean, agoMs: number, city: string | null = 'Mumbai'): DeviceSession => ({
  id,
  deviceName: `Phone ${id}`,
  city,
  lastActiveAt: new Date(NOW - agoMs).toISOString(),
  isCurrent,
});
const reauthRequired = () => ApiError.fromResponse(403, { code: 'REAUTH_REQUIRED', message: 'x' }, null);

async function signedInMock() {
  const mock = createMockAuth(() => NOW, 0);
  await mock.requestOtp({ identifierType: 'phone', identifier: '+919876543210' });
  const tokens = await mock.verifyOtp({ identifierType: 'phone', identifier: '+919876543210', otp: MOCK_OTP, deviceName: 'Pixel 7' });
  return { mock, token: tokens.accessToken };
}

describe('sessions list states (screen 45)', () => {
  it('puts this device first and the others most recent first', () => {
    const { current, others } = splitSessions([
      session('old', false, 20 * 86_400_000),
      session('me', true, 0, 'Bengaluru'),
      session('recent', false, 2 * 86_400_000),
    ]);
    expect(current?.id).toBe('me');
    expect(others.map((s) => s.id)).toEqual(['recent', 'old']);
  });

  it('empty state: only this device', () => {
    expect(splitSessions([session('me', true, 0)])).toEqual({ current: expect.objectContaining({ id: 'me' }), others: [] });
    expect(splitSessions([])).toEqual({ current: null, others: [] });
  });

  it.each([
    [60_000, 'active now'],
    [30 * 60_000, '30 minutes ago'],
    [3_600_000, '1 hour ago'],
    [86_400_000, '1 day ago'],
    [2 * 86_400_000, '2 days ago'],
    [21 * 86_400_000, '3 weeks ago'],
  ])('%i ms ago → %p', (ago, text) => {
    expect(formatLastActive(new Date(NOW - ago).toISOString(), NOW)).toBe(text);
  });

  it('describes rows as in the deck', () => {
    expect(describeSession(session('me', true, 0, 'Bengaluru'), NOW)).toBe('Bengaluru, active now');
    expect(describeSession(session('x', false, 2 * 86_400_000), NOW)).toBe('Mumbai, 2 days ago');
    expect(describeSession(session('x', false, 2 * 86_400_000, null), NOW)).toBe('2 days ago');
  });

  it('mock GET /auth/sessions: this device plus an older one', async () => {
    const { mock, token } = await signedInMock();
    const list = await mock.listSessions(token);
    expect(list).toHaveLength(2);
    expect(list.find((s) => s.isCurrent)).toMatchObject({ deviceName: 'Pixel 7', city: 'Bengaluru' });
    expect(list.find((s) => !s.isCurrent)).toMatchObject({ deviceName: 'Redmi Note 11', city: 'Mumbai' });
  });
});

describe('sign out one / all', () => {
  it('DELETE /auth/sessions/:id removes only that device', async () => {
    const { mock, token } = await signedInMock();
    const other = (await mock.listSessions(token)).find((s) => !s.isCurrent)!;
    await mock.revokeSession(token, other.id);
    expect((await mock.listSessions(token)).map((s) => s.isCurrent)).toEqual([true]);
    await expect(mock.revokeSession(token, other.id)).rejects.toMatchObject({ status: 404 });
  });

  it('POST /auth/logout-all keeps this device signed in', async () => {
    const { mock, token } = await signedInMock();
    await mock.logoutAll(token);
    const list = await mock.listSessions(token);
    expect(list).toHaveLength(1);
    expect(list[0].isCurrent).toBe(true);
  });
});

describe('reauth flow (REAUTH_REQUIRED → OTP sheet → repeat)', () => {
  afterEach(() => cancelReauth());

  it('opens the sheet, then retries the original action once after the code is confirmed', async () => {
    const action = jest.fn().mockRejectedValueOnce(reauthRequired()).mockResolvedValueOnce('deleted');
    const result = withReauth(action);
    await Promise.resolve();
    await Promise.resolve();
    expect(useReauthStore.getState().visible).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);

    completeReauth();
    await expect(result).resolves.toBe('deleted');
    expect(action).toHaveBeenCalledTimes(2);
    expect(useReauthStore.getState().visible).toBe(false);
  });

  it('closing the sheet fails the action with REAUTH_CANCELLED', async () => {
    const result = withReauth(jest.fn().mockRejectedValue(reauthRequired()));
    await Promise.resolve();
    await Promise.resolve();
    cancelReauth();
    const err = await result.catch((e: unknown) => e);
    expect(isReauthCancelled(err)).toBe(true);
  });

  it('concurrent refusals share one prompt', async () => {
    const before = useReauthStore.getState().round;
    const a = withReauth(jest.fn().mockRejectedValueOnce(reauthRequired()).mockResolvedValue('a'));
    const b = withReauth(jest.fn().mockRejectedValueOnce(reauthRequired()).mockResolvedValue('b'));
    await new Promise((r) => setTimeout(r, 0));
    expect(useReauthStore.getState().round).toBe(before + 1);
    completeReauth();
    await expect(Promise.all([a, b])).resolves.toEqual(['a', 'b']);
  });

  it('a second REAUTH_REQUIRED after confirming is returned, not looped', async () => {
    const action = jest.fn().mockRejectedValue(reauthRequired());
    const result = withReauth(action, async () => undefined);
    await expect(result).rejects.toMatchObject({ code: ErrorCode.ReauthRequired });
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('mock DELETE /account needs a fresh step-up', async () => {
    const { mock, token } = await signedInMock();
    await expect(mock.deleteAccount(token)).rejects.toMatchObject({ status: 403, code: 'REAUTH_REQUIRED' });
    await mock.requestReauth(token);
    await expect(mock.verifyReauth(token, '000000')).rejects.toMatchObject({ code: 'OTP_INVALID' });
    await mock.verifyReauth(token, MOCK_OTP);
    await expect(mock.deleteAccount(token)).resolves.toMatchObject({ message: 'Account deleted' });
    await expect(mock.listSessions(token)).rejects.toMatchObject({ status: 401 });
  });

  it('end to end: delete → REAUTH_REQUIRED → verify → delete succeeds', async () => {
    const { mock, token } = await signedInMock();
    const deleting = withReauth(() => mock.deleteAccount(token), async () => {
      await mock.requestReauth(token);
      await mock.verifyReauth(token, MOCK_OTP);
    });
    await expect(deleting).resolves.toMatchObject({ message: 'Account deleted' });
  });
});

describe('delete account clears session and caches', () => {
  const tokens: AuthTokens = {
    accessToken: 'a1',
    refreshToken: 'r1',
    tokenType: 'Bearer',
    accessTokenExpiresIn: 900,
    refreshTokenExpiresAt: '2026-10-08T00:00:00Z',
    user: {
      id: 'u1',
      email: null,
      phone: '+919876543210',
      emailVerified: false,
      phoneVerified: true,
      status: 'active',
      role: 'user',
      createdAt: '2026-10-01T00:00:00Z',
    },
  };

  it('removes tokens, user queries and stores; keeps /app/config', async () => {
    let stored: string | null = null;
    const storage = {
      getRefreshToken: jest.fn(async () => stored),
      setRefreshToken: jest.fn(async (v: string) => ((stored = v), true)),
      clearRefreshToken: jest.fn(async () => {
        stored = null;
      }),
      getDeviceId: jest.fn(async () => null),
      setDeviceId: jest.fn(async () => true),
    };
    const api = { refreshSession: jest.fn(), logout: jest.fn(), fetchMe: jest.fn(async () => ({ ...tokens.user, profile: null })) };
    const s = new SessionManager(api, storage); // default cleanup: React Query + Zustand
    await s.signIn(tokens);

    queryClient.setQueryData(queryKeys.sessions, [session('me', true, 0)]);
    queryClient.setQueryData(queryKeys.appConfig, { kind: 'ready' });
    startOtpFlow('phone', '+919876543210', { message: 'Code sent', expiresInSeconds: 300, resendAfterSeconds: 60 });
    const remove = jest.fn(async () => ({ message: 'Account deleted' }));

    await deleteMyAccount({ remove, end: (notice) => s.end(notice) });

    expect(remove).toHaveBeenCalledTimes(1);
    expect(s.getSnapshot()).toMatchObject({ status: 'signedOut', user: null, notice: null });
    expect(stored).toBeNull();
    expect(queryClient.getQueryData(queryKeys.sessions)).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.appConfig)).toEqual({ kind: 'ready' });
    expect(getOtpFlow()).toBeNull();
    await expect(s.getAccessToken()).resolves.toBeNull();
  });

  it('a failed delete keeps the user signed in', async () => {
    const end = jest.fn();
    await expect(deleteMyAccount({ remove: jest.fn().mockRejectedValue(ApiError.network()), end })).rejects.toMatchObject({
      kind: 'network',
    });
    expect(end).not.toHaveBeenCalled();
  });
});

describe('masking (screen 40)', () => {
  it('masks like the deck', () => {
    expect(maskPhone('+919876543210')).toBe('+91 98••• ••210');
    expect(maskEmail('jane@example.com')).toBe('j•••@example.com');
  });
});
