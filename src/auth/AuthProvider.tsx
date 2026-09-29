import { createContext, use, useCallback, useEffect, useMemo, useSyncExternalStore, type PropsWithChildren } from 'react';

import * as accountApi from '@/api/account';
import type { AuthTokens, User } from '@/api/types';
import { resetOtpFlow } from '@/features/auth/otpFlow';

import { session, type SessionSnapshot } from './session';

interface AuthContextValue extends SessionSnapshot {
  signIn: (tokens: AuthTokens) => Promise<void>;
  signOut: () => Promise<void>;
  signOutEverywhere: () => Promise<void>;
  reloadUser: () => Promise<User>;
  retryRestore: () => Promise<void>;
  /** Drops a stored session that could not be verified, without contacting the server. */
  discardSession: () => Promise<void>;
  clearNotice: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be used within <AuthProvider>');
  return value;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);

  useEffect(() => {
    void session.restore();
  }, []);

  const signIn = useCallback(async (tokens: AuthTokens) => {
    await session.signIn(tokens);
    resetOtpFlow();
  }, []);

  const signOut = useCallback(async () => {
    await session.signOut();
    resetOtpFlow();
  }, []);

  const signOutEverywhere = useCallback(async () => {
    await accountApi.logoutAllDevices();
    await session.end(null);
    resetOtpFlow();
  }, []);

  const reloadUser = useCallback(async () => {
    const user = await accountApi.getCurrentUser();
    session.updateUser(user);
    return user;
  }, []);

  const retryRestore = useCallback(() => session.restore(), []);
  const discardSession = useCallback(() => session.end(null), []);
  const clearNotice = useCallback(() => session.clearNotice(), []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...snapshot, signIn, signOut, signOutEverywhere, reloadUser, retryRestore, discardSession, clearNotice }),
    [snapshot, signIn, signOut, signOutEverywhere, reloadUser, retryRestore, discardSession, clearNotice],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
