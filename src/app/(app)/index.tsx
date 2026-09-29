import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { errorMessage, isApiError } from '@/api/errors';
import type { User } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card, Row } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { spacing, useTheme } from '@/theme';

const STATUS_LABELS: Record<User['status'], string> = {
  active: 'Active',
  suspended: 'Suspended',
  deactivated: 'Deactivated',
};

function formatMemberSince(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

/** The signed-in user's account, from GET /auth/me. */
export default function AccountScreen() {
  const { user, reloadUser } = useAuth();
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(
    async (manual: boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;
      if (manual) setRefreshing(true);
      try {
        await reloadUser();
        setError(null);
      } catch (err) {
        // An ended session routes to sign-in by itself; don't flash an error.
        if (!(isApiError(err) && err.kind === 'session')) setError(errorMessage(err));
      } finally {
        inFlight.current = false;
        if (manual) setRefreshing(false);
      }
    },
    [reloadUser],
  );

  // Re-sync whenever the screen gains focus (e.g. returning from Settings).
  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  if (!user) return null;

  const primary = user.email ?? user.phone ?? 'your account';

  return (
    <Screen
      variant="content"
      edges={['bottom']}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} colors={[colors.primary]} />
      }>
      <View style={styles.stack}>
        <View style={styles.hero}>
          <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
            <AppText variant="title" tone="primary">
              {primary.replace(/^\+/, '').charAt(0).toUpperCase()}
            </AppText>
          </View>
          <View style={styles.heroText}>
            <AppText variant="title">You’re signed in</AppText>
            <AppText tone="muted" numberOfLines={1}>
              {primary}
            </AppText>
          </View>
        </View>

        {error ? <Banner message={error} actionLabel="Retry" onAction={() => load(true)} /> : null}

        <Card title="Sign-in details">
          <Row
            label="Email"
            value={user.email ?? 'Not added'}
            badge={user.email ? verifiedBadge(user.emailVerified) : undefined}
          />
          <Row
            label="Phone"
            value={user.phone ?? 'Not added'}
            badge={user.phone ? verifiedBadge(user.phoneVerified) : undefined}
            last
          />
        </Card>

        <Card title="Account">
          <Row label="Status" value={STATUS_LABELS[user.status] ?? user.status} />
          <Row label="Member since" value={formatMemberSince(user.createdAt)} last />
        </Card>

        <Button label="Settings & security" variant="secondary" onPress={() => router.push('/settings')} />
      </View>
    </Screen>
  );
}

function verifiedBadge(verified: boolean) {
  return verified ? ({ label: 'Verified', tone: 'success' } as const) : ({ label: 'Unverified', tone: 'muted' } as const);
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  heroText: { flex: 1, gap: 2 },
});
