import { createContext, use, useCallback, useEffect, useMemo, useSyncExternalStore, type PropsWithChildren } from 'react';

import * as accountApi from '@/api/account';
import type { AuthTokens, Me } from '@/api/types';
import { resetOtpFlow } from '@/features/auth/otpFlow';

import { session, type SessionSnapshot } from './session';

interface AuthContextValue extends SessionSnapshot {
  signIn: (tokens: AuthTokens) => Promise<void>;
  signOut: () => Promise<void>;
  reloadUser: () => Promise<Me>;
  retryRestore: () => Promise<void>;
  clearNotice: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be used within <AuthProvider>');
  return value;
}

/** React view of the SessionManager. All session logic lives in session.ts. */
export function AuthProvider({ children }: PropsWithChildren) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);

  useEffect(() => {
    void session.restore();
  }, []);

  const signIn = useCallback(async (tokens: AuthTokens) => {
    await session.signIn(tokens);
    // The phone number or email typed during sign-in is no longer needed.
    resetOtpFlow();
  }, []);
  const signOut = useCallback(() => session.signOut(), []);
  const retryRestore = useCallback(() => session.restore(), []);
  const clearNotice = useCallback(() => session.clearNotice(), []);
  const reloadUser = useCallback(async () => {
    const me = await accountApi.getMe();
    session.updateUser(me);
    return me;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...snapshot, signIn, signOut, reloadUser, retryRestore, clearNotice }),
    [snapshot, signIn, signOut, reloadUser, retryRestore, clearNotice],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
