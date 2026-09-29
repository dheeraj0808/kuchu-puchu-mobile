import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

type Tone = 'error' | 'info' | 'success';

interface BannerProps {
  tone?: Tone;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function Banner({ tone = 'error', message, actionLabel, onAction }: BannerProps) {
  const { colors } = useTheme();
  const palette = {
    error: { bg: colors.dangerSoft, fg: colors.danger },
    info: { bg: colors.infoSoft, fg: colors.info },
    success: { bg: colors.successSoft, fg: colors.success },
  }[tone];

  return (
    <View
      role={tone === 'error' ? 'alert' : 'status'}
      accessibilityLiveRegion="polite"
      style={[styles.container, { backgroundColor: palette.bg }]}>
      <View style={[styles.dot, { backgroundColor: palette.fg }]} />
      <AppText variant="caption" style={[styles.message, { color: palette.fg }]}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8} style={styles.action}>
          <AppText variant="label" style={{ color: palette.fg, textDecorationLine: 'underline' }}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'stretch',
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: spacing.sm },
  message: { flex: 1, fontWeight: '500' },
  action: { marginLeft: spacing.sm },
});
