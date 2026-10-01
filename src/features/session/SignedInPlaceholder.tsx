import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Wordmark } from '@/components/Wordmark';
import { spacing } from '@/theme';

interface Props {
  title: string;
  body: string;
  signOutLabel: string;
  signingOutLabel: string;
  /** Temporary way into Settings until the Profile tab exists. */
  onOpenSettings?: () => void;
  settingsLabel?: string;
}

/**
 * Interim landing for signed-in users until the Phase 2 (onboarding) and
 * Phase 4 (tabs) screens exist. Keeps sign-out reachable for testing.
 */
export function SignedInPlaceholder({ title, body, signOutLabel, signingOutLabel, onOpenSettings, settingsLabel }: Props) {
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Screen>
      <View style={styles.stack}>
        <Wordmark />
        <View style={styles.copy}>
          <AppText variant="display">{title}</AppText>
          <AppText tone="muted">{body}</AppText>
        </View>
        {onOpenSettings && settingsLabel ? <Button icon="cog-outline" label={settingsLabel} onPress={onOpenSettings} /> : null}
        <Button
          variant="secondary"
          label={signOutLabel}
          loading={signingOut}
          loadingLabel={signingOutLabel}
          onPress={handleSignOut}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  copy: { gap: spacing.xs },
});
