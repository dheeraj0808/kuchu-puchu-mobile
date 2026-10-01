import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { putPushDevice } from '@/api/endpoints/notifications';
import { errorMessage } from '@/api/errors';
import type { PushDeviceBody } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { enablePush, pushPlatform } from '@/features/notifications/push';
import { PlaceholderAvatar } from '@/features/onboarding/LocationIllustration';
import { useSaveStep } from '@/features/onboarding/useSaveStep';
import { t } from '@/i18n';
import { layout, radius, spacing, typography, useTheme } from '@/theme';

/**
 * Screen 16 — Notifications ("Don't miss a match"). Explains first, then on
 * "Turn on notifications" creates the Android channels, shows the OS prompt
 * (Android 13+) and registers the device token. "Not now" records the
 * choice without a token. Either way onboarding finishes.
 */
export default function NotificationsScreen() {
  const { colors } = useTheme();
  const [busy, setBusy] = useState<'on' | 'skip' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveStep((body: PushDeviceBody) => putPushDevice(body));

  const finish = async (mode: 'on' | 'skip') => {
    setBusy(mode);
    setError(null);
    try {
      const outcome = mode === 'on' ? await enablePush() : { granted: false as const };
      const token = outcome.granted ? outcome.token : null;
      await save.mutateAsync({ token, platform: pushPlatform() }); // nextStep → done → signed-in app.
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.column, styles.scroll]}>
        <View style={[styles.halo, { backgroundColor: colors.primarySoft }]}>
          <View style={[styles.ring, { borderColor: colors.primaryBorder, backgroundColor: colors.background }]}>
            <Icon name="bell-outline" size={32} color="primary" />
          </View>
        </View>
        <View style={styles.copy}>
          <AppText variant="display" align="center">
            {t('notifications.title')}
          </AppText>
          <AppText tone="muted" align="center">
            {t('notifications.body')}
          </AppText>
        </View>
        <View style={[styles.sample, { backgroundColor: colors.surface }]} accessible accessibilityLabel={t('notifications.sampleLabel')}>
          <PlaceholderAvatar size={48} top="text" />
          <View style={styles.flex}>
            <AppText style={[typography.body, styles.app]}>{t('notifications.sampleApp')}</AppText>
            <AppText variant="label" tone="muted" style={styles.regular}>
              {t('notifications.sampleText')}
            </AppText>
          </View>
          <AppText variant="label" tone="muted" style={styles.regular}>
            {t('notifications.sampleTime')}
          </AppText>
        </View>
        {error ? <Banner message={error} /> : null}
      </ScrollView>
      <View style={[styles.column, styles.footer]}>
        <Button
          label={t('notifications.turnOn')}
          loading={busy === 'on'}
          loadingLabel={t('notifications.turningOn')}
          disabled={busy === 'skip'}
          onPress={() => void finish('on')}
        />
        <Button variant="plain" label={t('notifications.notNow')} loading={busy === 'skip'} disabled={busy === 'on'} onPress={() => void finish('skip')} />
      </View>
    </SafeAreaView>
  );
}

const HALO = 136;
const RING = 88;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: layout.formMaxWidth, alignSelf: 'center', paddingHorizontal: spacing.md },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'stretch', gap: spacing.lg, paddingVertical: spacing.xl },
  halo: { width: HALO, height: HALO, borderRadius: HALO / 2, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  ring: { width: RING, height: RING, borderRadius: RING / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  copy: { gap: spacing.xs, paddingHorizontal: spacing.sm },
  sample: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  app: { fontFamily: typography.label.fontFamily },
  regular: { fontFamily: typography.body.fontFamily },
  footer: { gap: spacing.xxs, paddingBottom: spacing.md },
});
