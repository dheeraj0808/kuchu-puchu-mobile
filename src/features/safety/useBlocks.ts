import { useQuery } from '@tanstack/react-query';

import { listBlocks } from '@/api/endpoints/safety';

export const BLOCKS_KEY = ['blocks'] as const;

export function useBlocks() {
  return useQuery({ queryKey: BLOCKS_KEY, queryFn: listBlocks, staleTime: 30_000 });
}

/** "12 Sep" in the user's locale (deck 44). */
export function formatBlockedDate(iso: string, locale = 'en-IN'): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}
