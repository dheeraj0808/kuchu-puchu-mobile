import * as safetyApi from '@/api/endpoints/safety';
import type { ReportCategory } from '@/api/types';

export const REPORT_CATEGORIES: readonly ReportCategory[] = [
  'fake_profile',
  'scam',
  'harassment',
  'explicit_content',
  'underage',
  'threats',
  'other',
];
export const REPORT_DETAILS_MAX = 1000;

export interface ReportInput {
  targetUserId: string;
  category: ReportCategory;
  details: string;
  alsoBlock: boolean;
}

/** What the thank-you step shows. Never contains an outcome — the server doesn't send one. */
export interface ReportOutcome {
  blocked: boolean;
  /** The report went in but the block didn't; offer "Block now". */
  blockFailed: boolean;
}

export function detailsProblem(details: string): 'tooLong' | null {
  return details.length > REPORT_DETAILS_MAX ? 'tooLong' : null;
}

interface Deps {
  report: typeof safetyApi.submitReport;
  block: typeof safetyApi.blockUser;
}

/**
 * Screen 46: POST /reports, then POST /blocks when "Also block" is on
 * (guide §9.5: on by default). A failed report throws; a failed block
 * after a successful report doesn't undo the report.
 */
export async function submitReportFlow(input: ReportInput, deps: Deps = { report: safetyApi.submitReport, block: safetyApi.blockUser }): Promise<ReportOutcome> {
  const details = input.details.trim();
  await deps.report({ targetUserId: input.targetUserId, category: input.category, ...(details ? { details } : {}) });
  if (!input.alsoBlock) return { blocked: false, blockFailed: false };
  try {
    await deps.block(input.targetUserId);
    return { blocked: true, blockFailed: false };
  } catch {
    return { blocked: false, blockFailed: true };
  }
}
