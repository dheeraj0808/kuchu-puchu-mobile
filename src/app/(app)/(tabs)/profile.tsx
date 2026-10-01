import { router } from 'expo-router';
import { useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { TabPlaceholder } from '@/components/TabPlaceholder';
import { t } from '@/i18n';

/** Screen 35 (My profile) comes later; Settings stays reachable from here. */
export default function ProfileTab() {
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  return (
    <TabPlaceholder icon="account-outline" title={t('tabsPlaceholder.profileTitle')} body={t('tabsPlaceholder.profileBody')}>
      <Button icon="cog-outline" label={t('tabsPlaceholder.settings')} onPress={() => router.push('/settings')} />
      <Button
        variant="secondary"
        label={t('tabsPlaceholder.signOut')}
        loading={signingOut}
        loadingLabel={t('tabsPlaceholder.signingOut')}
        onPress={async () => {
          setSigningOut(true);
          try {
            await signOut();
          } finally {
            setSigningOut(false);
          }
        }}
      />
    </TabPlaceholder>
  );
}
