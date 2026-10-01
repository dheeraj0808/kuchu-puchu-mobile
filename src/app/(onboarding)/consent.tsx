import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { IconRow } from '@/components/IconRow';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Sheet } from '@/components/Sheet';
import { t } from '@/i18n';
import { fonts, spacing } from '@/theme';

/**
 * Screen 06 — Consent ("First, a quick live selfie"). Explains the selfie
 * before the camera opens; Start is disabled until the box is ticked. The
 * consent version goes with POST /verification/face/session.
 */
export default function ConsentScreen() {
  const [agreed, setAgreed] = useState(false);
  const [details, setDetails] = useState(false);

  return (
    <OnboardingScreen
      step="consent"
      title={t('consent.title')}
      subtitle={t('consent.subtitle')}
      footer={
        <View style={styles.footer}>
          <Checkbox checked={agreed} onChange={setAgreed} accessibilityLabel={t('consent.agreeLabel')}>
            <AppText>
              {t('consent.agree')}
              <AppText
                tone="primary"
                style={styles.link}
                accessibilityRole="link"
                accessibilityLabel={t('consent.howWeUse')}
                onPress={() => setDetails(true)}>
                {t('consent.howWeUse')}
              </AppText>
            </AppText>
          </Checkbox>
          <Button icon="camera-outline" label={t('consent.start')} disabled={!agreed} onPress={() => router.push('/selfie')} />
        </View>
      }>
      <View style={styles.rows}>
        <IconRow icon="account-outline" title={t('consent.realTitle')} body={t('consent.realBody')} />
        <IconRow icon="lock-outline" title={t('consent.privateTitle')} body={t('consent.privateBody')} />
        <IconRow icon="eye-off-outline" title={t('consent.hiddenTitle')} body={t('consent.hiddenBody')} />
      </View>

      <Sheet visible={details} onClose={() => setDetails(false)}>
        <View style={styles.sheet}>
          <AppText variant="title">{t('consent.sheetTitle')}</AppText>
          <AppText>{t('consent.sheet1')}</AppText>
          <AppText>{t('consent.sheet2')}</AppText>
          <AppText>{t('consent.sheet3')}</AppText>
          <Button label={t('consent.gotIt')} onPress={() => setDetails(false)} />
        </View>
      </Sheet>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  rows: { gap: spacing.lg },
  footer: { gap: spacing.md },
  link: { fontFamily: fonts.bold },
  sheet: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.md },
});
