import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { isReauthCancelled } from '@/auth/reauth';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ListScreen } from '@/components/ListScreen';
import { deleteMyAccount } from '@/features/settings/deleteAccount';
import { useBlockScreenshots } from '@/hooks/useBlockScreenshots';
import { t } from '@/i18n';
import { fonts, radius, spacing, typography, useTheme } from '@/theme';

const CONSEQUENCES = ['deleteAccount.profileDeleted', 'deleteAccount.chatsRemoved', 'deleteAccount.cannotUndo'] as const;

/**
 * Screen 48 — Delete account. Explains what happens, warns that a paid plan
 * keeps billing in Google Play, then deletes after an OTP step-up (the
 * global ReauthSheet opens on REAUTH_REQUIRED). Screenshots are blocked.
 */
export default function DeleteAccountScreen() {
  useBlockScreenshots();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteMyAccount(); // Session ends → the gate shows Welcome.
    } catch (err) {
      if (!isReauthCancelled(err)) setError(errorMessage(err));
      setDeleting(false);
    }
  };

  const planName = user?.plan && user.plan !== 'free' ? t(`plans.${user.plan}`) : null;

  return (
    <ListScreen
      title={t('deleteAccount.header')}
      onBack={() => router.back()}
      footer={
        <View style={styles.footer}>
          <Button
            variant="destructive"
            label={t('deleteAccount.delete')}
            loading={deleting}
            loadingLabel={t('deleteAccount.deleting')}
            onPress={remove}
          />
          <Button variant="plain" label={t('deleteAccount.keep')} disabled={deleting} onPress={() => router.back()} />
          <AppText variant="label" tone="muted" align="center" style={styles.note}>
            {t('deleteAccount.codeNote')}
          </AppText>
        </View>
      }>
      <View style={styles.content}>
        <AppText variant="display">{t('deleteAccount.title')}</AppText>

        <View style={styles.list}>
          {CONSEQUENCES.map((key) => (
            <View key={key} style={styles.item}>
              <Icon name="check" size={20} />
              <AppText style={styles.itemText}>{t(key)}</AppText>
            </View>
          ))}
        </View>

        {planName ? (
          <View style={[styles.planNote, { backgroundColor: colors.surface, borderLeftColor: colors.primary }]}>
            <AppText>
              {t('deleteAccount.planPrefix')}
              <AppText style={styles.bold}>{planName}</AppText>
              {t('deleteAccount.planSuffix')}
            </AppText>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('deleteAccount.download')}
          onPress={() => router.push({ pathname: '/settings/coming-soon', params: { title: t('deleteAccount.download') } })}
          hitSlop={8}
          style={styles.download}>
          <Icon name="tray-arrow-down" size={20} color="primary" />
          <AppText style={[typography.body, styles.bold]}>{t('deleteAccount.download')}</AppText>
        </Pressable>

        {error ? <Banner message={error} actionLabel={t('common.tryAgain')} onAction={remove} /> : null}
      </View>
    </ListScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  list: { gap: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemText: { flex: 1 },
  planNote: { borderRadius: radius.md, borderLeftWidth: 4, padding: spacing.md },
  bold: { fontFamily: fonts.semibold },
  download: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  footer: { gap: spacing.xxs },
  note: { fontFamily: fonts.regular },
});
