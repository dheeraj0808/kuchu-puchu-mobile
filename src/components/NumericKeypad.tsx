import { Pressable, StyleSheet, View } from 'react-native';

import type { KeypadKey } from '@/features/auth/otpCode';
import { t } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

const ROWS: (KeypadKey | null)[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [null, '0', 'backspace'],
];

interface NumericKeypadProps {
  onKey: (key: KeypadKey) => void;
  disabled?: boolean;
}

/** Deck 03 keypad: 1–9, 0 and backspace on a pink-shade panel. */
export function NumericKeypad({ onKey, disabled }: NumericKeypadProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface }]}>
      {ROWS.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((key, c) =>
            key === null ? (
              <View key={`blank-${c}`} style={styles.key} />
            ) : (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={key === 'backspace' ? t('verify.keyDelete') : key}
                accessibilityState={{ disabled: !!disabled }}
                disabled={disabled}
                onPress={() => onKey(key)}
                style={({ pressed }) => [
                  styles.key,
                  key !== 'backspace' && { backgroundColor: colors.background },
                  { opacity: disabled ? 0.5 : pressed ? 0.6 : 1 },
                ]}>
                {key === 'backspace' ? (
                  <Icon name="chevron-left" size={26} />
                ) : (
                  <AppText style={typography.keypad} maxFontSizeMultiplier={1.3}>
                    {key}
                  </AppText>
                )}
              </Pressable>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { paddingHorizontal: spacing.xs, paddingTop: spacing.xs, paddingBottom: spacing.sm, gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.xs },
  key: { flex: 1, minHeight: 52, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
