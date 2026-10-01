import type { Photo } from '@/api/types';

/**
 * Photo rules (guide §9.2 screen 7, §10.4). Kept in one place so the
 * product can change them without touching screens.
 */
export const PHOTO_SLOTS = 6;
/** Guide: "minimum 4 approved". */
export const MIN_APPROVED_PHOTOS = 4;
export const MAX_EDGE_PX = 2048;
export const JPEG_QUALITY = 0.85;
export const MIN_SIDE_PX = 400;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function approvedCount(photos: readonly Photo[]): number {
  return photos.filter((p) => p.status === 'approved').length;
}

/** The only place that decides whether screen 9 may continue. */
export function canContinuePhotos(photos: readonly Photo[]): boolean {
  return approvedCount(photos) >= MIN_APPROVED_PHOTOS;
}

export interface PhotoSummary {
  approved: number;
  inReview: number;
  rejected: number;
  needed: number;
}

export function summarizePhotos(photos: readonly Photo[]): PhotoSummary {
  return {
    approved: approvedCount(photos),
    inReview: photos.filter((p) => p.status === 'review').length,
    rejected: photos.filter((p) => p.status === 'rejected').length,
    needed: MIN_APPROVED_PHOTOS,
  };
}

/** Moves the item at `from` to `to` (first = main photo). Out-of-range moves are clamped. */
export function movePhoto<T>(items: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return [...items];
  const target = Math.max(0, Math.min(items.length - 1, to));
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved!);
  return next;
}

/** Longest edge to 2048 px, never upscaled. Returns the resize to apply, or null when none is needed. */
export function resizeFor(width: number, height: number, maxEdge: number = MAX_EDGE_PX): { width: number } | { height: number } | null {
  if (width <= maxEdge && height <= maxEdge) return null;
  return width >= height ? { width: maxEdge } : { height: maxEdge };
}

/** What the app can check before uploading; the server re-checks everything. */
export function localFileProblem(asset: { width: number; height: number; mimeType?: string | null; fileSize?: number | null }): 'tooSmall' | 'tooLarge' | 'type' | null {
  if (asset.width < MIN_SIDE_PX || asset.height < MIN_SIDE_PX) return 'tooSmall';
  if (asset.fileSize && asset.fileSize > MAX_FILE_BYTES * 3) return 'tooLarge'; // re-encoding shrinks most phone photos below 10 MB
  if (asset.mimeType && !/^image\/(jpe?g|png|webp|heic|heif)$/i.test(asset.mimeType)) return 'type';
  return null;
}
