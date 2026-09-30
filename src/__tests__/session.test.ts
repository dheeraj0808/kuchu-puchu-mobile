import { ApiError } from '@/api/errors';
import type { AuthTokens, Me } from '@/api/types';
import { SessionManager } from '@/auth/session';

jest.mock('expo-secure-store', () => ({}));

const user = {
  id: '6f1c7a52-0a52-4c89-8d0e-3a2f5e1d9b10',
  email: 'jane@example.com',
  phone: null,
  emailVerified: true,
  phoneVerified: false,
  status: 'active' as const,
  role: 'user' as const,
  createdAt: '2026-09-29T00:00:00.000Z',
};

const me: Me = { ...user, profile: { displayName: 'Jane' } };

function tokens(n: number, expiresIn = 900): AuthTokens {
  return {
    accessToken: `access-${n}`,
    refreshToken: `refresh-${n}`,
    tokenType: 'Bearer',
    accessTokenExpiresIn: expiresIn,
    refreshTokenExpiresAt: '2026-10-06T00:00:00.000Z',
    user,
  };
}

function memoryStorage(initial: string | null = null) {
  let refresh = initial;
  return {
    getRefreshToken: jest.fn(async () => refresh),
    setRefreshToken: jest.fn(async (t: string) => {
      refresh = t;
      return true;
    }),
    clearRefreshToken: jest.fn(async () => {
      refresh = null;
    }),
    getDeviceId: jest.fn(async () => null),
    setDeviceId: jest.fn(async () => true),
    peek: () => refresh,
  };
}

function fakeApi(overrides: Partial<Record<'refreshSession' | 'logout' | 'fetchMe', jest.Mock>> = {}) {
  return {
    refreshSession: jest.fn(),
    logout: jest.fn(async () => ({ message: 'Logged out' })),
    fetchMe: jest.fn(async () => me),
    ...overrides,
  };
}

const unauthorized = () => ApiError.fromResponse(401, { code: 'INVALID_REFRESH_TOKEN', message: 'x' }, null);

