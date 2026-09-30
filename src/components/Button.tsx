import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { layout, radius, spacing, typography, useTheme, type ColorPalette } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

/**
 * Guide §5.3: primary (pink), secondary (black outline), ghost, destructive.
 * `inverse` / `inverseOutline` are the white buttons on the pink Welcome screen.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'inverse' | 'inverseOutline';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  /** Announced to screen readers and shown while loading. */
  loadingLabel?: string;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

interface Palette {
  bg: keyof ColorPalette | null;
  fg: keyof ColorPalette;
  border: keyof ColorPalette | null;
  icon: keyof ColorPalette;
}

const PALETTES: Record<Variant, Palette> = {
  primary: { bg: 'primary', fg: 'onPrimary', border: null, icon: 'onPrimary' },
  secondary: { bg: 'background', fg: 'text', border: 'outline', icon: 'text' },
  ghost: { bg: null, fg: 'primary', border: null, icon: 'primary' },
  destructive: { bg: 'danger', fg: 'onPrimary', border: null, icon: 'onPrimary' },
  // Deck screen 01: pink text, ink icon on white; white text, ink icon on the outline button.
  inverse: { bg: 'onPrimary', fg: 'primary', border: null, icon: 'text' },
  inverseOutline: { bg: null, fg: 'onPrimary', border: 'onPrimaryBorder', icon: 'text' },
};

export function Button({
  label,
  variant = 'primary',
  icon,
  loading = false,
  loadingLabel,
  disabled,
  fullWidth = true,
  style,
  onPress,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const palette = PALETTES[variant];
  const fg = colors[palette.fg];
  const shownLabel = loading && loadingLabel ? loadingLabel : label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shownLabel}
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'ghost' && styles.ghost,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: palette.bg ? colors[palette.bg] : 'transparent',
          borderColor: palette.border ? colors[palette.border] : 'transparent',
          // Pressed and disabled states are transparency, never a new colour (guide §5.1).
          opacity: disabled && !loading ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      {...rest}>
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={fg} />
        ) : icon ? (
          <Icon name={icon} size={20} color={palette.icon} />
        ) : null}
        <AppText style={[typography.button, { color: fg }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {shownLabel}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.buttonHeight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: { minHeight: 48, paddingHorizontal: spacing.sm },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
});
