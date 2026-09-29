import { useColorScheme } from 'react-native';

const light = {
  background: '#FFF8F6',
  surface: '#FFFFFF',
  surfaceMuted: '#F8EEEC',
  text: '#1F1720',
  textMuted: '#6E6270',
  textSubtle: '#998C96',
  border: '#EADCDA',
  borderStrong: '#D6C4C3',
  primary: '#D93F68',
  primaryPressed: '#BD2F56',
  primarySoft: '#FCE4EA',
  onPrimary: '#FFFFFF',
  danger: '#B3261E',
  dangerSoft: '#FCE8E6',
  success: '#1B7A4B',
  successSoft: '#E3F4EA',
  info: '#3D5A80',
  infoSoft: '#E8EEF6',
  shadow: '#3B1A28',
};

export type ColorPalette = typeof light;

const dark: ColorPalette = {
  background: '#130E13',
  surface: '#1D161D',
  surfaceMuted: '#281F28',
  text: '#F6EDF1',
  textMuted: '#B8A9B3',
  textSubtle: '#8A7B86',
  border: '#352A33',
  borderStrong: '#4A3C47',
  primary: '#FF6F92',
  primaryPressed: '#FF8EA9',
  primarySoft: '#3A1B26',
  onPrimary: '#1A0B11',
  danger: '#FF8A80',
  dangerSoft: '#3A1B1B',
  success: '#6FD5A0',
  successSoft: '#15301F',
  info: '#9DB8E0',
  infoSoft: '#1B2433',
  shadow: '#000000',
};

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
};

/** Content widths so tablet/desktop layouts don't stretch forms edge to edge. */
export const layout = { formMaxWidth: 440, contentMaxWidth: 600, wideBreakpoint: 768 } as const;

export interface Theme {
  colors: ColorPalette;
  scheme: 'light' | 'dark';
}

const LIGHT_THEME: Theme = { colors: light, scheme: 'light' };
const DARK_THEME: Theme = { colors: dark, scheme: 'dark' };

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? DARK_THEME : LIGHT_THEME;
}
