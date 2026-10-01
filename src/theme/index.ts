import { useColorScheme } from 'react-native';

/**
 * Brand tokens (UI deck "Kuchu-Puchu-App-UI-50-Screens.pdf", guide §5).
 * Only these four hues exist. Everything else is a transparent variant of
 * one of them, plus a system red for errors and destructive actions.
 * Screens and components never use hex values or font names directly.
 */
export const brand = {
  pink: '#c76883',
  black: '#111111',
  white: '#ffffff',
  pinkShade: '#fff8f8',
  /** System red: errors and destructive actions only. */
  red: '#c0392b',
} as const;

/** `alpha('#c76883', 0.2)` → `rgba(199, 104, 131, 0.2)`. */
export function alpha(hex: string, opacity: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity})`;
}

const light = {
  background: brand.white,
  surface: brand.pinkShade,
  text: brand.black,
  textMuted: alpha(brand.black, 0.6),
  textSubtle: alpha(brand.black, 0.45),
  border: alpha(brand.black, 0.12),
  borderStrong: alpha(brand.black, 0.24),
  primary: brand.pink,
  primarySoft: brand.pinkShade,
  primaryBorder: alpha(brand.pink, 0.3),
  onPrimary: brand.white,
  /** Solid outline for secondary (black outline) buttons. */
  outline: brand.black,
  danger: brand.red,
  dangerSoft: alpha(brand.red, 0.08),
  /** White and ink used on top of a pink surface (Welcome). */
  onPrimaryMuted: alpha(brand.white, 0.9),
  onPrimaryBorder: alpha(brand.white, 0.6),
  /** Welcome illustration: rose skin tone and soft bubbles, derived from the brand pink. */
  illustrationSkin: alpha(brand.pink, 0.55),
  illustrationBubble: alpha(brand.white, 0.45),
  /** Laid over `background` on dialogs and sheets so they lift off the page (none in light). */
  elevatedTint: 'transparent',
  /** Over profile photos (deck 18, 19): same in both themes. */
  onPhoto: brand.white,
  onPhotoMuted: alpha(brand.white, 0.8),
  photoScrim: alpha(brand.black, 0.78),
  photoScrimClear: alpha(brand.black, 0),
  photoPill: alpha(brand.white, 0.14),
  photoPillBorder: alpha(brand.white, 0.55),
  photoPromptBox: alpha(brand.black, 0.36),
  photoDot: alpha(brand.white, 0.45),
  photoButton: alpha(brand.white, 0.92),
  /** Live selfie (deck 07) is always dark, in both themes. */
  camera: brand.black,
  onCamera: brand.white,
  cameraTrack: alpha(brand.white, 0.2),
  cameraChip: alpha(brand.white, 0.14),
  cameraChipBorder: alpha(brand.white, 0.35),
  shadowRaised: `0px 1px 4px ${alpha(brand.black, 0.1)}`,
  shadowCard: `0px 8px 24px ${alpha(brand.black, 0.08)}`,
};

export type ColorPalette = { [K in keyof typeof light]: string };

/** Guide §5.1: background #111111, text white, primary unchanged, cards white at 6%. */
const dark: ColorPalette = {
  background: brand.black,
  surface: alpha(brand.white, 0.06),
  text: brand.white,
  textMuted: alpha(brand.white, 0.7),
  textSubtle: alpha(brand.white, 0.5),
  border: alpha(brand.white, 0.12),
  borderStrong: alpha(brand.white, 0.24),
  primary: brand.pink,
  primarySoft: alpha(brand.white, 0.06),
  primaryBorder: alpha(brand.pink, 0.5),
  onPrimary: brand.white,
  outline: brand.white,
  danger: brand.red,
  dangerSoft: alpha(brand.red, 0.16),
  onPrimaryMuted: alpha(brand.white, 0.9),
  onPrimaryBorder: alpha(brand.white, 0.6),
  illustrationSkin: alpha(brand.pink, 0.55),
  illustrationBubble: alpha(brand.white, 0.45),
  elevatedTint: alpha(brand.white, 0.08),
  /** Live selfie (deck 07) is always dark, in both themes. */
  /** Over profile photos (deck 18, 19): same in both themes. */
  onPhoto: brand.white,
  onPhotoMuted: alpha(brand.white, 0.8),
  photoScrim: alpha(brand.black, 0.78),
  photoScrimClear: alpha(brand.black, 0),
  photoPill: alpha(brand.white, 0.14),
  photoPillBorder: alpha(brand.white, 0.55),
  photoPromptBox: alpha(brand.black, 0.36),
  photoDot: alpha(brand.white, 0.45),
  photoButton: alpha(brand.white, 0.92),
  camera: brand.black,
  onCamera: brand.white,
  cameraTrack: alpha(brand.white, 0.2),
  cameraChip: alpha(brand.white, 0.14),
  cameraChipBorder: alpha(brand.white, 0.35),
  shadowRaised: `0px 1px 4px ${alpha(brand.black, 0.4)}`,
  shadowCard: `0px 8px 24px ${alpha(brand.black, 0.45)}`,
};

/**
 * Font files, keyed by the family name each one registers. On Android a
 * custom font's weight comes from its family, not from `fontWeight`, so
 * every weight is its own family.
 */
export const fontFiles = {
  BricolageGrotesque_700Bold: require('@expo-google-fonts/bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.ttf'),
  PlusJakartaSans_400Regular: require('@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf'),
  PlusJakartaSans_600SemiBold: require('@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf'),
  PlusJakartaSans_700Bold: require('@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf'),
} as const;

type FontFamily = keyof typeof fontFiles;

/** Bricolage Grotesque for names and headings; Plus Jakarta Sans for everything else. */
export const fonts = {
  heading: 'BricolageGrotesque_700Bold',
  regular: 'PlusJakartaSans_400Regular',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const satisfies Record<string, FontFamily>;

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

/** Inputs 12 · buttons and cards 16 · profile card 20 · chips full round. */
export const radius = { sm: 12, md: 16, lg: 20, pill: 999 } as const;

/** Guide §5.2 type scale, plus the larger brand sizes the deck uses on Welcome. */
export const typography = {
  wordmark: { fontFamily: fonts.heading, fontSize: 40, lineHeight: 48, letterSpacing: -0.8 },
  hero: { fontFamily: fonts.heading, fontSize: 32, lineHeight: 36, letterSpacing: -0.6 },
  display: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  title: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  heading: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  button: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  /** Deck 03 keypad digits. */
  keypad: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30 },
} as const;

/** Content widths so tablet/desktop layouts don't stretch forms edge to edge. */
export const layout = { formMaxWidth: 440, contentMaxWidth: 600, wideBreakpoint: 768, buttonHeight: 56 } as const;

export interface Theme {
  colors: ColorPalette;
  scheme: 'light' | 'dark';
}

const LIGHT_THEME: Theme = { colors: light, scheme: 'light' };
const DARK_THEME: Theme = { colors: dark, scheme: 'dark' };

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? DARK_THEME : LIGHT_THEME;
}
