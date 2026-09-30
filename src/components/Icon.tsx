import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import { useTheme, type ColorPalette } from '@/theme';

/** The app's single icon set (guide §5.2: one outline set, 24 px, ink or primary). */
export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface IconProps {
  name: IconName;
  size?: number;
  /** A theme colour key; defaults to text (ink). */
  color?: keyof ColorPalette;
}

/** Decorative by default: the control that contains it carries the label. */
export function Icon({ name, size = 24, color = 'text' }: IconProps) {
  const { colors } = useTheme();
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={colors[color]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
