import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { submitAppeal } from '@/api/endpoints/safety';
import { errorMessage } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/TextField';
import { env } from '@/config/env';
import { describeRestriction } from '@/features/safety/restriction';
import { t } from '@/i18n';
import { layout, spacing, typography, useTheme } from '@/theme';

const APPEAL_MIN = 10;
const APPEAL_MAX = 1000;

/**
 * Screen 49 — Account suspended / banned. Reached from 403 ACCOUNT_RESTRICTED
 * on /auth/me or any request; the gate makes it the only screen. Shows the
 * reason category and end date, and the appeal form when allowed.
 */
export default function RestrictedScreen() {
  const { colors } = useTheme();
  const { restriction, signOut } = useAuth();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!restriction) return null;
  const text = describeRestriction(restriction);
  const canAppeal = restriction.appealAllowed && !sent;
  const tooShort = message.trim().length < APPEAL_MIN;

  const send = async () => {
    if (tooShort) return;
    setSending(true);
    setError(null);
    try {
      await submitAppeal(message.trim());
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={[styles.column, styles.scroll]} keyboardShouldPersistTaps="handled">
          <View style={[styles.halo, { backgroundColor: colors.primarySoft }]}>
            <View style={[styles.ring, { borderColor: colors.primaryBorder, backgroundColor: colors.background }]}>
              <Icon name="lock-outline" size={32} color="primary" />
            </View>
          </View>
          <View style={styles.copy}>
            <AppText variant="display" align="center">
              {text.title}
            </AppText>
            <AppText tone="muted" align="center">
              {text.body}
            </AppText>
          </View>

          {sent ? (
            <View style={[styles.sent, { backgroundColor: colors.surface }]} accessibilityLiveRegion="polite">
              <Icon name="check-circle" size={26} color="primary" />
              <View style={styles.flex}>
                <AppText style={[typography.body, styles.bold]}>{t('restricted.sentTitle')}</AppText>
                <AppText variant="label" tone="muted" style={styles.regular}>
                  {t('restricted.sentBody')}
                </AppText>
              </View>
            </View>
          ) : canAppeal ? (
            <TextField
              label={t('restricted.mistake')}
              value={message}
              onChangeText={setMessage}
              placeholder={t('restricted.appealPlaceholder')}
              hint={message.length > 0 && tooShort ? t('restricted.appealTooShort') : undefined}
              multiline
              maxLength={APPEAL_MAX}
            />
          ) : null}
          {error ? <Banner message={error} actionLabel={t('common.tryAgain')} onAction={send} /> : null}
        </ScrollView>

        <View style={[styles.column, styles.footer]}>
          {canAppeal ? <Button label={t('restricted.send')} disabled={tooShort} loading={sending} loadingLabel={t('restricted.sending')} onPress={send} /> : null}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('restricted.guidelines')}
            onPress={() => void Linking.openURL(env.guidelinesUrl).catch(() => undefined)}
            hitSlop={12}>
            <AppText style={typography.label} tone="primary" align="center">
              {t('restricted.guidelines')}
            </AppText>
          </Pressable>
          <Button variant="plain" label={t('restricted.signOut')} onPress={() => void signOut()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const HALO = 136;
const RING = 88;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: layout.formMaxWidth, alignSelf: 'center', paddingHorizontal: spacing.md },
  scroll: { flexGrow: 1, gap: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  halo: { width: HALO, height: HALO, borderRadius: HALO / 2, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  ring: { width: RING, height: RING, borderRadius: RING / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  copy: { gap: spacing.xs, paddingHorizontal: spacing.sm },
  sent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 16 },
  bold: { fontFamily: typography.label.fontFamily },
  regular: { fontFamily: typography.body.fontFamily },
  footer: { gap: spacing.sm, paddingBottom: spacing.md },
});
