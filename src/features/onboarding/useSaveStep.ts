import { useMutation } from '@tanstack/react-query';

import { ErrorCode, isApiError } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';

/**
 * Saves a step, then reloads /auth/me. The onboarding layout reads the new
 * progress and moves to the next screen, so the server stays the source of truth.
 */
export function useSaveStep<T>(save: (value: T) => Promise<unknown>) {
  const { reloadUser } = useAuth();
  return useMutation({
    mutationFn: async (value: T) => {
      await save(value);
      await reloadUser();
    },
  });
}

/** CONTACT_DETAILS_NOT_ALLOWED → the field to highlight (details.field), else null. */
export function contactDetailsField(err: unknown): string | null {
  if (!isApiError(err) || err.code !== ErrorCode.ContactDetailsNotAllowed) return null;
  const field = err.details?.field;
  return typeof field === 'string' ? field : 'unknown';
}
