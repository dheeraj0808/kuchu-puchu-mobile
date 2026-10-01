import { StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

/** Segmented photo position at the top of a card (deck 18, 19). */
export function PhotoDots({ count, index }: { count: number; index: number }) {
  const { colors } = useTheme();
  if (count < 2) return null;
  return (
    <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: i === index ? colors.onPhoto : colors.photoDot }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xxs + 1 },
  dot: { flex: 1, height: 3, borderRadius: 2 },
});
