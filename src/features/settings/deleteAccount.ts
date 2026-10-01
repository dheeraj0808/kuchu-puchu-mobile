import * as accountApi from '@/api/account';
import { session } from '@/auth/session';

interface Deps {
  remove: () => Promise<unknown>;
  end: (notice: string | null) => Promise<void>;
}

/**
 * Screen 48: DELETE /account (the step-up sheet appears on REAUTH_REQUIRED
 * and the request is repeated), then clears everything on the phone —
 * tokens, React Query cache and Zustand stores — so the gate shows Welcome.
 */
export async function deleteMyAccount(
  deps: Deps = { remove: accountApi.deleteAccount, end: (notice) => session.end(notice) },
): Promise<void> {
  await deps.remove();
  await deps.end(null);
}
