import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import * as accountApi from '@/api/account';
import type { DeviceSession } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Icon } from '@/components/Icon';
import { ListScreen } from '@/components/ListScreen';
import { SettingsGroup, SettingsRow } from '@/components/Settings';
import { describeSession, splitSessions, useSessions } from '@/features/settings/sessions';
import { t } from '@/i18n';
import { queryKeys } from '@/lib/queryClient';
import { radius, spacing, typography, useTheme } from '@/theme';

/**
 * Screen 45 — Devices. This device on a pink-shade card, other devices with
 * a Sign out action, and "Sign out of all devices" pinned at the bottom.
 * States: loading, content, empty (only this device), error with retry.
 */
export default function DevicesScreen() {
  const queryClient = useQueryClient();
  const sessions = useSessions();
  const [confirmAll, setConfirmAll] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions });

  const revoke = useMutation({
    mutationFn: (id: string) => accountApi.revokeSession(id),
    onMutate: () => setActionError(null),
    onError: () => setActionError(t('devices.actionError')),
    onSettled: refresh,
  });

  const revokeAll = useMutation({
    mutationFn: accountApi.logoutAllDevices,
    onMutate: () => setActionError(null),
    onError: () => setActionError(t('devices.actionError')),
    onSettled: async () => {
      setConfirmAll(false);
      await refresh();
    },
  });

  const { current, others } = splitSessions(sessions.data ?? []);
  const hasOthers = others.length > 0;

  return (
    <ListScreen
      title={t('devices.title')}
      onBack={() => router.back()}
      footer={
        hasOthers ? (
          <Button
            variant="destructiveOutline"
            icon="logout"
            label={t('devices.signOutAll')}
            loading={revokeAll.isPending}
            loadingLabel={t('devices.signingOut')}
            onPress={() => setConfirmAll(true)}
          />
        ) : null
      }>
      {sessions.isPending ? (
        <View style={styles.center} accessibilityLabel={t('common.retrying')}>
          <ActivityIndicator />
        </View>
      ) : sessions.isError ? (
        <Banner message={t('devices.loadError')} actionLabel={t('common.tryAgain')} onAction={() => void sessions.refetch()} />
      ) : (
        <>
          {current ? <CurrentDevice session={current} /> : null}
          {actionError ? <Banner message={actionError} /> : null}
          {hasOthers ? (
            <SettingsGroup title={t('devices.otherDevices')}>
              {others.map((s) => (
                <SettingsRow
                  key={s.id}
                  icon="cellphone"
                  title={s.deviceName}
                  subtitle={describeSession(s)}
                  accessory={
                    <SignOutButton
                      device={s.deviceName}
                      busy={revoke.isPending && revoke.variables === s.id}
                      disabled={revoke.isPending || revokeAll.isPending}
                      onPress={() => revoke.mutate(s.id)}
                    />
                  }
                />
              ))}
            </SettingsGroup>
          ) : (
            <AppText tone="muted" align="center">
              {t('devices.noOthers')}
            </AppText>
          )}
        </>
      )}

      <ConfirmDialog
        visible={confirmAll}
        title={t('devices.signOutAllTitle')}
        message={t('devices.signOutAllBody')}
        confirmLabel={t('devices.signOutAllConfirm')}
        destructive
        loading={revokeAll.isPending}
        loadingLabel={t('devices.signingOut')}
        onConfirm={() => revokeAll.mutate()}
        onCancel={() => setConfirmAll(false)}
      />
    </ListScreen>
  );
}

function CurrentDevice({ session }: { session: DeviceSession }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${session.deviceName}, ${t('devices.thisDevice')}, ${describeSession(session)}`}
      style={[styles.current, { backgroundColor: colors.surface }]}>
      <View style={[styles.tile, { backgroundColor: colors.background }]}>
        <Icon name="cellphone" size={22} color="primary" />
      </View>
      <View style={styles.text}>
        <View style={styles.nameRow}>
          <AppText style={[typography.body, styles.name]} numberOfLines={1}>
            {session.deviceName}
          </AppText>
          <View style={[styles.pill, { backgroundColor: colors.primary }]}>
            <AppText variant="caption" tone="onPrimary" style={styles.pillText} maxFontSizeMultiplier={1.3}>
              {t('devices.thisDevice')}
            </AppText>
          </View>
        </View>
        <AppText variant="label" tone="muted" style={styles.subtitle}>
          {describeSession(session)}
        </AppText>
      </View>
    </View>
  );
}

function SignOutButton({ device, busy, disabled, onPress }: { device: string; busy: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('devices.signOutLabel', { device })}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={12}>
      {busy ? (
        <ActivityIndicator />
      ) : (
        <AppText style={typography.label} tone="primary">
          {t('devices.signOut')}
        </AppText>
      )}
    </Pressable>
  );
}

const TILE = 40;

const styles = StyleSheet.create({
  center: { paddingVertical: spacing.xl, alignItems: 'center' },
  current: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  tile: { width: TILE, height: TILE, borderRadius: radius.sm - 2, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  name: { fontFamily: typography.label.fontFamily, flexShrink: 1 },
  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.xs + 2, paddingVertical: 2 },
  pillText: { fontFamily: typography.label.fontFamily },
  subtitle: { fontFamily: typography.body.fontFamily },
});
