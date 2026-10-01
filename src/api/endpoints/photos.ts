import { env } from '@/config/env';

import { authedRequest } from '../client';
import { mockVerification } from '../mocks/verification';
import type { MessageResponse, Photo, PhotoUpload } from '../types';
import { uploadMultipart, type UploadOptions } from '../upload';

/** Profile photos (guide M12), relative to /api/v1. */
export const PHOTO_ENDPOINTS = {
  photos: '/profile/photos',
  order: '/profile/photos/order',
  photo: (id: string) => `/profile/photos/${encodeURIComponent(id)}`,
} as const;

const mock = env.useAuthMock ? mockVerification : null;

export function listPhotos(): Promise<Photo[]> {
  if (mock) return mock.listPhotos();
  return authedRequest<Photo[]>(PHOTO_ENDPOINTS.photos);
}

/** 400 PHOTO_INVALID_FILE · 409 PHOTO_LIMIT_REACHED · 422 PHOTO_FACE_MISMATCH (main photo). */
export function uploadPhoto(file: PhotoUpload, options: UploadOptions = {}): Promise<Photo> {
  if (mock) return mock.uploadPhoto(file, options.onProgress, options.signal);
  const form = new FormData();
  // React Native's FormData accepts { uri, name, type } file parts.
  form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  return uploadMultipart<Photo>(PHOTO_ENDPOINTS.photos, form, options);
}

/** The first id becomes the main photo (422 PHOTO_FACE_MISMATCH if it doesn't show the verified face). */
export function reorderPhotos(ids: string[]): Promise<Photo[]> {
  if (mock) return mock.reorderPhotos(ids);
  return authedRequest<Photo[]>(PHOTO_ENDPOINTS.order, { method: 'PUT', body: { ids }, retry: true });
}

export function deletePhoto(id: string): Promise<MessageResponse> {
  if (mock) return mock.deletePhoto(id);
  return authedRequest<MessageResponse>(PHOTO_ENDPOINTS.photo(id), { method: 'DELETE', retry: true });
}
