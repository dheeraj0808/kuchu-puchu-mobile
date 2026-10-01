import { t } from '@/i18n';

import { AppText } from './AppText';

interface WordmarkProps {
  /** `large` is the Welcome hero; `medium` the Discover header (deck 18); `small` other headers. */
  size?: 'large' | 'medium' | 'small';
  /** White on the pink Welcome screen, pink everywhere else. */
  onPrimary?: boolean;
}

/** The "kuchu puchu" wordmark: lower case, Bricolage Grotesque. */
export function Wordmark({ size = 'small', onPrimary = false }: WordmarkProps) {
  return (
    <AppText
      variant={size === 'large' ? 'wordmark' : size === 'medium' ? 'display' : 'heading'}
      tone={onPrimary ? 'onPrimary' : 'primary'}
      accessibilityRole="header"
      accessibilityLabel={t('brand.name')}
      maxFontSizeMultiplier={1.3}>
      {t('brand.wordmark')}
    </AppText>
  );
}
