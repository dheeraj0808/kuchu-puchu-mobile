import { Text, type TextProps } from 'react-native';

import { typography, useTheme, type ColorPalette } from '@/theme';

type Variant = keyof typeof typography;
type Tone = 'default' | 'muted' | 'subtle' | 'primary' | 'danger' | 'success';

const TONES: Record<Tone, keyof ColorPalette> = {
  default: 'text',
  muted: 'textMuted',
  subtle: 'textSubtle',
  primary: 'primary',
  danger: 'danger',
  success: 'success',
};

interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  align?: 'left' | 'center' | 'right';
}

export function AppText({ variant = 'body', tone = 'default', align, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const isHeading = variant === 'display' || variant === 'title' || variant === 'heading';
  return (
    <Text
      accessibilityRole={isHeading ? 'header' : undefined}
      maxFontSizeMultiplier={1.6}
      style={[typography[variant], { color: colors[TONES[tone]], textAlign: align }, style]}
      {...rest}
    />
  );
}