describe('SessionManager', () => {
  it('starts unknown and becomes signedOut when nothing is stored, without calling the API', async () => {
    const api = fakeApi();
    const s = new SessionManager(api, memoryStorage());
    expect(s.getSnapshot().status).toBe('unknown');
    await s.restore();
    expect(s.getSnapshot()).toMatchObject({ status: 'signedOut', notice: null });
    expect(api.refreshSession).not.toHaveBeenCalled();
  });

  it('launch: refreshes, persists the rotated token, then loads /auth/me', async () => {
    const storage = memoryStorage('refresh-0');
    const api = fakeApi({ refreshSession: jest.fn(async () => tokens(1)) });
    const s = new SessionManager(api, storage);
    await s.restore();
    expect(api.refreshSession).toHaveBeenCalledWith('refresh-0');
    expect(api.fetchMe).toHaveBeenCalledWith('access-1');
    expect(s.getSnapshot()).toMatchObject({ status: 'signedIn', user: me });
    expect(storage.peek()).toBe('refresh-1');
    await expect(s.getAccessToken()).resolves.toBe('access-1');
  });

  it('stays unknown with restoreError when offline at launch, keeping the stored token', async () => {
    const storage = memoryStorage('refresh-0');
    const api = fakeApi({ refreshSession: jest.fn(async () => Promise.reject(ApiError.network())) });
    const s = new SessionManager(api, storage);
    await s.restore();
    expect(s.getSnapshot().status).toBe('unknown');
    expect(s.getSnapshot().restoreError?.kind).toBe('network');
    expect(storage.peek()).toBe('refresh-0');
  });

  it('retrying after /auth/me failed offline reuses the fresh access token (no second rotation)', async () => {
    const api = fakeApi({
      refreshSession: jest.fn(async () => tokens(1)),
      fetchMe: jest.fn().mockRejectedValueOnce(ApiError.network()).mockResolvedValue(me),
    });
    const s = new SessionManager(api, memoryStorage('refresh-0'));
    await s.restore();
    expect(s.getSnapshot().status).toBe('unknown');
    await s.restore();
    expect(s.getSnapshot()).toMatchObject({ status: 'signedIn', restoreError: null });
    expect(api.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('ends the session with a notice when the refresh token is rejected', async () => {
    const storage = memoryStorage('refresh-0');
    const clear = jest.fn();
    const api = fakeApi({ refreshSession: jest.fn(async () => Promise.reject(unauthorized())) });
    const s = new SessionManager(api, storage, Date.now, clear);
    await s.restore();
    expect(s.getSnapshot()).toMatchObject({ status: 'signedOut' });
    expect(s.getSnapshot().notice).toMatch(/session has ended/);
    expect(storage.peek()).toBeNull();
    expect(clear).toHaveBeenCalled();
  });

  it('shares one refresh between concurrent callers (backend rotates tokens)', async () => {
    let resolve!: (t: AuthTokens) => void;
    const api = fakeApi({ refreshSession: jest.fn(() => new Promise<AuthTokens>((r) => (resolve = r))) });
    const s = new SessionManager(api, memoryStorage('refresh-0'));
    const calls = [s.refreshAccessToken(), s.refreshAccessToken(), s.getAccessToken()];
    await Promise.resolve();
    await Promise.resolve();
    resolve(tokens(1));
    await expect(Promise.all(calls)).resolves.toEqual(['access-1', 'access-1', 'access-1']);
    expect(api.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('refreshes proactively when the access token is about to expire', async () => {
    let now = 1_000_000;
    const api = fakeApi({ refreshSession: jest.fn(async () => tokens(2)) });
    const s = new SessionManager(api, memoryStorage(), () => now);
    await s.signIn(tokens(1, 900));
    await expect(s.getAccessToken()).resolves.toBe('access-1');
    now += 880_000; // within the 30s skew
    await expect(s.getAccessToken()).resolves.toBe('access-2');
    expect(api.refreshSession).toHaveBeenCalledWith('refresh-1');
  });

  it('reuses a token refreshed by another request after a 401', async () => {
    const api = fakeApi({ refreshSession: jest.fn(async () => tokens(2)) });
    const s = new SessionManager(api, memoryStorage());
    await s.signIn(tokens(1));
    await expect(s.recoverFromUnauthorized('access-1')).resolves.toBe('access-2');
    await expect(s.recoverFromUnauthorized('access-1')).resolves.toBe('access-2');
    expect(api.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('sign-in stores tokens, then loads the profile from /auth/me', async () => {
    const api = fakeApi();
    const s = new SessionManager(api, memoryStorage());
    await s.signIn(tokens(1));
    expect(api.fetchMe).toHaveBeenCalledWith('access-1');
    expect(s.getSnapshot()).toMatchObject({ status: 'signedIn', user: me });
  });

  it('sign-out revokes remotely and clears storage, caches and stores even when offline', async () => {
    const storage = memoryStorage();
    const clear = jest.fn();
    const api = fakeApi({ logout: jest.fn(async () => Promise.reject(ApiError.network())) });
    const s = new SessionManager(api, storage, Date.now, clear);
    await s.signIn(tokens(1));
    await s.signOut();
    expect(api.logout).toHaveBeenCalledWith('refresh-1');
    expect(s.getSnapshot()).toMatchObject({ status: 'signedOut', user: null, notice: null });
    expect(storage.peek()).toBeNull();
    expect(clear).toHaveBeenCalledTimes(1);
    await expect(s.getAccessToken()).resolves.toBeNull();
  });

  it('discards a refresh that completes after sign-out and revokes it', async () => {
    let resolve!: (t: AuthTokens) => void;
    const api = fakeApi({ refreshSession: jest.fn(() => new Promise<AuthTokens>((r) => (resolve = r))) });
    const s = new SessionManager(api, memoryStorage('refresh-0'));
    const pending = s.refreshAccessToken();
    await Promise.resolve();
    await s.end(null);
    resolve(tokens(9));
    await expect(pending).resolves.toBeNull();
    expect(s.getSnapshot().status).toBe('signedOut');
    expect(api.logout).toHaveBeenCalledWith('refresh-9');
  });
});
