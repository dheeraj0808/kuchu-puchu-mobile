import { SignedInPlaceholder } from '@/features/session/SignedInPlaceholder';
import { t } from '@/i18n';

/** Reached when /auth/me reports nextStep ≠ done. Replaced by screen 06 (Consent) in Phase 2. */
export default function OnboardingSetup() {
  return (
    <SignedInPlaceholder
      title={t('onboarding.title')}
      body={t('onboarding.body')}
      signOutLabel={t('onboarding.signOut')}
      signingOutLabel={t('home.signingOut')}
    />
  );
}
