import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

/**
 * Deck 15 illustration: soft pink disc, dashed ring, pink pin in the centre
 * and small people around it. The avatars are brand-colour placeholders
 * until the designer's artwork is exported.
 */
export function LocationIllustration() {
  const { colors } = useTheme();
  return (
    <View style={styles.stage} accessible accessibilityRole="image" accessibilityLabel={t('location.illustration')}>
      <View style={[styles.disc, { backgroundColor: colors.surface }]} />
      <View style={[styles.ring, { borderColor: colors.primaryBorder }]} />
      <View style={[styles.pin, { backgroundColor: colors.primary }]}>
        <Icon name="map-marker-outline" size={44} color="onPrimary" />
      </View>
      <PlaceholderAvatar style={styles.avatarA} size={52} top="text" />
      <PlaceholderAvatar style={styles.avatarB} size={48} top="primary" />
      <PlaceholderAvatar style={styles.avatarC} size={44} top="text" />
    </View>
  );
}

/** Brand-colour person placeholder (until designer artwork), also used on screen 16. */
export function PlaceholderAvatar({ style, size, top }: { style?: object; size: number; top: 'text' | 'primary' }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.avatar, style ?? styles.inline, { width: size, height: size, borderRadius: size / 2, borderColor: colors.background, backgroundColor: colors.onPrimary }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primaryBorder }]} />
      <View style={[styles.shoulders, { width: size * 0.7, height: size * 0.4, borderRadius: size * 0.35, bottom: -size * 0.16, backgroundColor: colors[top] }]} />
      <View style={[styles.head, { width: size * 0.34, height: size * 0.38, borderRadius: size * 0.17, top: size * 0.22, backgroundColor: colors.onPrimary }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.illustrationSkin }]} />
      </View>
      <View style={[styles.hair, { width: size * 0.38, height: size * 0.18, borderTopLeftRadius: size * 0.19, borderTopRightRadius: size * 0.19, top: size * 0.17, backgroundColor: colors.text }]} />
    </View>
  );
}

const DISC = 280;
const RING = 190;
const PIN = 92;

const styles = StyleSheet.create({
  stage: { width: DISC, height: DISC, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  disc: { position: 'absolute', width: DISC, height: DISC, borderRadius: DISC / 2 },
  ring: { position: 'absolute', width: RING, height: RING, borderRadius: RING / 2, borderWidth: 2, borderStyle: 'dashed' },
  pin: { width: PIN, height: PIN, borderRadius: PIN / 2, alignItems: 'center', justifyContent: 'center' },
  avatar: { position: 'absolute', borderWidth: 3, overflow: 'hidden', alignItems: 'center' },
  inline: { position: 'relative' },
  avatarA: { left: -6, top: 40 },
  avatarB: { right: -8, top: 160 },
  avatarC: { left: 30, bottom: 30 },
  shoulders: { position: 'absolute' },
  head: { position: 'absolute', overflow: 'hidden' },
  hair: { position: 'absolute' },
});
