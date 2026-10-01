import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getProfileDetail } from '@/api/endpoints/discovery';
import { blockUser } from '@/api/endpoints/safety';
import { ErrorCode, errorMessage, isApiError } from '@/api/errors';
import type { DiscoveryCard } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Icon } from '@/components/Icon';
import { PhotoDots } from '@/components/PhotoDots';
import { ProfilePhotoView } from '@/components/ProfilePhotoView';
import { RoundIconButton } from '@/components/RoundIconButton';
import { Sheet } from '@/components/Sheet';
import { StatusScreen } from '@/components/StatusScreen';
import { SwipeActions } from '@/components/SwipeActions';
import { env } from '@/config/env';
import { actionButtons, discoveryQueue, useDiscoveryQueue } from '@/features/discovery/queue';
import { CardSummary } from '@/features/discovery/SwipeCard';
import { BLOCKS_KEY } from '@/features/safety/useBlocks';
import { t } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';

/**
 * Screen 19 — Profile detail. Photos, verified chips, bio, prompts and
 * interests (shared ones in pink). Pass / like float at the bottom; the menu
 * offers Report and Block. 404 → "no longer available" and the card leaves the queue.
 */
export default function ProfileDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ userId: string; name?: string }>();
  const userId = String(params.userId);
  const profile = useQuery({ queryKey: ['profileDetail', userId], queryFn: () => getProfileDetail(userId), retry: false });
  const [photo, setPhoto] = useState(0);
  const [menu, setMenu] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gone = isApiError(profile.error) && [ErrorCode.UserNotFound, ErrorCode.ProfileNotFound].includes(profile.error.code as never);
  useEffect(() => {
    if (gone) discoveryQueue.drop(userId);
  }, [gone, userId]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const queued = useDiscoveryQueue((s) => s.cards.find((c) => c.userId === userId));
  const act = (kind: 'like' | 'pass') => {
    const card: DiscoveryCard | undefined = queued ?? profile.data;
    if (card) void (kind === 'like' ? discoveryQueue.like(card) : discoveryQueue.pass(card));
    back();
  };

  if (gone) {
    return <StatusScreen icon="account-off-outline" title={t('profileDetail.goneTitle')} message={t('profileDetail.goneBody')} action={{ label: t('profileDetail.back'), onPress: back }} />;
  }
  if (profile.isPending) {
    return (
      <SafeAreaView style={[styles.flex, styles.centre, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }
  if (profile.isError || !profile.data) {
    return <StatusScreen icon="alert-circle-outline" title={t('profileDetail.loadError')} message={errorMessage(profile.error)} action={{ label: t('common.tryAgain'), onPress: () => void profile.refetch() }} secondaryAction={{ label: t('profileDetail.back'), onPress: back }} />;
  }

  const p = profile.data;
  const name = p.name;
  const showPhoto = (next: number) => {
    const clamped = Math.max(0, Math.min(p.photos.length - 1, next));
    if (clamped === photo) return;
    setPhoto(clamped);
    AccessibilityInfo.announceForAccessibility(t('discover.photoOf', { index: clamped + 1, count: p.photos.length }));
  };

  const block = async () => {
    setBlocking(true);
    setError(null);
    try {
      await blockUser(userId);
      void queryClient.invalidateQueries({ queryKey: BLOCKS_KEY });
      discoveryQueue.drop(userId);
      setConfirmBlock(false);
      back();
    } catch (err) {
      setError(errorMessage(err));
      setConfirmBlock(false);
    } finally {
      setBlocking(false);
    }
  };

  const current = p.photos[photo];
  const heroHeight = Math.min(width * 1.15, 560);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}>
        <Pressable
          accessibilityLabel={t('discover.cardLabel', { name, age: p.age, city: p.city })}
          accessibilityActions={p.photos.length > 1 ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
          accessibilityRole="adjustable"
          onAccessibilityAction={(e) => showPhoto(photo + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
          onPress={(e) => showPhoto(photo + (e.nativeEvent.locationX > width / 2 ? 1 : -1))}
          style={[styles.hero, { height: heroHeight }]}>
          {current ? <ProfilePhotoView photo={current} size="large" /> : null}
          <LinearGradient colors={[colors.photoScrimClear, colors.photoScrim]} locations={[0.5, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <View style={[styles.heroInfo]} pointerEvents="none">
            <CardSummary card={p} verified={p.badges.includes('live_verified')} />
          </View>
        </Pressable>
        <View style={[styles.topBar, { top: insets.top + spacing.xs }]}>
          <View style={styles.dots}>
            <PhotoDots count={p.photos.length} index={photo} />
          </View>
          <View style={styles.topButtons}>
            <RoundIconButton icon="chevron-left" label={t('profileDetail.back')} onPress={back} onPhoto />
            <RoundIconButton icon="dots-horizontal" label={t('profileDetail.menu', { name })} onPress={() => setMenu(true)} onPhoto />
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.chips}>
            {p.badges.includes('live_verified') ? <Badge icon="check" label={t('profileDetail.liveVerified')} /> : null}
            {p.badges.includes('id_verified') ? <Badge icon="shield-check-outline" label={t('profileDetail.idVerified')} /> : null}
          </View>
          {p.bio ? <AppText>{p.bio}</AppText> : null}
          {p.prompts.map((prompt, i) => (
            <View key={prompt.question} style={[styles.prompt, { backgroundColor: i === 0 ? colors.primary : colors.surface }]}>
              <AppText variant="label" tone={i === 0 ? 'onPrimaryMuted' : 'primary'}>
                {prompt.question}
              </AppText>
              <AppText variant="title" tone={i === 0 ? 'onPrimary' : 'default'}>
                {prompt.answer}
              </AppText>
            </View>
          ))}
          {p.interests.length ? (
            <View style={styles.block}>
              <AppText variant="heading">{t('profileDetail.interests')}</AppText>
              <View style={styles.interestRow}>
                {p.interests.map((i) => (
                  <View
                    key={i.id}
                    accessible
                    accessibilityLabel={i.shared ? t('profileDetail.sharedInterest', { name: i.name }) : i.name}
                    style={[styles.interest, { backgroundColor: i.shared ? colors.primary : colors.background, borderColor: i.shared ? colors.primary : colors.borderStrong }]}>
                    <AppText variant="label" tone={i.shared ? 'onPrimary' : 'default'}>
                      {i.name}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {error ? <Banner message={error} /> : null}
        </View>
      </ScrollView>

      <View style={[styles.floating, { paddingBottom: insets.bottom + spacing.md }]} pointerEvents="box-none">
        <SwipeActions actions={actionButtons(env.featureSuperLike)} name={name} onPass={() => act('pass')} onLike={() => act('like')} onSuperLike={() => act('like')} />
      </View>

      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <View style={styles.sheet}>
          <MenuRow
            icon="flag-outline"
            title={t('profileDetail.report', { name })}
            hint={t('profileDetail.reportHint', { name })}
            onPress={() => {
              setMenu(false);
              router.push({ pathname: '/report/[userId]', params: { userId, name } });
            }}
          />
          <MenuRow
            icon="cancel"
            title={t('profileDetail.block', { name })}
            hint={t('profileDetail.blockHint')}
            destructive
            onPress={() => {
              setMenu(false);
              setConfirmBlock(true);
            }}
          />
        </View>
      </Sheet>
      <ConfirmDialog
        visible={confirmBlock}
        title={t('profileDetail.blockTitle', { name })}
        message={t('profileDetail.blockBody')}
        confirmLabel={t('profileDetail.blockConfirm')}
        destructive
        loading={blocking}
        loadingLabel={t('profileDetail.blocking')}
        onConfirm={block}
        onCancel={() => setConfirmBlock(false)}
      />
    </View>
  );
}

function Badge({ icon, label }: { icon: 'check' | 'shield-check-outline'; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { borderColor: colors.borderStrong }]}>
      <Icon name={icon} size={16} />
      <AppText variant="label">{label}</AppText>
    </View>
  );
}

function MenuRow({ icon, title, hint, onPress, destructive }: { icon: 'flag-outline' | 'cancel'; title: string; hint: string; onPress: () => void; destructive?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={hint} onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.surface }]}>
      <Icon name={icon} size={24} color={destructive ? 'danger' : 'text'} />
      <View style={styles.flex}>
        <AppText style={[typography.body, styles.menuTitle]} tone={destructive ? 'danger' : 'default'}>
          {title}
        </AppText>
        <AppText variant="label" tone="muted" style={styles.regular}>
          {hint}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centre: { alignItems: 'center', justifyContent: 'center' },
  hero: { overflow: 'hidden' },
  heroInfo: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md },
  topBar: { position: 'absolute', left: spacing.md, right: spacing.md, gap: spacing.sm },
  dots: { paddingHorizontal: spacing.xs },
  topButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  body: { padding: spacing.md, gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  prompt: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.xxs },
  block: { gap: spacing.sm },
  interestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  interest: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  floating: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: spacing.sm },
  sheet: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.xxs },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingHorizontal: spacing.xs, borderRadius: 12 },
  menuTitle: { fontFamily: typography.label.fontFamily },
  regular: { fontFamily: typography.body.fontFamily },
});
