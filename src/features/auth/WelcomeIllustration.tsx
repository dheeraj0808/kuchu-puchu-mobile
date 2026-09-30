import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { t } from '@/i18n';
import { radius, spacing, useTheme, type ColorPalette } from '@/theme';

/**
 * Deck screen 01 hero: two overlapping avatar circles, a heart where they
 * meet and a "Live verified" pill. The people are simple brand-colour
 * silhouettes; swap `Avatar` for the designer's illustration asset when it
 * is exported (the deck art uses skin tones outside the brand palette).
 */
export function WelcomeIllustration() {
  const { colors } = useTheme();
  return (
    <View style={styles.stage} accessible accessibilityRole="image" accessibilityLabel={t('welcome.illustrationLabel')}>
      <View style={[styles.avatarSlot, styles.first]}>
        <Avatar hair="text" top="primary" longHair />
      </View>
      <View style={[styles.avatarSlot, styles.second]}>
        <Avatar hair="text" top="text" />
      </View>
      <View style={[styles.heart, { backgroundColor: colors.onPrimary }]}>
        <Icon name="heart" size={24} color="primary" />
      </View>
      <View style={[styles.pill, { backgroundColor: colors.onPrimary }]}>
        <Icon name="check-circle" size={18} color="primary" />
        <AppText variant="label" maxFontSizeMultiplier={1.3}>
          {t('welcome.liveVerified')}
        </AppText>
      </View>
    </View>
  );
}

interface AvatarProps {
  hair: keyof ColorPalette;
  top: keyof ColorPalette;
  longHair?: boolean;
}

function Avatar({ hair, top, longHair }: AvatarProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.avatar, { borderColor: colors.onPrimary, backgroundColor: colors.onPrimary }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primaryBorder }]} />
      <View style={[styles.shoulders, { backgroundColor: colors[top] }]} />
      <View style={[longHair ? styles.hairLong : styles.hairShort, { backgroundColor: colors[hair] }]} />
      <View style={[styles.face, { backgroundColor: colors.onPrimary }]} />
    </View>
  );
}

const AVATAR = 148;
const HEART = 48;

const styles = StyleSheet.create({
  stage: { width: AVATAR * 1.75, height: AVATAR * 1.6, alignSelf: 'center' },
  avatarSlot: { position: 'absolute' },
  first: { left: 0, top: 0 },
  second: { left: AVATAR * 0.72, top: AVATAR * 0.52 },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
  },
  shoulders: {
    position: 'absolute',
    bottom: -AVATAR * 0.22,
    width: AVATAR * 0.78,
    height: AVATAR * 0.5,
    borderRadius: AVATAR * 0.4,
  },
  hairLong: {
    position: 'absolute',
    top: AVATAR * 0.12,
    width: AVATAR * 0.46,
    height: AVATAR * 0.6,
    borderTopLeftRadius: AVATAR * 0.23,
    borderTopRightRadius: AVATAR * 0.23,
    borderBottomLeftRadius: AVATAR * 0.06,
    borderBottomRightRadius: AVATAR * 0.06,
  },
  hairShort: {
    position: 'absolute',
    top: AVATAR * 0.13,
    width: AVATAR * 0.38,
    height: AVATAR * 0.34,
    borderRadius: AVATAR * 0.19,
  },
  face: {
    position: 'absolute',
    top: AVATAR * 0.22,
    width: AVATAR * 0.3,
    height: AVATAR * 0.36,
    borderRadius: AVATAR * 0.15,
  },
  heart: {
    position: 'absolute',
    left: AVATAR - HEART * 0.6,
    top: AVATAR * 0.42,
    width: HEART,
    height: HEART,
    borderRadius: HEART / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs + 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radius.pill,
  },
});
