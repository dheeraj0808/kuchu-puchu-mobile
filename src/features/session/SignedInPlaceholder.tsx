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
}

/** Interim onboarding screen while the server moves to a step the app doesn't have yet. Keeps sign-out reachable. */
export function SignedInPlaceholder({ title, body, signOutLabel, signingOutLabel }: Props) {
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
        <Button variant="secondary" label={signOutLabel} loading={signingOut} loadingLabel={signingOutLabel} onPress={handleSignOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  copy: { gap: spacing.xs },
});
