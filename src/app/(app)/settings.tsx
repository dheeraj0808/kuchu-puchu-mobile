import Constants from 'expo-constants';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { errorMessage, isApiError } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { env } from '@/config/env';
import { confirm } from '@/lib/confirm';
import { spacing } from '@/theme';

type Pending = 'signOut' | 'signOutAll' | null;

export default function SettingsScreen() {
  const { signOut, signOutEverywhere } = useAuth();
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    if (pending) return;
    setPending('signOut');
    setError(null);
    try {
      await signOut();
    } finally {
      setPending(null);
    }
  };

  const handleSignOutAll = async () => {
    if (pending) return;
    const ok = await confirm({
      title: 'Sign out of all devices?',
      message: 'You’ll be signed out everywhere, including this device. You can sign back in with a new code.',
      confirmLabel: 'Sign out everywhere',
      destructive: true,
    });
    if (!ok) return;
    setPending('signOutAll');
    setError(null);
    try {
      await signOutEverywhere();
    } catch (err) {
      // Session already gone → the router is taking us to sign-in.
      if (!(isApiError(err) && err.kind === 'session')) setError(errorMessage(err));
      setPending(null);
    }
  };

  const version = Constants.expoConfig?.version ?? '—';

  return (
    <Screen variant="content" edges={['bottom']}>
      <View style={styles.stack}>
        {error ? <Banner message={error} /> : null}

        <Card title="This device">
          <View style={styles.section}>
            <AppText tone="muted">Sign out of Kuchu Puchu on this device.</AppText>
            <Button
              label="Sign out"
              variant="secondary"
              loading={pending === 'signOut'}
              loadingLabel="Signing out…"
              disabled={pending !== null}
              onPress={handleSignOut}
            />
          </View>
        </Card>

        <Card title="Security">
          <View style={styles.section}>
            <AppText tone="muted">
              Lost a phone or signed in somewhere you don’t recognise? End every active session at once.
            </AppText>
            <Button
              label="Sign out of all devices"
              variant="danger"
              loading={pending === 'signOutAll'}
              loadingLabel="Signing out everywhere…"
              disabled={pending !== null}
              onPress={handleSignOutAll}
            />
          </View>
        </Card>

        <AppText variant="caption" tone="subtle" align="center">
          Version {version}
          {env.appEnv !== 'production' ? ` · ${env.appEnv}` : ''}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  section: { gap: spacing.md, paddingVertical: spacing.md },
});
