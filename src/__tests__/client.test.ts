/**
 * Exercises the real http → client → session stack against a stubbed fetch,
 * using the exact envelopes the backend returns.
 */
// jest.mock calls below are hoisted above these imports by babel-jest.
import { getCurrentUser } from '@/api/account';
import { ApiError } from '@/api/errors';
import type { AuthTokens } from '@/api/types';
import { session } from '@/auth/session';

jest.mock('expo-secure-store', () => ({}));
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
};

const tokens = (n: number): AuthTokens => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  tokenType: 'Bearer',
  accessTokenExpiresIn: 900,
  refreshTokenExpiresAt: '2026-10-06T00:00:00.000Z',
  user: user as AuthTokens['user'],
});

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, timestamp: 'now' }), { status: 200 });
const unauthorized = (code = 'UNAUTHORIZED') =>
  new Response(JSON.stringify({ success: false, message: 'Authentication required', code, path: '/x', timestamp: 'now' }), {
    status: 401,
  });

type Call = { url: string; auth: string | null; body: unknown };
let calls: Call[] = [];
let handler: (call: Call) => Response;

beforeEach(async () => {
  calls = [];
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const call = {
      url: String(input),
      auth: headers.Authorization ?? null,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  await session.end(null);
  await session.signIn(tokens(1));
  calls = [];
});

it('sends the bearer token and unwraps the envelope', async () => {
  handler = () => ok(user);
  await expect(getCurrentUser()).resolves.toEqual(user);
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe('http://localhost:3000/api/auth/me');
  expect(calls[0].auth).toBe('Bearer access-1');
});

it('refreshes once on 401 and retries the original request', async () => {
  handler = (c) => {
    if (c.url.endsWith('/auth/refresh')) return ok(tokens(2));
    return c.auth === 'Bearer access-2' ? ok(user) : unauthorized();
  };
  await expect(getCurrentUser()).resolves.toEqual(user);
  expect(calls.map((c) => c.url.replace('http://localhost:3000/api', ''))).toEqual([
    '/auth/me',
    '/auth/refresh',
    '/auth/me',
  ]);
  expect(calls[1].body).toEqual({ refreshToken: 'refresh-1' });
});

it('runs a single refresh for simultaneous 401s', async () => {
  handler = (c) => {
    if (c.url.endsWith('/auth/refresh')) return ok(tokens(2));
    return c.auth === 'Bearer access-2' ? ok(user) : unauthorized();
  };
  await Promise.all([getCurrentUser(), getCurrentUser(), getCurrentUser()]);
  expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
});

it('ends the session when refresh is rejected — no loop', async () => {
  handler = (c) => (c.url.endsWith('/auth/refresh') ? unauthorized('INVALID_REFRESH_TOKEN') : unauthorized());
  await expect(getCurrentUser()).rejects.toMatchObject({ kind: 'session' });
  expect(calls).toHaveLength(2);
  expect(session.getSnapshot().status).toBe('unauthenticated');
});

it('ends the session if the retried request is still unauthorized — no loop', async () => {
  handler = (c) => (c.url.endsWith('/auth/refresh') ? ok(tokens(2)) : unauthorized());
  await expect(getCurrentUser()).rejects.toMatchObject({ kind: 'session' });
  expect(calls).toHaveLength(3);
  expect(session.getSnapshot().status).toBe('unauthenticated');
});

it('reports network failures without ending the session', async () => {
  handler = () => {
    throw new TypeError('Network request failed');
  };
  const err = await getCurrentUser().catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).kind).toBe('network');
  expect(session.getSnapshot().status).toBe('authenticated');
});
