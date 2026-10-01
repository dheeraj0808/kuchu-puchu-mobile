import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { PhotoUpload } from '@/api/types';

import { JPEG_QUALITY, resizeFor } from './photoRules';

export interface PickedAsset {
  uri: string;
  width: number;
  height: number;
  fileName?: string | null;
}

interface Manipulate {
  (uri: string, resize: { width: number } | { height: number } | null): Promise<{ uri: string; width: number; height: number }>;
}

const nativeManipulate: Manipulate = async (uri, resize) => {
  const context = ImageManipulator.manipulate(uri);
  if (resize) context.resize(resize);
  const image = await context.renderAsync();
  // Always re-encode: HEIC (iPhone, some Androids) → JPEG, quality 0.85, metadata dropped.
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return { uri: saved.uri, width: saved.width, height: saved.height };
};

/**
 * Guide §10.4: HEIC → JPEG, longest edge ≤ 2048 px, quality 0.85.
 * Re-encoding also strips EXIF (including GPS) before the photo leaves the phone.
 */
export async function preparePhoto(asset: PickedAsset, manipulate: Manipulate = nativeManipulate): Promise<PhotoUpload> {
  const out = await manipulate(asset.uri, resizeFor(asset.width, asset.height));
  const base = (asset.fileName ?? 'photo').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'photo';
  return { uri: out.uri, name: `${base}.jpg`, type: 'image/jpeg', width: out.width, height: out.height, size: null };
}
