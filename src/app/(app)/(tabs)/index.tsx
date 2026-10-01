import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { PlusPill } from '@/components/PlusPill';
import { RoundIconButton } from '@/components/RoundIconButton';
import { Sheet } from '@/components/Sheet';
import { SwipeActions } from '@/components/SwipeActions';
import { Wordmark } from '@/components/Wordmark';
import { env } from '@/config/env';
import { applyPreferences, widenedDistance } from '@/features/discovery/applyPreferences';
import { CardSkeleton, NotReadyList, RadarIllustration } from '@/features/discovery/DiscoverViews';
import { FiltersSheet } from '@/features/discovery/FiltersSheet';
import { actionButtons, discoveryQueue, useDiscoveryQueue } from '@/features/discovery/queue';
import { SwipeCard } from '@/features/discovery/SwipeCard';
import { DEFAULT_DISTANCE_KM } from '@/features/onboarding/preferences';
import { useCountdown } from '@/hooks/useCountdown';
import { t } from '@/i18n';
import { formatDuration } from '@/lib/identifier';
import { layout, spacing, useTheme } from '@/theme';

type Info = 'boost' | 'plus' | null;

/**
 * Screen 18 — Discover (and 25, the empty state). One card at a time from the
 * Zustand queue; like and pass are buttons as well as swipes.
 */
export default function DiscoverScreen() {
  const { colors } = useTheme();
  const { user, reloadUser } = useAuth();
  const queue = useDiscoveryQueue();
  const [filters, setFilters] = useState(false);
  const [info, setInfo] = useState<Info>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (useDiscoveryQueue.getState().status === 'idle') void discoveryQueue.load();
  }, []);

  const top = queue.cards[0];
  const next = queue.cards[1];
  const distance = user?.preferences?.maxDistanceKm ?? DEFAULT_DISTANCE_KM;
  const widenTo = widenedDistance(distance);
  const empty = queue.status === 'empty' && !top;

  const widen = async () => {
    if (!user?.preferences) return;
    setBusy(true);
    try {
      await applyPreferences({ ...user.preferences, maxDistanceKm: widenTo }, { reloadUser });
    } finally {
      setBusy(false);
    }
  };
  const fixUp = async () => {
    setBusy(true);
    try {
      await reloadUser().catch(() => undefined); // The gate re-routes if onboarding is incomplete.
      await discoveryQueue.flush();
    } finally {
      setBusy(false);
    }
  };
  const openProfile = (userId: string, name: string) => router.push({ pathname: '/people/[userId]', params: { userId, name } });

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.column, styles.header]}>
        <View style={styles.flex}>
          <Wordmark size="medium" />
        </View>
        {!empty ? <RoundIconButton icon="lightning-bolt" color="primary" label={t('discover.boost')} onPress={() => setInfo('boost')} /> : null}
        <RoundIconButton icon="tune-variant" label={t('discover.filters')} onPress={() => setFilters(true)} />
      </View>

      <View style={[styles.column, styles.flex]}>
        {queue.status === 'notReady' ? (
          <ScrollView contentContainerStyle={styles.scroll}>
            <NotReadyList missing={queue.missing} onFinish={fixUp} busy={busy} />
          </ScrollView>
        ) : queue.status === 'error' && !top ? (
          <View style={styles.centre}>
            <Banner message={queue.error ?? t('discover.loadError')} actionLabel={t('common.tryAgain')} onAction={() => void discoveryQueue.load()} />
          </View>
        ) : empty ? (
          <ScrollView contentContainerStyle={[styles.scroll, styles.emptyScroll]}>
            <RadarIllustration />
            <View style={styles.copy}>
              <AppText variant="display" align="center">
                {t('empty.title')}
              </AppText>
              <AppText tone="muted" align="center">
                {t('empty.body')}
              </AppText>
            </View>
            <View style={styles.actions}>
              {distance < 200 ? <Button label={t('empty.widen', { km: widenTo })} loading={busy} onPress={widen} /> : null}
              <Button variant="secondary" label={t('empty.changeAge')} disabled={busy} onPress={() => setFilters(true)} />
            </View>
          </ScrollView>
        ) : (
          <>
            <View style={styles.stack}>
              {!top ? (
                <CardSkeleton />
              ) : (
                <>
                  {next ? (
                    <View style={[StyleSheet.absoluteFill, styles.behind]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden pointerEvents="none">
                      <SwipeCard key={next.userId} card={next} onLike={() => undefined} onPass={() => undefined} onOpen={() => undefined} />
                    </View>
                  ) : null}
                  <SwipeCard
                    key={top.userId}
                    card={top}
                    onLike={() => void discoveryQueue.like(top)}
                    onPass={() => void discoveryQueue.pass(top)}
                    onOpen={() => openProfile(top.userId, top.name)}
                  />
                </>
              )}
            </View>
            {queue.notice ? <Banner message={queue.notice} /> : null}
            <View style={styles.buttons}>
              <SwipeActions
                actions={actionButtons(env.featureSuperLike)}
                name={top?.name ?? ''}
                disabled={!top}
                onPass={() => top && void discoveryQueue.pass(top)}
                onLike={() => top && void discoveryQueue.like(top)}
                onSuperLike={() => top && void discoveryQueue.like(top)}
              />
            </View>
          </>
        )}
      </View>

      <FiltersSheet
        visible={filters}
        onClose={() => setFilters(false)}
        onLocked={() => {
          setFilters(false);
          setInfo('plus');
        }}
      />
      <InfoSheet info={info} onClose={() => setInfo(null)} />
      <QueueSheets />
    </SafeAreaView>
  );
}

