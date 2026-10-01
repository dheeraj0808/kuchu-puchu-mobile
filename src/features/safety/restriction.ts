import type { Restriction } from '@/api/types';
import { t } from '@/i18n';

/** "12 Oct 2026" in the user's locale. */
export function formatEndDate(iso: string, locale = 'en-IN'): string {
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Title and sentence for screen 49 from the 403 details. */
export function describeRestriction(r: Restriction, locale = 'en-IN'): { title: string; body: string } {
  const reason = t(`restrictionReasons.${r.reasonCategory}`);
  if (r.status === 'banned') return { title: t('restricted.bannedTitle'), body: t('restricted.bannedBody', { reason }) };
  return {
    title: t('restricted.suspendedTitle'),
    body: r.endsAt ? t('restricted.suspendedBody', { reason, date: formatEndDate(r.endsAt, locale) }) : t('restricted.suspendedNoDate', { reason }),
  };
}
