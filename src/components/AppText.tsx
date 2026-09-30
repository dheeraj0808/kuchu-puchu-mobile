import { Text, type TextProps } from 'react-native';

import { typography, useTheme, type ColorPalette } from '@/theme';

type Variant = keyof typeof typography;
type Tone = 'default' | 'muted' | 'subtle' | 'primary' | 'danger' | 'onPrimary' | 'onPrimaryMuted';

const TONES: Record<Tone, keyof ColorPalette> = {
  default: 'text',
  muted: 'textMuted',
  subtle: 'textSubtle',
  primary: 'primary',
  danger: 'danger',
  onPrimary: 'onPrimary',
  onPrimaryMuted: 'onPrimaryMuted',
};

const HEADINGS: ReadonlySet<Variant> = new Set(['wordmark', 'hero', 'display', 'title', 'heading']);

interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  align?: 'left' | 'center' | 'right';
}

/** The only way text is drawn: font family, size and colour always come from the theme. */
export function AppText({ variant = 'body', tone = 'default', align, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  return (
    <Text
      accessibilityRole={HEADINGS.has(variant) ? 'header' : undefined}
      maxFontSizeMultiplier={1.6}
      style={[typography[variant], { color: colors[TONES[tone]], textAlign: align }, style]}
      {...rest}
    />
  );
}
