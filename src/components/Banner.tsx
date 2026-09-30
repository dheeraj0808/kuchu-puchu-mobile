import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, typography, useTheme } from '@/theme';

import { AppText } from './AppText';

/** Guide §5.3: info (soft pink) and error. */
type Tone = 'error' | 'info';

interface BannerProps {
  tone?: Tone;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function Banner({ tone = 'error', message, actionLabel, onAction }: BannerProps) {
  const { colors } = useTheme();
  const isError = tone === 'error';
  const accent = isError ? colors.danger : colors.primary;

  return (
    <View
      role={isError ? 'alert' : 'status'}
      accessibilityLiveRegion="polite"
      style={[styles.container, { backgroundColor: isError ? colors.dangerSoft : colors.primarySoft, borderLeftColor: accent }]}>
      <AppText variant="label" style={styles.message}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} hitSlop={12}>
          <AppText style={[typography.label, { color: accent, textDecorationLine: 'underline' }]}>{actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'stretch',
  },
  message: { flex: 1 },
});
