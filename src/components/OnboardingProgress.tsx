import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { spacing, useTheme } from '@/theme';

/** Deck onboarding progress: pink segments for done/current steps, light grey for the rest. */
export function OnboardingProgress({ filled, total }: { filled: number; total: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('onboarding.progress', { step: filled, total })}
      accessibilityValue={{ min: 0, max: total, now: filled }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.segment, { backgroundColor: i < filled ? colors.primary : colors.border }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs - 2 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
});
