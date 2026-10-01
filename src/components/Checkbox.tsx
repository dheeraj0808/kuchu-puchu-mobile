import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { Icon } from './Icon';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Spoken label; the visible text can contain a link. */
  accessibilityLabel: string;
  children: ReactNode;
}

/** Round pink checkbox with text (deck 06 consent). */
export function Checkbox({ checked, onChange, accessibilityLabel, children }: CheckboxProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked }}
        onPress={() => onChange(!checked)}
        hitSlop={12}
        style={[
          styles.box,
          { borderColor: checked ? colors.primary : colors.borderStrong, backgroundColor: checked ? colors.primary : colors.background },
        ]}>
        {checked ? <Icon name="check" size={16} color="onPrimary" /> : null}
      </Pressable>
      <View style={styles.text}>{children}</View>
    </View>
  );
}

const BOX = 26;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  box: { width: BOX, height: BOX, borderRadius: BOX / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  text: { flex: 1 },
});
