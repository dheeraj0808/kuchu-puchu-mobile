import type { ComponentProps } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

interface StatusScreenProps {
  icon: IconName;
  title: string;
  message: string;
  action: Pick<ComponentProps<typeof Button>, 'label' | 'icon' | 'variant' | 'onPress' | 'loading' | 'loadingLabel'>;
  /** Small line under the button, e.g. "Error code: NET-7F3A". */
  caption?: string;
}

/**
 * Full-screen system message (deck screens 04, 05, 50): an icon in a soft
 * double circle, a title, a message and one action pinned to the bottom.
 * Scrolls instead of clipping when the system font is scaled up.
 */
export function StatusScreen({ icon, title, message, action, caption }: StatusScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.body}>
          <View style={[styles.halo, { backgroundColor: colors.primarySoft }]}>
            <View style={[styles.ring, { borderColor: colors.primaryBorder, backgroundColor: colors.background }]}>
              <Icon name={icon} size={30} color="primary" />
            </View>
          </View>
          <View style={styles.copy} accessible accessibilityLiveRegion="polite">
            <AppText variant="display" align="center">
              {title}
            </AppText>
            <AppText tone="muted" align="center">
              {message}
            </AppText>
          </View>
        </View>
        <View style={styles.footer}>
          <Button {...action} />
          {caption ? (
            <AppText variant="caption" tone="subtle" align="center" selectable>
              {caption}
            </AppText>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const HALO = 136;
const RING = 88;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.formMaxWidth,
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.xl },
  halo: { width: HALO, height: HALO, borderRadius: HALO / 2, alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { gap: spacing.xs, paddingHorizontal: spacing.md },
  footer: { gap: spacing.sm },
});
