import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, typography, useTheme } from '@/theme';

import { AppText } from './AppText';

interface RadioRowProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

/** Bordered single-choice row (deck 46): selected → pink border, pink-shade fill, pink radio. */
export function RadioRow({ label, selected, onPress }: RadioRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.surface : colors.background,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <AppText style={[typography.body, styles.label]}>{label}</AppText>
      <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.borderStrong, backgroundColor: selected ? colors.primary : 'transparent' }]}>
        {selected ? <View style={[styles.dot, { backgroundColor: colors.onPrimary }]} /> : null}
      </View>
    </Pressable>
  );
}

const RADIO = 24;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radius.md,
  },
  label: { flex: 1, fontFamily: typography.label.fontFamily },
  radio: { width: RADIO, height: RADIO, borderRadius: RADIO / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
