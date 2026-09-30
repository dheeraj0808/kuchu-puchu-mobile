import { ApiError } from '@/api/errors';
import type { AuthTokens } from '@/api/types';
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

const unauthorized = () => ApiError.fromResponse(401, { code: 'INVALID_REFRESH_TOKEN', message: 'x' }, null);

describe('SessionManager', () => {
  it('restores to unauthenticated when nothing is stored, without calling the API', async () => {
    const api = { refreshSession: jest.fn(), logout: jest.fn() };
    const s = new SessionManager(api, memoryStorage());
    await s.restore();
    expect(s.getSnapshot()).toMatchObject({ status: 'unauthenticated', notice: null });
    expect(api.refreshSession).not.toHaveBeenCalled();
  });

  it('restores a stored session via refresh and persists the rotated token', async () => {
    const storage = memoryStorage('refresh-0');
    const api = { refreshSession: jest.fn(async () => tokens(1)), logout: jest.fn() };
    const s = new SessionManager(api, storage);
    await s.restore();
    expect(api.refreshSession).toHaveBeenCalledWith('refresh-0');
    expect(s.getSnapshot()).toMatchObject({ status: 'authenticated', user });
    expect(storage.peek()).toBe('refresh-1');
    await expect(s.getAccessToken()).resolves.toBe('access-1');
  });

  it('keeps the session and reports an error when offline at launch', async () => {
    const storage = memoryStorage('refresh-0');
    const api = { refreshSession: jest.fn(async () => Promise.reject(ApiError.network())), logout: jest.fn() };
    const s = new SessionManager(api, storage);
    await s.restore();
    expect(s.getSnapshot().status).toBe('error');
    expect(storage.peek()).toBe('refresh-0');
  });

  it('ends the session with a notice when the refresh token is rejected', async () => {
    const storage = memoryStorage('refresh-0');
    const api = { refreshSession: jest.fn(async () => Promise.reject(unauthorized())), logout: jest.fn() };
    const s = new SessionManager(api, storage);
    await s.restore();
    expect(s.getSnapshot()).toMatchObject({ status: 'unauthenticated' });
    expect(s.getSnapshot().notice).toMatch(/session has ended/);
    expect(storage.peek()).toBeNull();
  });

  it('shares one refresh between concurrent callers (backend rotates tokens)', async () => {
    let resolve!: (t: AuthTokens) => void;
    const api = {
      refreshSession: jest.fn(() => new Promise<AuthTokens>((r) => (resolve = r))),
      logout: jest.fn(),
    };
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
    const api = { refreshSession: jest.fn(async () => tokens(2)), logout: jest.fn() };
    const s = new SessionManager(api, memoryStorage(), () => now);
    await s.signIn(tokens(1, 900));
    await expect(s.getAccessToken()).resolves.toBe('access-1');
    now += 880_000; // within the 30s skew
    await expect(s.getAccessToken()).resolves.toBe('access-2');
    expect(api.refreshSession).toHaveBeenCalledWith('refresh-1');
  });

  it('reuses a token refreshed by another request after a 401', async () => {
    const api = { refreshSession: jest.fn(async () => tokens(2)), logout: jest.fn() };
    const s = new SessionManager(api, memoryStorage());
    await s.signIn(tokens(1));
    await expect(s.recoverFromUnauthorized('access-1')).resolves.toBe('access-2');
    await expect(s.recoverFromUnauthorized('access-1')).resolves.toBe('access-2');
    expect(api.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('signs out remotely and clears locally even if the server is unreachable', async () => {
    const storage = memoryStorage();
    const api = { refreshSession: jest.fn(), logout: jest.fn(async () => Promise.reject(ApiError.network())) };
    const s = new SessionManager(api, storage);
    await s.signIn(tokens(1));
    await s.signOut();
    expect(api.logout).toHaveBeenCalledWith('refresh-1');
    expect(s.getSnapshot()).toMatchObject({ status: 'unauthenticated', user: null, notice: null });
    expect(storage.peek()).toBeNull();
    await expect(s.getAccessToken()).resolves.toBeNull();
  });

  it('discards a refresh that completes after sign-out and revokes it', async () => {
    let resolve!: (t: AuthTokens) => void;
    const api = {
      refreshSession: jest.fn(() => new Promise<AuthTokens>((r) => (resolve = r))),
      logout: jest.fn(async () => ({ message: 'Logged out' })),
    };
    const s = new SessionManager(api, memoryStorage('refresh-0'));
    const pending = s.refreshAccessToken();
    await Promise.resolve();
    await s.end(null);
    resolve(tokens(9));
    await expect(pending).resolves.toBeNull();
    expect(s.getSnapshot().status).toBe('unauthenticated');
    expect(api.logout).toHaveBeenCalledWith('refresh-9');
  });
});
