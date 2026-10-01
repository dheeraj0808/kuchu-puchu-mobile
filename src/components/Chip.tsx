import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, typography, useTheme } from '@/theme';

import { AppText } from './AppText';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Radio (single choice) or checkbox (multi) semantics for screen readers. */
  role?: 'radio' | 'checkbox';
  disabled?: boolean;
}

/** Selectable pill (deck 10–12): pink when selected, white with a grey outline otherwise. */
export function Chip({ label, selected, onPress, role = 'checkbox', disabled }: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      // Deck-size pill (36 px) with a 48 px tap area.
      hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.background,
          borderColor: selected ? colors.primary : colors.borderStrong,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}>
      <AppText style={[typography.body, styles.text]} tone={selected ? 'onPrimary' : 'default'} maxFontSizeMultiplier={1.4}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Wrapping row of chips. */
export function ChipGroup({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  text: { fontFamily: typography.label.fontFamily, fontSize: 15 },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Row gap ≥ 12 keeps the enlarged tap areas of stacked chips from overlapping.
  group: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.xs + 2, rowGap: spacing.sm },
});
