import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { DiscoveryCard } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { PhotoDots } from '@/components/PhotoDots';
import { ProfilePhotoView } from '@/components/ProfilePhotoView';
import { t } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';

interface Props {
  card: DiscoveryCard;
  onLike: () => void;
  onPass: () => void;
  onOpen: () => void;
}

const SWIPE_FRACTION = 0.3;
const FLING_VELOCITY = 800;
const MAX_TILT_DEG = 12;

/**
 * Deck 18 card. Swipe right = like, left = pass, with spring physics on the
 * UI thread; the card tilts while dragging. Tap the left/right third to
 * change photo, the middle to open the profile. Reduce motion: no tilt, no spring.
 */
export function SwipeCard({ card, onLike, onPass, onOpen }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [photo, setPhoto] = useState(0);
  const width = useSharedValue(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const count = card.photos.length;

  const showPhoto = (next: number) => {
    const clamped = Math.max(0, Math.min(count - 1, next));
    if (clamped === photo) return;
    setPhoto(clamped);
    AccessibilityInfo.announceForAccessibility(t('discover.photoOf', { index: clamped + 1, count }));
  };
  const onTap = (x: number, w: number) => {
    if (w <= 0) return onOpen();
    if (x < w * 0.3) showPhoto(photo - 1);
    else if (x > w * 0.7) showPhoto(photo + 1);
    else onOpen();
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      'worklet';
      tx.value = e.translationX;
      ty.value = e.translationY * 0.2;
    })
    .onEnd((e) => {
      'worklet';
      const w = width.value || 1;
      const goRight = e.translationX > w * SWIPE_FRACTION || e.velocityX > FLING_VELOCITY;
      const goLeft = e.translationX < -w * SWIPE_FRACTION || e.velocityX < -FLING_VELOCITY;
      if (goRight || goLeft) {
        tx.value = withTiming((goRight ? 1 : -1) * w * 1.5, { duration: reduceMotion ? 120 : 220 }, (done) => {
          if (done) scheduleOnRN(goRight ? onLike : onPass);
        });
      } else {
        tx.value = reduceMotion ? withTiming(0, { duration: 120 }) : withSpring(0, { damping: 15, stiffness: 180 });
        ty.value = reduceMotion ? withTiming(0, { duration: 120 }) : withSpring(0);
      }
    });

  const tap = Gesture.Tap().onEnd((e) => {
    'worklet';
    scheduleOnRN(onTap, e.x, width.value);
  });

  const animated = useAnimatedStyle(() => {
    const w = width.value || 1;
    const rotate = reduceMotion ? 0 : (tx.value / w) * MAX_TILT_DEG;
    return { transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotate: `${rotate}deg` }] };
  });

  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'activate') onOpen();
    else if (e.nativeEvent.actionName === 'like') onLike();
    else if (e.nativeEvent.actionName === 'pass') onPass();
    else if (e.nativeEvent.actionName === 'nextPhoto') showPhoto(photo + 1);
    else if (e.nativeEvent.actionName === 'previousPhoto') showPhoto(photo - 1);
  };

  const current = card.photos[photo];
  const verified = card.badges.includes('live_verified');

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <Animated.View
        onLayout={(e: LayoutChangeEvent) => width.set(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('discover.cardLabel', { name: card.name, age: card.age, city: card.city })}
        accessibilityHint={t('discover.cardHint')}
        accessibilityActions={[
          { name: 'activate' },
          { name: 'like', label: t('discover.likeLabel', { name: card.name }) },
          { name: 'pass', label: t('discover.passLabel', { name: card.name }) },
          ...(count > 1 ? [{ name: 'nextPhoto', label: t('discover.photoOf', { index: Math.min(count, photo + 2), count }) }] : []),
        ]}
        onAccessibilityAction={onAction}
        style={[styles.card, { backgroundColor: colors.surface, boxShadow: colors.shadowCard }, animated]}>
        {current ? <ProfilePhotoView photo={current} size="medium" /> : null}
        <View style={styles.dots}>
          <PhotoDots count={count} index={photo} />
        </View>
        <LinearGradient colors={[colors.photoScrimClear, colors.photoScrim]} locations={[0.45, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={styles.info} pointerEvents="none">
          <CardSummary card={card} verified={verified} />
          {card.topPrompt ? (
            <View style={[styles.prompt, { backgroundColor: colors.photoPromptBox }]}>
              <AppText variant="caption" style={{ color: colors.onPhotoMuted }}>
                {card.topPrompt.question}
              </AppText>
              <AppText style={[typography.body, { color: colors.onPhoto }]} numberOfLines={3}>
                {card.topPrompt.answer}
              </AppText>
            </View>
          ) : null}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Name + age + tick and the city / distance pills (deck 18, 19). */
export function CardSummary({ card, verified }: { card: DiscoveryCard; verified: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.summary}>
      <View style={styles.nameRow}>
        <AppText variant="hero" style={{ color: colors.onPhoto }} numberOfLines={1}>
          {card.name}
        </AppText>
        <AppText style={[typography.title, styles.age, { color: colors.onPhoto }]}>{card.age}</AppText>
        {verified ? (
          <View accessibilityLabel={t('discover.verified')}>
            <Icon name="check-decagram" size={24} color="primary" />
          </View>
        ) : null}
      </View>
      <View style={styles.pills}>
        <View style={[styles.pill, { backgroundColor: colors.photoPill, borderColor: colors.photoPillBorder }]}>
          <Icon name="map-marker-outline" size={16} color="onPhoto" />
          <AppText variant="label" style={{ color: colors.onPhoto }}>
            {card.city}
          </AppText>
        </View>
        <View style={[styles.pill, { backgroundColor: colors.photoPill, borderColor: colors.photoPillBorder }]}>
          <AppText variant="label" style={{ color: colors.onPhoto }}>
            {t(`distance.${card.distanceBucket}`)}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: radius.lg, overflow: 'hidden' },
  dots: { position: 'absolute', top: spacing.sm, left: spacing.md, right: spacing.md },
  info: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, gap: spacing.sm },
  summary: { gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  age: { fontFamily: typography.body.fontFamily },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  prompt: { borderRadius: radius.md, padding: spacing.sm, gap: 2 },
});
