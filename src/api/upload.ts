import { getDeviceId } from '@/auth/device';
import { session } from '@/auth/session';
import { env } from '@/config/env';

import { ApiError } from './errors';

export interface UploadOptions {
  /** 0–1 as bytes are sent. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

type Send = (token: string) => Promise<{ status: number; body: unknown; retryAfter: string | null }>;

/**
 * Multipart upload with progress, cancel and a 60 s timeout (guide §6, §10.4).
 * fetch() can't report upload progress, so this uses XMLHttpRequest. Same
 * envelope and error handling as http.ts; one refresh-and-retry on 401.
 * Never logs the file, its URI or the response.
 */
export async function uploadMultipart<T>(path: string, form: FormData, options: UploadOptions = {}): Promise<T> {
  const deviceId = await getDeviceId();
  const send: Send = (token) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${env.apiUrl}${path}`);
      xhr.timeout = options.timeoutMs ?? env.uploadTimeoutMs;
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('X-App-Version', env.appVersion);
      xhr.setRequestHeader('X-Device-Id', deviceId);
      if (env.platform) xhr.setRequestHeader('X-Platform', env.platform);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) options.onProgress?.(e.loaded / e.total);
      };
      xhr.onload = () => {
        let body: unknown = null;
        try {
          body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          body = null;
        }
        resolve({ status: xhr.status, body, retryAfter: xhr.getResponseHeader('retry-after') });
      };
      xhr.onerror = () => reject(ApiError.network());
      xhr.ontimeout = () => reject(ApiError.timeout());
      xhr.onabort = () => reject(ApiError.aborted());
      options.signal?.addEventListener('abort', () => xhr.abort());
      if (options.signal?.aborted) {
        xhr.abort();
        return;
      }
      xhr.send(form);
    });

  const token = await session.getAccessToken();
  if (!token) throw ApiError.sessionExpired();
  let res = await send(token);
  if (res.status === 401) {
    const recovered = await session.recoverFromUnauthorized(token);
    if (!recovered) throw ApiError.sessionExpired();
    res = await send(recovered);
  }
  if (res.status < 200 || res.status >= 300) {
    const err = ApiError.fromResponse(res.status, res.body, res.retryAfter);
    session.reportRestriction(err); // 403 ACCOUNT_RESTRICTED → screen 49
    throw err;
  }
  const envelope = res.body as { success?: unknown; data?: unknown } | null;
  if (!envelope || envelope.success !== true || !('data' in envelope)) throw ApiError.invalidResponse(res.status);
  return envelope.data as T;
}
