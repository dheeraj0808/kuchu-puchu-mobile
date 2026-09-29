import { session } from '@/auth/session';

import { ApiError } from './errors';
import { httpRequest, type HttpOptions } from './http';

/**
 * Authenticated request: attaches the access token, refreshes it when
 * expired, and retries exactly once after a 401. If the session cannot be
 * recovered it is ended, which routes the user back to sign-in.
 */
export async function authedRequest<T>(path: string, options: Omit<HttpOptions, 'accessToken'> = {}): Promise<T> {
  const token = await session.getAccessToken();
  if (!token) throw ApiError.sessionExpired();

  try {
    return await httpRequest<T>(path, { ...options, accessToken: token });
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401 || err.kind !== 'http') throw err;
  }

  const recovered = await session.recoverFromUnauthorized(token);
  if (!recovered) throw ApiError.sessionExpired();

  try {
    return await httpRequest<T>(path, { ...options, accessToken: recovered });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && err.kind === 'http') {
      await session.end();
      throw ApiError.sessionExpired();
    }
    throw err;
  }
}