function InfoSheet({ info, onClose }: { info: Info; onClose: () => void }) {
  return (
    <Sheet visible={info !== null} onClose={onClose}>
      <View style={styles.sheet}>
        {info === 'plus' ? <PlusPill align="start" /> : null}
        <AppText variant="title">{info === 'plus' ? t('preferences.paywallTitle') : t('discover.boostTitle')}</AppText>
        <AppText tone="muted">{info === 'plus' ? t('preferences.paywallBody') : t('discover.boostBody')}</AppText>
        <Button label={t('common.done')} onPress={onClose} />
      </View>
    </Sheet>
  );
}

/** Placeholders for screens 21 (It's a match) and 22 (Out of likes), coming in part 2. */
function QueueSheets() {
  const sheet = useDiscoveryQueue((s) => s.sheet);
  const retryAfter = sheet?.kind === 'outOfLikes' ? sheet.retryAfterSeconds : null;
  return (
    <Sheet visible={sheet !== null} onClose={discoveryQueue.closeSheet}>
      <View style={styles.sheet}>
        {sheet?.kind === 'match' ? (
          <>
            <AppText variant="display">{t('discover.matchTitle')}</AppText>
            <AppText tone="muted">{t('discover.matchBody', { name: sheet.card.name })}</AppText>
            <AppText variant="label" tone="subtle">
              {t('discover.comingSoonChat')}
            </AppText>
            <Button label={t('discover.sendMessage')} onPress={discoveryQueue.closeSheet} />
            <Button variant="plain" label={t('discover.keepBrowsing')} onPress={discoveryQueue.closeSheet} />
          </>
        ) : sheet?.kind === 'outOfLikes' ? (
          <OutOfLikes key={String(retryAfter)} retryAfterSeconds={retryAfter} />
        ) : null}
      </View>
    </Sheet>
  );
}

function OutOfLikes({ retryAfterSeconds }: { retryAfterSeconds: number | null }) {
  const [until] = useState(() => (retryAfterSeconds ? Date.now() + retryAfterSeconds * 1000 : null));
  const left = useCountdown(until);
  return (
    <>
      <AppText variant="display">{t('discover.outOfLikesTitle')}</AppText>
      <AppText tone="muted">{left ? t('discover.outOfLikesBody', { time: formatHms(left) }) : t('discover.outOfLikesSoon')}</AppText>
      <Button label={t('discover.ok')} onPress={discoveryQueue.closeSheet} />
    </>
  );
}

/** "06:42:10" (deck 22). */
export function formatHms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  return h > 0 ? `${String(h).padStart(2, '0')}:${formatDuration(seconds % 3600).padStart(5, '0')}` : formatDuration(seconds);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingHorizontal: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  stack: { flex: 1 },
  behind: { transform: [{ scale: 0.96 }, { translateY: 8 }], opacity: 0.9 },
  buttons: { paddingVertical: spacing.md },
  centre: { flex: 1, justifyContent: 'center' },
  scroll: { flexGrow: 1, paddingVertical: spacing.lg },
  emptyScroll: { justifyContent: 'center', gap: spacing.lg },
  copy: { gap: spacing.xs },
  actions: { gap: spacing.sm },
  sheet: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.md },
});
