import { env } from '@/config/env';

/**
 * Unread conversations for the Matches tab badge. GET /matches (M16) and the
 * message:new socket event arrive in Phase 4 part 2; until then the mock
 * shows the deck's 3 and the real app shows none.
 */
export function useUnreadMatches(): number {
  return env.useAuthMock ? 3 : 0;
}
