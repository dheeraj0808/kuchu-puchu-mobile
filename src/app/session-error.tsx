import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Wordmark } from '@/components/Wordmark';
import { useAuth } from '@/auth/AuthProvider';
import { spacing } from '@/theme';

/** Shown when a saved session exists but couldn't be verified (offline, server down). */
export default function SessionErrorScreen() {
  const { restoreError, retryRestore, discardSession } = useAuth();
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      await retryRestore();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Screen>
      <View style={styles.stack}>
        <Wordmark />
        <View style={styles.copy}>
          <AppText variant="title">We can’t reach you right now</AppText>
          <AppText tone="muted">
            {restoreError?.message ?? 'We couldn’t confirm your session.'} You’re still signed in on this
            device.
          </AppText>
        </View>
        <Button label="Try again" loading={retrying} loadingLabel="Reconnecting…" onPress={retry} />
        <Button label="Sign in with a different account" variant="ghost" disabled={retrying} onPress={discardSession} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  copy: { gap: spacing.xs },
});
