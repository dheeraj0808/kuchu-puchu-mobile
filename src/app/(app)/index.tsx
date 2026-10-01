import { router } from 'expo-router';

import { SignedInPlaceholder } from '@/features/session/SignedInPlaceholder';
import { t } from '@/i18n';

/** Replaced by the Discover tab (screen 18) in Phase 4. */
export default function AppIndex() {
  return (
    <SignedInPlaceholder
      title={t('home.title')}
      body={t('home.body')}
      signOutLabel={t('home.signOut')}
      signingOutLabel={t('home.signingOut')}
      settingsLabel={t('home.settings')}
      onOpenSettings={() => router.push('/settings')}
    />
  );
}
