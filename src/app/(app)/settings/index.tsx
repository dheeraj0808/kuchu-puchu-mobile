import { router, type Href } from 'expo-router';
import { useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ListScreen } from '@/components/ListScreen';
import { SettingsGroup, SettingsRow } from '@/components/Settings';
import { env } from '@/config/env';
import { useBlocks } from '@/features/safety/useBlocks';
import { useSessions } from '@/features/settings/sessions';
import { t, type TranslationKey } from '@/i18n';
import { maskEmail, maskPhone } from '@/lib/identifier';

/**
 * Screen 40 — Settings. Account, privacy and safety, and session actions.
 * Rows for later phases open the Coming soon placeholder.
 */
export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const sessions = useSessions();
  const blocks = useBlocks();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const comingSoon = (titleKey: TranslationKey) => () =>
    router.push({ pathname: '/settings/coming-soon', params: { title: t(titleKey) } });

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut(); // The gate routes to Welcome.
    } finally {
      setSigningOut(false);
      setConfirmSignOut(false);
    }
  };

  const contactRow = user?.phone
    ? { title: t('settings.phone'), subtitle: maskPhone(user.phone), icon: 'phone-outline' as const }
    : { title: t('settings.email'), subtitle: user?.email ? maskEmail(user.email) : null, icon: 'email-outline' as const };
  const version = env.buildNumber
    ? t('settings.versionBuild', { version: env.appVersion, build: env.buildNumber })
    : t('settings.version', { version: env.appVersion });

  return (
    <ListScreen title={t('settings.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))}>
      <SettingsGroup title={t('settings.account')}>
        <SettingsRow {...contactRow} onPress={comingSoon(user?.phone ? 'settings.phone' : 'settings.email')} />
        <SettingsRow
          icon="cellphone"
          title={t('settings.devices')}
          subtitle={sessions.data ? t('settings.devicesCount', { count: sessions.data.length }) : null}
          onPress={() => router.push('/settings/devices')}
        />
        <SettingsRow
          icon="diamond-outline"
          title={t('settings.subscription')}
          subtitle={user?.plan ? t(`plans.${user.plan}`) : null}
          onPress={comingSoon('settings.subscription')}
        />
      </SettingsGroup>

      <SettingsGroup title={t('settings.privacySafety')}>
        <SettingsRow icon="eye-off-outline" title={t('settings.privacy')} onPress={comingSoon('settings.privacy')} />
        <SettingsRow
          icon="cancel"
          title={t('settings.blocked')}
          subtitle={blocks.data && blocks.data.length > 0 ? String(blocks.data.length) : null}
          onPress={() => router.push('/settings/blocked')}
        />
        <SettingsRow icon="shield-check-outline" title={t('settings.safety')} onPress={() => router.push('/settings/safety')} />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow icon="bell-outline" title={t('settings.notifications')} onPress={comingSoon('settings.notifications')} />
        <SettingsRow icon="logout" title={t('settings.signOut')} chevron={false} onPress={() => setConfirmSignOut(true)} />
        <SettingsRow
          icon="trash-can-outline"
          title={t('settings.deleteAccount')}
          destructive
          chevron={false}
          onPress={() => router.push('/settings/delete-account')}
        />
      </SettingsGroup>

      <AppText variant="label" tone="subtle" align="center">
        {version}
      </AppText>

      <ConfirmDialog
        visible={confirmSignOut}
        title={t('settings.signOutTitle')}
        message={t('settings.signOutBody')}
        confirmLabel={t('settings.signOutConfirm')}
        loading={signingOut}
        loadingLabel={t('settings.signingOut')}
        onConfirm={handleSignOut}
        onCancel={() => setConfirmSignOut(false)}
      />
    </ListScreen>
  );
}
