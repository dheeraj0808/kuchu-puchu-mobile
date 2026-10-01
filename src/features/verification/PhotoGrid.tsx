import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Photo } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { t } from '@/i18n';
import { radius, spacing, typography, useTheme, type ColorPalette } from '@/theme';

import { PHOTO_SLOTS } from './photoRules';

export interface UploadingSlot {
  key: string;
  progress: number;
  cancel: () => void;
}

interface PhotoGridProps {
  photos: Photo[];
  uploads: UploadingSlot[];
  onAdd: () => void;
  onOpen: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}

const COLUMNS = 3;
const GAP = spacing.sm;
const ASPECT = 4 / 3;

/**
 * Deck 09 grid: 3 × 2 rounded tiles; the first photo is the main one. Long
 * press and drag to reorder (UI thread). Every tile also offers "Move left /
 * Move right / Remove" as accessibility actions, so TalkBack users can
 * reorder without dragging.
 */
export function PhotoGrid({ photos, uploads, onAdd, onOpen, onMove, onRemove }: PhotoGridProps) {
  const [width, setWidth] = useState(0);
  const cell = width > 0 ? (width - GAP * (COLUMNS - 1)) / COLUMNS : 0;
  const empty = Math.max(0, PHOTO_SLOTS - photos.length - uploads.length);

  return (
    <View style={styles.grid} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {cell > 0 ? (
        <>
          {photos.map((photo, index) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              index={index}
              count={photos.length}
              size={cell}
              onOpen={() => onOpen(index)}
              onMove={onMove}
              onRemove={() => onRemove(index)}
            />
          ))}
          {uploads.map((u) => (
            <UploadTile key={u.key} upload={u} size={cell} />
          ))}
          {Array.from({ length: empty }, (_, i) => (
            <EmptyTile key={`empty-${i}`} position={photos.length + uploads.length + i + 1} size={cell} onPress={onAdd} />
          ))}
        </>
      ) : null}
    </View>
  );
}

function statusPill(photo: Photo, index: number): { label: string; icon: IconName; color: keyof ColorPalette } {
  if (photo.status === 'rejected') return { label: t('photos.rejected'), icon: 'alert-circle', color: 'danger' };
  if (photo.status === 'review') return { label: t('photos.inReview'), icon: 'clock-outline', color: 'primary' };
  return { label: index === 0 ? t('photos.main') : t('photos.approved'), icon: 'check-circle', color: 'primary' };
}

interface PhotoTileProps {
  photo: Photo;
  index: number;
  count: number;
  size: number;
  onOpen: () => void;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}

function PhotoTile({ photo, index, count, size, onOpen, onMove, onRemove }: PhotoTileProps) {
  const { colors } = useTheme();
  const height = size * ASPECT;
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const lifted = useSharedValue(0);
  const pill = statusPill(photo, index);

  const drag = Gesture.Pan()
    .activateAfterLongPress(250)
    .onStart(() => {
      'worklet';
      lifted.value = withSpring(1);
    })
    .onUpdate((e) => {
      'worklet';
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      'worklet';
      const dCol = Math.round(e.translationX / (size + GAP));
      const dRow = Math.round(e.translationY / (height + GAP));
      const target = Math.max(0, Math.min(count - 1, index + dCol + dRow * COLUMNS));
      if (target !== index) scheduleOnRN(onMove, index, target);
    })
    .onFinalize(() => {
      'worklet';
      tx.value = withSpring(0);
      ty.value = withSpring(0);
      lifted.value = withSpring(0);
    });

  const animated = useAnimatedStyle(() => ({
    zIndex: lifted.value > 0.01 ? 10 : 0,
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: 1 + lifted.value * 0.05 }],
  }));

  const actions = [
    ...(index > 0 ? [{ name: 'moveLeft', label: t('photos.moveLeft') }] : []),
    ...(index < count - 1 ? [{ name: 'moveRight', label: t('photos.moveRight') }] : []),
    { name: 'remove', label: t('photos.remove') },
  ];
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'moveLeft') onMove(index, index - 1);
    else if (e.nativeEvent.actionName === 'moveRight') onMove(index, index + 1);
    else if (e.nativeEvent.actionName === 'remove') onRemove();
    else if (e.nativeEvent.actionName === 'activate') onOpen();
  };

  return (
    <GestureDetector gesture={drag}>
      <Animated.View style={[{ width: size, height }, animated]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('photos.slotLabel', { position: index + 1, status: pill.label })}
          accessibilityActions={[{ name: 'activate' }, ...actions]}
          onAccessibilityAction={onAction}
          onPress={onOpen}
          style={[styles.tile, styles.fill, { backgroundColor: colors.surface }]}>
          <Image
            source={{ uri: photo.urls.thumb, cacheKey: `${photo.id}-thumb` }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
            accessible={false}
          />
          <View style={[styles.pill, { backgroundColor: colors.background }]}>
            <Icon name={pill.icon} size={14} color={pill.color} />
            <AppText style={[typography.caption, styles.pillText]} tone={photo.status === 'rejected' ? 'danger' : 'default'} maxFontSizeMultiplier={1.2}>
              {pill.label}
            </AppText>
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

function UploadTile({ upload, size }: { upload: UploadingSlot; size: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tile, styles.centered, { width: size, height: size * ASPECT, backgroundColor: colors.surface }]}>
      <AppText variant="caption" tone="muted">
        {t('photos.uploading')}
      </AppText>
      <View
        style={[styles.progressTrack, { backgroundColor: colors.border }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('photos.uploading')}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(upload.progress * 100) }}>
        <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.round(upload.progress * 100)}%` }]} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('photos.cancelUpload')} onPress={upload.cancel} hitSlop={12} style={styles.cancel}>
        <Icon name="close-circle" size={24} color="textMuted" />
      </Pressable>
    </View>
  );
}

function EmptyTile({ position, size, onPress }: { position: number; size: number; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('photos.emptySlot', { position })}
      accessibilityHint={t('photos.addPhoto')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        styles.centered,
        styles.empty,
        { width: size, height: size * ASPECT, borderColor: colors.primaryBorder, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Icon name="plus" size={30} color="primary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  // No flex here: tiles have a fixed width so the row wraps into 3 columns.
  tile: { borderRadius: radius.md, overflow: 'hidden' },
  fill: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.sm },
  empty: { borderWidth: 2, borderStyle: 'dashed' },
  pill: {
    position: 'absolute',
    left: spacing.xs,
    bottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },
  pillText: { fontFamily: typography.label.fontFamily },
  progressTrack: { alignSelf: 'stretch', height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  cancel: { position: 'absolute', top: spacing.xs, right: spacing.xs },
});
