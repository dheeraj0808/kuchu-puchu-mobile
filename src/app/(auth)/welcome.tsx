import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { IdentifierType } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Wordmark } from '@/components/Wordmark';
import { env } from '@/config/env';
import { WelcomeIllustration } from '@/features/auth/WelcomeIllustration';
import { t } from '@/i18n';
import { fonts, layout, spacing, typography, useTheme } from '@/theme';

/**
 * Screen 01 — Welcome. First screen with no session: brand, the 18+
 * reminder and two ways in. Static content; the gate has already checked
 * /app/config (force update, maintenance) before this can show.
 */
export default function WelcomeScreen() {
  const { colors } = useTheme();

  const continueWith = (method: IdentifierType) => {
    router.push({ pathname: '/sign-in', params: { method } });
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.primary }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <Wordmark size="large" onPrimary />

        <View style={styles.hero}>
          <WelcomeIllustration />
        </View>

        <View style={styles.copy}>
          <AppText variant="hero" tone="onPrimary">
            {t('welcome.headline')}
          </AppText>
          <AppText tone="onPrimaryMuted">{t('welcome.body')}</AppText>
        </View>

        <View style={styles.actions}>
          <Button
            variant="inverse"
            icon="phone-outline"
            label={t('welcome.continuePhone')}
            onPress={() => continueWith('phone')}
          />
          <Button
            variant="inverseOutline"
            icon="email-outline"
            label={t('welcome.continueEmail')}
            onPress={() => continueWith('email')}
          />
          <AppText variant="caption" tone="onPrimaryMuted" align="center" style={styles.legal}>
            {t('welcome.legalPrefix')}
            <LegalLink label={t('welcome.terms')} url={env.termsUrl} />
            {t('welcome.legalJoin')}
            <LegalLink label={t('welcome.privacy')} url={env.privacyUrl} />
            {t('welcome.legalSuffix')}
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LegalLink({ label, url }: { label: string; url: string }) {
  return (
    <AppText
      variant="caption"
      tone="onPrimaryMuted"
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => void Linking.openURL(url).catch(() => undefined)}
      style={styles.link}>
      {label}
    </AppText>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.formMaxWidth,
  },
  hero: { marginTop: spacing.xl, marginBottom: spacing.lg, alignItems: 'flex-start' },
  copy: { gap: spacing.sm },
  // Pushes the buttons to the bottom; collapses when large fonts need the space.
  actions: { flexGrow: 1, justifyContent: 'flex-end', gap: spacing.sm, paddingTop: spacing.xl },
  legal: { marginTop: spacing.xs, paddingHorizontal: spacing.xs },
  link: { ...typography.caption, fontFamily: fonts.semibold },
});
