import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';

import { AppText } from './AppText';

/** Pink "Plus" badge (guide §5.3 plan badge). Centred in rows; `align="start"` at the top of a sheet. */
export function PlusPill({ align = 'center' }: { align?: 'center' | 'start' }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: colors.primary, alignSelf: align === 'start' ? 'flex-start' : 'center' }]}>
      <AppText variant="caption" tone="onPrimary" style={styles.text} maxFontSizeMultiplier={1.3}>
        {t('preferences.plus')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.xs + 2, paddingVertical: 2 },
  text: { fontFamily: typography.label.fontFamily },
});
