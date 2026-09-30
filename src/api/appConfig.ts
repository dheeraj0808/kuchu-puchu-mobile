import { env } from '@/config/env';
import { isBelowVersion } from '@/lib/version';

import { ApiError, ErrorCode, isApiError } from './errors';
import { httpRequest } from './http';

/**
 * GET /app/config (public). The backend does not serve this route yet, so
 * the shape below is the app's contract proposal and every field is read
 * defensively:
 *
 *   { minVersion: "1.2.0", latestVersion?: "1.4.0", storeUrl?: "https://…",
 *     maintenance?: { enabled: true, endsAt?: "2026-10-01T10:30:00Z" } }
 */
export interface AppConfig {
  minVersion: string | null;
  latestVersion: string | null;
  storeUrl: string | null;
  maintenance: { enabled: boolean; endsAt: string | null };
}

export type LaunchState =
  | { kind: 'ready'; config: AppConfig }
  | { kind: 'updateRequired'; config: AppConfig }
  | { kind: 'maintenance'; config: AppConfig | null };

const NO_RESTRICTIONS: AppConfig = {
  minVersion: null,
  latestVersion: null,
  storeUrl: null,
  maintenance: { enabled: false, endsAt: null },
};

/**
 * Decides whether the app may start. Throws ApiError for network and
 * unexpected server failures so the caller can show Offline / error screens.
 */
export async function fetchLaunchState(appVersion: string = env.appVersion): Promise<LaunchState> {
  let raw: unknown;
  try {
    raw = await httpRequest<unknown>('/app/config');
  } catch (err) {
    if (isApiError(err) && err.kind === 'http') {
      // A 503 from the API (or the load balancer in front of it) is planned downtime.
      if (err.status === 503 && err.code !== ErrorCode.OtpDeliveryFailed) return { kind: 'maintenance', config: null };
      // Route not deployed yet: start without restrictions rather than lock everyone out.
      if (err.status === 404) return { kind: 'ready', config: NO_RESTRICTIONS };
    }
    throw err;
  }

  const config = parseAppConfig(raw);
  if (config.maintenance.enabled) return { kind: 'maintenance', config };
  if (config.minVersion && isBelowVersion(appVersion, config.minVersion)) return { kind: 'updateRequired', config };
  return { kind: 'ready', config };
}

export function parseAppConfig(raw: unknown): AppConfig {
  if (typeof raw !== 'object' || raw === null) throw ApiError.invalidResponse(200);
  const data = raw as Record<string, unknown>;
  const maintenance = typeof data.maintenance === 'object' && data.maintenance !== null
    ? (data.maintenance as Record<string, unknown>)
    : {};
  return {
    minVersion: versionOrNull(data.minVersion),
    latestVersion: versionOrNull(data.latestVersion),
    storeUrl: httpsUrlOrNull(data.storeUrl),
    maintenance: {
      enabled: maintenance.enabled === true,
      endsAt: typeof maintenance.endsAt === 'string' ? maintenance.endsAt : null,
    },
  };
}

function versionOrNull(value: unknown): string | null {
  return typeof value === 'string' && /^\d+(\.\d+){0,3}/.test(value.trim()) ? value.trim() : null;
}

/** Only store links over HTTPS are opened; anything else falls back to the built-in link. */
function httpsUrlOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.startsWith('https://') ? value : null;
}
