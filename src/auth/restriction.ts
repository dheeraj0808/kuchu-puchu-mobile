import { ErrorCode, isApiError } from '@/api/errors';
import type { Restriction } from '@/api/types';

const STATUSES = ['suspended', 'banned'] as const;
const REASONS = ['harassment', 'scam', 'fake_profile', 'explicit_content', 'underage', 'threats', 'spam', 'other'] as const;

/** 403 ACCOUNT_RESTRICTED → its details, read defensively; null for any other error. */
export function restrictionFrom(err: unknown): Restriction | null {
  if (!isApiError(err) || err.code !== ErrorCode.AccountRestricted) return null;
  const d = err.details ?? {};
  const status = STATUSES.find((s) => s === d.status) ?? 'suspended';
  const reasonCategory = REASONS.find((r) => r === d.reasonCategory) ?? 'other';
  const endsAt = typeof d.endsAt === 'string' && !Number.isNaN(Date.parse(d.endsAt)) ? d.endsAt : null;
  return { status, reasonCategory, endsAt: status === 'banned' ? null : endsAt, appealAllowed: d.appealAllowed === true };
}
