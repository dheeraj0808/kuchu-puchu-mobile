/**
 * Exercises the real http → client → session stack against a stubbed fetch,
 * using the envelopes the backend returns (backend/src/common/filters and interceptors).
 */
// jest.mock calls below are hoisted above these imports by babel-jest.
import { getMe } from '@/api/account';
import { ApiError } from '@/api/errors';
import { retryTiming } from '@/api/http';
import type { AuthTokens } from '@/api/types';
import { session } from '@/auth/session';
import { env } from '@/config/env';

jest.mock('expo-secure-store', () => ({}));
jest.mock('@/auth/device', () => ({ getDeviceId: async () => 'android:test-device' }));
jest.mock('@/auth/tokenStorage', () => {
  let refresh: string | null = null;
  return {
    tokenStorage: {
      getRefreshToken: async () => refresh,
      setRefreshToken: async (t: string) => ((refresh = t), true),
      clearRefreshToken: async () => {
        refresh = null;
      },
      getDeviceId: async () => null,
      setDeviceId: async () => true,
    },
  };
});

const user = {
  id: '6f1c7a52-0a52-4c89-8d0e-3a2f5e1d9b10',
  email: 'jane@example.com',
  phone: null,
  emailVerified: true,
  phoneVerified: false,
  status: 'active',
  role: 'user',
  createdAt: '2026-09-29T00:00:00.000Z',
  profile: null,
};

const tokens = (n: number): AuthTokens => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  tokenType: 'Bearer',
  accessTokenExpiresIn: 900,
  refreshTokenExpiresAt: '2026-10-06T00:00:00.000Z',
  user: user as unknown as AuthTokens['user'],
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const ok = (data: unknown) => json(200, { success: true, data });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  json(status, { success: false, code, message: 'server text', requestId: 'req-42', ...extra });

type Call = { path: string; method: string; headers: Record<string, string>; body: unknown };
let calls: Call[] = [];
let handler: (call: Call) => Response | Promise<Response>;

const path = (url: string) => url.replace(env.apiUrl, '');
const refreshCalls = () => calls.filter((c) => c.path === '/auth/refresh');

beforeEach(async () => {
  retryTiming.sleep = async () => undefined;
  handler = () => ok(user);
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      path: path(String(input)),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  await session.end(null);
  await session.signIn(tokens(1)); // also loads /auth/me once
  calls = [];
});

describe('http client', () => {
  it('calls /api/v1, sends the guide headers and unwraps the envelope', async () => {
    await expect(getMe()).resolves.toEqual(user);
    expect(env.apiUrl).toMatch(/\/api\/v1$/);
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe('/auth/me');
    expect(calls[0].headers).toMatchObject({
      Authorization: 'Bearer access-1',
      'X-Device-Id': 'android:test-device',
      'X-App-Version': env.appVersion,
    });
  });

  it('throws ApiError with code, details and requestId — message comes from the code, not the server', async () => {
    handler = () => fail(403, 'ENTITLEMENT_REQUIRED', { details: { entitlement: 'see_likes' } });
    const err = (await getMe().catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'ENTITLEMENT_REQUIRED', status: 403, requestId: 'req-42' });
    expect(err.details).toEqual({ entitlement: 'see_likes' });
    expect(err.message).not.toBe('server text');
  });

  it('retries a GET at most twice on transient failures', async () => {
    handler = () => fail(503, 'PROVIDER_UNAVAILABLE');
    await expect(getMe()).rejects.toMatchObject({ status: 503 });
    expect(calls).toHaveLength(3);
  });

  it('recovers when a retry succeeds', async () => {
    let n = 0;
    handler = () => {
      n += 1;
      if (n === 1) throw new TypeError('Network request failed');
      return ok(user);
    };
    await expect(getMe()).resolves.toEqual(user);
    expect(calls).toHaveLength(2);
  });

  it('does not retry client errors', async () => {
    handler = () => fail(404, 'USER_NOT_FOUND');
    await expect(getMe()).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
    expect(calls).toHaveLength(1);
  });

  it('reports network failures without ending the session', async () => {
    handler = () => {
      throw new TypeError('Network request failed');
    };
    const err = (await getMe().catch((e: unknown) => e)) as ApiError;
    expect(err.kind).toBe('network');
    expect(err.reference).toMatch(/^NET-[0-9A-F]{4}$/);
    expect(session.getSnapshot().status).toBe('signedIn');
  });
});

describe('single-flight 401 refresh', () => {
  it('refreshes once on 401 and retries the original request', async () => {
    handler = (c) => {
      if (c.path === '/auth/refresh') return ok(tokens(2));
      return c.headers.Authorization === 'Bearer access-2' ? ok(user) : fail(401, 'UNAUTHORIZED');
    };
    await expect(getMe()).resolves.toEqual(user);
    expect(calls.map((c) => c.path)).toEqual(['/auth/me', '/auth/refresh', '/auth/me']);
    expect(calls[1].body).toEqual({ refreshToken: 'refresh-1' });
  });

  it('race: five parallel 401s trigger exactly one refresh, and every request retries once', async () => {
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((r) => (releaseRefresh = r));
    handler = async (c) => {
      if (c.path === '/auth/refresh') {
        await refreshGate; // hold the refresh open so every 401 arrives while it is in flight
        return ok(tokens(2));
      }
      return c.headers.Authorization === 'Bearer access-2' ? ok(user) : fail(401, 'UNAUTHORIZED');
    };

    const requests = Promise.all(Array.from({ length: 5 }, () => getMe()));
    await new Promise((r) => setTimeout(r, 0));
    releaseRefresh();

    await expect(requests).resolves.toHaveLength(5);
    expect(refreshCalls()).toHaveLength(1);
    const meCalls = calls.filter((c) => c.path === '/auth/me');
    expect(meCalls).toHaveLength(10); // 5 rejected + 5 retried, never a third attempt
    expect(meCalls.slice(5).every((c) => c.headers.Authorization === 'Bearer access-2')).toBe(true);
  });

  it('race: a 401 that arrives after another request already refreshed reuses the new token', async () => {
    handler = (c) => {
      if (c.path === '/auth/refresh') return ok(tokens(2));
      return c.headers.Authorization === 'Bearer access-2' ? ok(user) : fail(401, 'UNAUTHORIZED');
    };
    await getMe(); // refreshes to access-2
    calls = [];
    await session.recoverFromUnauthorized('access-1');
    expect(refreshCalls()).toHaveLength(0);
  });

  it('refresh rejected → session ends and callers get SESSION_EXPIRED (no loop)', async () => {
    handler = (c) => (c.path === '/auth/refresh' ? fail(401, 'INVALID_REFRESH_TOKEN') : fail(401, 'UNAUTHORIZED'));
    const results = await Promise.allSettled([getMe(), getMe(), getMe()]);
    expect(results.every((r) => r.status === 'rejected' && (r.reason as ApiError).kind === 'session')).toBe(true);
    expect(refreshCalls()).toHaveLength(1);
    expect(session.getSnapshot().status).toBe('signedOut');
  });

  it('still unauthorized after the refresh → session ends (no loop)', async () => {
    handler = (c) => (c.path === '/auth/refresh' ? ok(tokens(2)) : fail(401, 'UNAUTHORIZED'));
    await expect(getMe()).rejects.toMatchObject({ kind: 'session' });
    expect(calls).toHaveLength(3);
    expect(session.getSnapshot().status).toBe('signedOut');
  });
});
