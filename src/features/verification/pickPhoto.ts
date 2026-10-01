import * as ImagePicker from 'expo-image-picker';

import type { PickedAsset } from './preparePhoto';

export type PickResult = { kind: 'picked'; asset: PickedAsset & { mimeType?: string | null; fileSize?: number | null } } | { kind: 'cancelled' } | { kind: 'cameraDenied' };

const OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false, exif: false };

/**
 * Gallery uses the system photo picker (no storage permission on Android 13+,
 * guide §12.1). The camera asks for permission only when chosen.
 */
export async function pickPhoto(source: 'camera' | 'gallery'): Promise<PickResult> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { kind: 'cameraDenied' };
  }
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(OPTIONS) : await ImagePicker.launchImageLibraryAsync(OPTIONS);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return { kind: 'cancelled' };
  return {
    kind: 'picked',
    asset: { uri: asset.uri, width: asset.width, height: asset.height, fileName: asset.fileName, mimeType: asset.mimeType, fileSize: asset.fileSize },
  };
}
