import * as authApi from '@/api/auth';
import { ApiError, ErrorCode, isApiError } from '@/api/errors';
import type { AuthTokens, User } from '@/api/types';

import { tokenStorage } from './tokenStorage';

/**
 * Owns the authenticated session outside React.
 *
 * - Access token: memory only.
 * - Refresh token: memory + secure storage (see tokenStorage).
 * - Refreshes are single-flight. This is required, not an optimisation: the
 *   backend rotates refresh tokens and treats a replayed (rotated-out) token
 *   as theft, revoking the session.
 */

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface SessionSnapshot {
  status: SessionStatus;
  user: User | null;
  /** Set when a stored session could not be verified (e.g. offline at launch). */
  restoreError: ApiError | null;
  /** User-facing reason the last session ended (expired, restricted…). */
  notice: string | null;
}

/** Refresh slightly before the access token actually expires. */
const EXPIRY_SKEW_MS = 30_000;

const SESSION_ENDED_NOTICE = 'Your session has ended. Please sign in again.';

type Listener = () => void;

export class SessionManager {
  private snapshot: SessionSnapshot = { status: 'loading', user: null, restoreError: null, notice: null };
  private readonly listeners = new Set<Listener>();

  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private refreshToken: string | null = null;

  private refreshPromise: Promise<string | null> | null = null;
  private restorePromise: Promise<void> | null = null;
  /** Bumped whenever the session ends; stale in-flight refreshes are discarded. */
  private generation = 0;

  constructor(
    private readonly api: Pick<typeof authApi, 'refreshSession' | 'logout'> = authApi,
    private readonly storage: typeof tokenStorage = tokenStorage,
    private readonly now: () => number = Date.now,
  ) {}

  getSnapshot = (): SessionSnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Resolves the stored session at launch. Safe to call repeatedly. */
  restore(): Promise<void> {
    if (this.snapshot.status === 'authenticated' || this.snapshot.status === 'unauthenticated') {
      return Promise.resolve();
    }
    this.restorePromise ??= this.runRestore().finally(() => {
      this.restorePromise = null;
    });
    return this.restorePromise;
  }

  /** Called after successful OTP verification. */
  async signIn(tokens: AuthTokens): Promise<void> {
    this.generation += 1;
    await this.applyTokens(tokens);
  }

  /** Returns a usable access token, refreshing if it is missing or about to expire. */
  async getAccessToken(): Promise<string | null> {
    if (this.accessToken && this.now() < this.accessTokenExpiresAt - EXPIRY_SKEW_MS) {
      return this.accessToken;
    }
    return this.refreshAccessToken();
  }

  /**
   * Called when a request was rejected with 401. If another request already
   * refreshed past the failed token, reuse the new one instead of rotating again.
   */
  async recoverFromUnauthorized(failedToken: string): Promise<string | null> {
    if (this.accessToken && this.accessToken !== failedToken && this.now() < this.accessTokenExpiresAt - EXPIRY_SKEW_MS) {
      return this.accessToken;
    }
    return this.refreshAccessToken();
  }

  /**
   * Single-flight refresh. Resolves to the new access token, or null when the
   * session can no longer be refreshed (the session is then ended).
   * Rejects with a network/timeout ApiError when the server is unreachable —
   * the session is kept so the user is not logged out for being offline.
   */
  refreshAccessToken(): Promise<string | null> {
    this.refreshPromise ??= this.performRefresh().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  updateUser(user: User): void {
    if (this.snapshot.status !== 'authenticated') return;
    this.setSnapshot({ user });
  }

  clearNotice(): void {
    if (this.snapshot.notice) this.setSnapshot({ notice: null });
  }

  /** Revokes this device's session server-side (best effort) and clears it locally. */
  async signOut(): Promise<void> {
    if (this.refreshPromise) await this.refreshPromise.catch(() => null);
    const token = this.refreshToken ?? (await this.storage.getRefreshToken());
    if (token) {
      try {
        await this.api.logout(token);
      } catch {
        // Offline or server error: the local session is still cleared. The
        // server session expires on its own and cannot be used without the token.
      }
    }
    await this.end(null);
  }

  /** Clears the local session without contacting the server. */
  async end(notice: string | null = SESSION_ENDED_NOTICE): Promise<void> {
    this.generation += 1;
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
    this.refreshToken = null;
    await this.storage.clearRefreshToken();
    this.setSnapshot({ status: 'unauthenticated', user: null, restoreError: null, notice });
  }

  private async runRestore(): Promise<void> {
    try {
      await this.refreshAccessToken();
    } catch (err) {
      this.setSnapshot({
        status: 'error',
        restoreError: isApiError(err) ? err : ApiError.network(),
      });
    }
  }

  private async performRefresh(): Promise<string | null> {
    const generation = this.generation;
    const wasAuthenticated = this.snapshot.status === 'authenticated';
    const stored = this.refreshToken ?? (await this.storage.getRefreshToken());

    if (!stored) {
      if (generation === this.generation) await this.end(wasAuthenticated ? SESSION_ENDED_NOTICE : null);
      return null;
    }

    let tokens: AuthTokens;
    try {
      tokens = await this.api.refreshSession(stored);
    } catch (err) {
      if (isSessionRejection(err)) {
        if (generation === this.generation) await this.end(sessionEndedNotice(err));
        return null;
      }
      throw err;
    }

    if (generation !== this.generation) {
      // Signed out while the refresh was in flight: revoke the newly issued session.
      void this.api.logout(tokens.refreshToken).catch(() => undefined);
      return null;
    }

    await this.applyTokens(tokens);
    return tokens.accessToken;
  }

  private async applyTokens(tokens: AuthTokens): Promise<void> {
    this.accessToken = tokens.accessToken;
    this.accessTokenExpiresAt = this.now() + tokens.accessTokenExpiresIn * 1000;
    this.refreshToken = tokens.refreshToken;
    await this.storage.setRefreshToken(tokens.refreshToken);
    this.setSnapshot({ status: 'authenticated', user: tokens.user, restoreError: null, notice: null });
  }

  private setSnapshot(partial: Partial<SessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    this.listeners.forEach((listener) => listener());
  }
}

/** The server definitively refused the refresh token (vs. being unreachable). */
function isSessionRejection(err: unknown): err is ApiError {
  return isApiError(err) && err.kind === 'http' && (err.status === 400 || err.status === 401 || err.status === 403);
}

function sessionEndedNotice(err: ApiError): string {
  return err.code === ErrorCode.AccountRestricted ? err.message : SESSION_ENDED_NOTICE;
}

export const session = new SessionManager();
