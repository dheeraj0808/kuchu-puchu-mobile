import { env } from '@/config/env';

import { ApiError } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpOptions {
  method?: HttpMethod;
  body?: unknown;
  accessToken?: string | null;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Low-level request against the backend. Unwraps the `{ success, data }`
 * envelope and converts every failure into an ApiError.
 * Never logs request/response bodies (they may contain tokens or codes).
 */
export async function httpRequest<T>(path: string, options: HttpOptions = {}): Promise<T> {
  const { method = 'GET', body, accessToken, timeoutMs = env.requestTimeoutMs, signal } = options;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = (): void => controller.abort();
  signal?.addEventListener('abort', forwardAbort);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  try {
    let response: Response;
    try {
      response = await fetch(`${env.apiUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw abortReason(timedOut, signal);
    }

    let json: unknown = null;
    try {
      const text = await response.text();
      json = text ? JSON.parse(text) : null;
    } catch {
      if (timedOut || signal?.aborted) throw abortReason(timedOut, signal);
      json = null;
    }

    if (!response.ok) {
      throw ApiError.fromResponse(response.status, json, response.headers.get('retry-after'));
    }
    if (!isSuccessEnvelope(json)) {
      throw ApiError.invalidResponse(response.status);
    }
    return json.data as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

function abortReason(timedOut: boolean, signal: AbortSignal | undefined): ApiError {
  if (timedOut) return ApiError.timeout();
  if (signal?.aborted) return ApiError.aborted();
  return ApiError.network();
}

function isSuccessEnvelope(value: unknown): value is { success: true; data: unknown } {
  return typeof value === 'object' && value !== null && (value as { success?: unknown }).success === true && 'data' in value;
}
