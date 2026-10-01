import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { ProfilePhoto } from '@/api/types';
import { useTheme, type ColorPalette } from '@/theme';

interface Props {
  photo: ProfilePhoto;
  size: 'thumb' | 'medium' | 'large';
}

/**
 * A profile photo. Real photos go through expo-image cached by
 * photoId + size (signed URLs change hourly, guide §10.4). `mock://` photos
 * are drawn from brand-colour shapes until the backend serves real ones.
 */
export function ProfilePhotoView({ photo, size }: Props) {
  const uri = photo.urls[size];
  if (uri.startsWith('mock://')) return <MockPerson seed={uri} />;
  return (
    <Image
      source={{ uri, cacheKey: `${photo.id}-${size}` }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      transition={150}
      accessible={false}
    />
  );
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

const TOPS: (keyof ColorPalette)[] = ['text', 'primary', 'text'];

function MockPerson({ seed }: { seed: string }) {
  const { colors } = useTheme();
  const h = hash(seed);
  const longHair = h % 2 === 0;
  const top = TOPS[h % TOPS.length]!;
  const shift = ((h >> 3) % 3) - 1; // slight pose change between photos
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.onPhoto }]} importantForAccessibility="no-hide-descendants">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primaryBorder }]} />
      <View style={[styles.bubble, { backgroundColor: colors.illustrationBubble }]} />
      <View style={[styles.person, { transform: [{ translateX: shift * 14 }] }]}>
        {longHair ? <View style={[styles.hairLong, { backgroundColor: colors.text }]} /> : null}
        <View style={[styles.body, { backgroundColor: colors[top] }]} />
        <View style={[styles.neck, styles.skin, { backgroundColor: colors.onPhoto }]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.illustrationSkin }]} />
        </View>
        <View style={[styles.face, styles.skin, { backgroundColor: colors.onPhoto }]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.illustrationSkin }]} />
        </View>
        <View style={[longHair ? styles.fringe : styles.hairShort, { backgroundColor: colors.text }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { position: 'absolute', top: '8%', right: '6%', width: '26%', aspectRatio: 1, borderRadius: 999 },
  person: { ...StyleSheet.absoluteFill, alignItems: "center" },
  hairLong: { position: 'absolute', top: '10%', width: '50%', height: '58%', borderTopLeftRadius: 999, borderTopRightRadius: 999 },
  body: { position: 'absolute', bottom: '-6%', width: '80%', height: '44%', borderTopLeftRadius: 999, borderTopRightRadius: 999 },
  skin: { overflow: 'hidden' },
  neck: { position: 'absolute', top: '36%', width: '11%', height: '12%', borderRadius: 12 },
  face: { position: 'absolute', top: '18%', width: '30%', aspectRatio: 0.82, borderRadius: 999 },
  fringe: { position: 'absolute', top: '10%', width: '42%', height: '11%', borderTopLeftRadius: 999, borderTopRightRadius: 999 },
  hairShort: { position: 'absolute', top: '11%', width: '40%', height: '14%', borderTopLeftRadius: 999, borderTopRightRadius: 999 },
});
