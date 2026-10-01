import { Pressable, StyleSheet } from 'react-native';

import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { Icon } from './Icon';

/** Round back (or close, deck 46) control at the top-left of step screens (deck 02, 03). */
export function BackButton({ onPress, disabled, close, label }: { onPress: () => void; disabled?: boolean; close?: boolean; label?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? t('common.back')}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name={close ? 'close' : 'chevron-left'} size={24} />
    </Pressable>
  );
}

const SIZE = 40;

const styles = StyleSheet.create({
  button: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center' },
});
