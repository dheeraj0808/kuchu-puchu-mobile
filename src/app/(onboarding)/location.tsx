import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/errors';
import type { LocationBody } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { requestApproximateLocation } from '@/features/onboarding/deviceLocation';
import { LocationIllustration } from '@/features/onboarding/LocationIllustration';
import { sendLocation } from '@/features/onboarding/sendLocation';
import { useSaveStep } from '@/features/onboarding/useSaveStep';
import { t } from '@/i18n';
import { layout, spacing, useTheme } from '@/theme';

/**
 * Screen 15 — Location ("See people near you"). Explains first, then asks
 * for foreground location only. Granted → PUT /profile/location with
 * rounded coordinates; denied or no fix → city picker (screen 17).
 */
export default function LocationScreen() {
  const { colors } = useTheme();
  const [asking, setAsking] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; message: string } | null>(null);
  const save = useSaveStep((body: LocationBody) => sendLocation(body));

  const allow = async () => {
    setAsking(true);
    setNotice(null);
    try {
      const outcome = await requestApproximateLocation();
      if (outcome.kind !== 'granted') {
        if (outcome.kind === 'unavailable') setNotice({ tone: 'info', message: t('location.unavailable') });
        router.push('/city');
        return;
      }
      await save.mutateAsync({ lat: outcome.lat, lng: outcome.lng }); // The gate moves on to notifications.
    } catch (err) {
      setNotice({ tone: 'error', message: errorMessage(err) });
    } finally {
      setAsking(false);
    }
  };

  const busy = asking || save.isPending;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.column, styles.scroll]}>
        <LocationIllustration />
        <View style={styles.copy}>
          <AppText variant="display" align="center">
            {t('location.title')}
          </AppText>
          <AppText tone="muted" align="center">
            {t('location.body')}
          </AppText>
        </View>
        {notice ? <Banner tone={notice.tone} message={notice.message} /> : null}
      </ScrollView>
      <View style={[styles.column, styles.footer]}>
        <Button icon="map-marker-outline" label={t('location.allow')} loading={busy} loadingLabel={t('location.allowing')} onPress={allow} />
        <Button variant="plain" label={t('location.useCity')} disabled={busy} onPress={() => router.push('/city')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: layout.formMaxWidth, alignSelf: 'center', paddingHorizontal: spacing.md },
  scroll: { flexGrow: 1, justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.xl },
  copy: { gap: spacing.xs, paddingHorizontal: spacing.sm },
  footer: { gap: spacing.xxs, paddingBottom: spacing.md },
});
