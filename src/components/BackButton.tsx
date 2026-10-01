import { Pressable, StyleSheet } from 'react-native';

import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { Icon } from './Icon';

/** Round back control at the top-left of step screens (deck 02, 03). */
export function BackButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name="chevron-left" size={24} />
    </Pressable>
  );
}

const SIZE = 40;

const styles = StyleSheet.create({
  button: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center' },
});
