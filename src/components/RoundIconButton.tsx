import { Pressable, StyleSheet } from 'react-native';

import { useTheme, type ColorPalette } from '@/theme';

import { Icon, type IconName } from './Icon';

interface Props {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: keyof ColorPalette;
  /** White circle for use over photos (deck 19). */
  onPhoto?: boolean;
  size?: number;
}

/** Round icon button: pink-shade circle in headers (deck 18), white over photos (deck 19). */
export function RoundIconButton({ icon, label, onPress, color = 'text', onPhoto, size = 44 }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: onPhoto ? colors.photoButton : colors.surface, opacity: pressed ? 0.75 : 1 },
      ]}>
      <Icon name={icon} size={22} color={onPhoto ? 'camera' : color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
});
