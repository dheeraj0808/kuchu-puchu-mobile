import { getDeviceId } from '@/auth/device';
import { env } from '@/config/env';

import { ApiError } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpOptions {
  method?: HttpMethod;
  body?: unknown;
  accessToken?: string | null;
  timeoutMs?: number;
  signal?: AbortSignal;
  /**
   * Retry transient failures (guide §6). Defaults to true for GET only; pass
   * true for idempotent writes. Never set it on a purchase without its key.
   */
  retry?: boolean;
  /** Extra headers, e.g. Idempotency-Key. */
  headers?: Record<string, string>;
}

export interface PageMeta {
  nextCursor: string | null;
}

export interface HttpResult<T> {
  data: T;
  meta: PageMeta | null;
}

/** Swappable so tests don't wait for real backoff delays. */
export const retryTiming = {
  sleep: (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Request against the backend. Unwraps the `{ success, data, meta }` envelope
 * and converts every failure into an ApiError. Never logs request or response
 * bodies (they may contain tokens, codes or personal data).
 */
export async function httpRequest<T>(path: string, options: HttpOptions = {}): Promise<T> {
  return (await httpRequestWithMeta<T>(path, options)).data;
}

/** Same as httpRequest, but keeps `meta` for cursor-paginated lists. */
export async function httpRequestWithMeta<T>(path: string, options: HttpOptions = {}): Promise<HttpResult<T>> {
  const retry = options.retry ?? (options.method ?? 'GET') === 'GET';
  const attempts = retry ? env.maxRetries + 1 : 1;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await sendOnce<T>(path, options);
    } catch (err) {
      if (attempt + 1 >= attempts || !isTransient(err) || options.signal?.aborted) throw err;
      await retryTiming.sleep(backoffMs(attempt));
    }
  }
}

async function sendOnce<T>(path: string, options: HttpOptions): Promise<HttpResult<T>> {
  const { method = 'GET', body, accessToken, timeoutMs = env.requestTimeoutMs, signal } = options;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = (): void => controller.abort();
  signal?.addEventListener('abort', forwardAbort);

  try {
    const headers = await buildHeaders(options.headers, accessToken, body !== undefined);

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
    return { data: json.data as T, meta: parseMeta(json.meta) };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

async function buildHeaders(
  extra: Record<string, string> | undefined,
  accessToken: string | null | undefined,
  hasBody: boolean,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-App-Version': env.appVersion,
    'X-Device-Id': await getDeviceId(),
    ...extra,
  };
  if (env.platform) headers['X-Platform'] = env.platform;
  if (hasBody) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

/** Network drops, timeouts and gateway/server errors. 4xx and 429 are not retried. */
function isTransient(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.kind === 'network' || err.kind === 'timeout') return true;
  return err.kind === 'http' && err.status !== null && err.status >= 500 && err.status !== 501;
}

/** 500 ms, 1 s … with ±25% jitter so many phones don't retry in lockstep. */
function backoffMs(attempt: number): number {
  const base = env.retryBaseDelayMs * 2 ** attempt;
  return Math.round(base * (0.75 + Math.random() * 0.5));
}

function abortReason(timedOut: boolean, signal: AbortSignal | undefined): ApiError {
  if (timedOut) return ApiError.timeout();
  if (signal?.aborted) return ApiError.aborted();
  return ApiError.network();
}

function isSuccessEnvelope(value: unknown): value is { success: true; data: unknown; meta?: unknown } {
  return (
    typeof value === 'object' && value !== null && (value as { success?: unknown }).success === true && 'data' in value
  );
}

function parseMeta(meta: unknown): PageMeta | null {
  if (typeof meta !== 'object' || meta === null) return null;
  const cursor = (meta as { nextCursor?: unknown }).nextCursor;
  return { nextCursor: typeof cursor === 'string' ? cursor : null };
}
