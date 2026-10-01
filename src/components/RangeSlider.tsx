import { useEffect, useState } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/theme';

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  /** One value (single thumb) or [low, high] (two thumbs; low ≤ high). */
  values: readonly [number] | readonly [number, number];
  /** Called with snapped values whenever they change, while dragging too. */
  onChange: (values: number[]) => void;
  /** Screen-reader name per thumb, e.g. ["Minimum age", "Maximum age"]. */
  thumbLabels: readonly string[];
  /** Read aloud for each thumb's value, e.g. (v) => `${v} years`. */
  formatValue: (value: number) => string;
}

const THUMB = 28;
const TRACK = 6;
const TOUCH_HEIGHT = 44;

/**
 * Deck 14 slider: grey track, pink fill, white thumbs ringed in pink.
 * Gestures run on the UI thread (Reanimated); React only hears about
 * snapped values. Each thumb is an "adjustable" control for TalkBack.
 */
export function RangeSlider({ min, max, step = 1, values, onChange, thumbLabels, formatValue }: RangeSliderProps) {
  const { colors } = useTheme();
  const isRange = values.length === 2;
  const width = useSharedValue(0);
  // Also kept in state: inside a Modal the first layout can arrive before the
  // UI thread is ready, so the animated styles are rebuilt when it changes.
  const [trackWidth, setTrackWidth] = useState(0);
  const low = useSharedValue(values[0]);
  const high = useSharedValue(isRange ? values[1] : values[0]);
  const dragging = useSharedValue(false);
  // Where each thumb was when its drag began (shared with the UI thread).
  const startLow = useSharedValue(0);
  const startHigh = useSharedValue(0);

  // Follow outside changes (accessibility actions, resets) when not dragging.
  useEffect(() => {
    if (dragging.value) return;
    low.value = values[0];
    high.value = values.length === 2 ? values[1] : values[0];
  }, [values, low, high, dragging]);

  const emit = (index: number, value: number) => {
    const next = [...values];
    next[index] = value;
    onChange(next);
  };

  const makePan = (index: 0 | 1) => {
    const start = index === 0 ? startLow : startHigh;
    return Gesture.Pan()
      .hitSlop({ horizontal: 12, vertical: 12 })
      .onBegin(() => {
        'worklet';
        dragging.value = true;
        start.value = index === 0 ? low.value : high.value;
      })
      .onUpdate((e) => {
        'worklet';
        if (width.value <= 0) return;
        const raw = start.value + (e.translationX / width.value) * (max - min);
        const lower = index === 1 ? low.value : min;
        const upper = index === 0 && isRange ? high.value : max;
        const snapped = Math.min(upper, Math.max(lower, Math.round((raw - min) / step) * step + min));
        const current = index === 0 ? low.value : high.value;
        if (snapped === current) return;
        if (index === 0) low.value = snapped;
        else high.value = snapped;
        scheduleOnRN(emit, index, snapped);
      })
      .onFinalize(() => {
        'worklet';
        dragging.value = false;
      });
  };

  const lowPan = makePan(0);
  const highPan = makePan(1);

  const toX = (v: number) => {
    'worklet';
    return ((v - min) / (max - min)) * width.value;
  };

  const fillStyle = useAnimatedStyle(() => {
    const start = isRange ? toX(low.value) : 0;
    const end = isRange ? toX(high.value) : toX(low.value);
    return { left: start, width: Math.max(0, end - start) };
  }, [trackWidth]);
  const lowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: toX(low.value) - THUMB / 2 }] }), [trackWidth]);
  const highStyle = useAnimatedStyle(() => ({ transform: [{ translateX: toX(high.value) - THUMB / 2 }] }), [trackWidth]);

  const adjust = (index: 0 | 1) => (e: AccessibilityActionEvent) => {
    const delta = e.nativeEvent.actionName === 'increment' ? step : e.nativeEvent.actionName === 'decrement' ? -step : 0;
    if (!delta) return;
    const lower = index === 1 ? values[0] : min;
    const upper = index === 0 && values.length === 2 ? values[1] : max;
    emit(index, Math.min(upper, Math.max(lower, values[index]! + delta)));
  };

  const thumb = (index: 0 | 1) => (
    <GestureDetector gesture={index === 0 ? lowPan : highPan}>
      <Animated.View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={thumbLabels[index]}
        accessibilityValue={{ min, max, now: values[index], text: formatValue(values[index]!) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={adjust(index)}
        style={[styles.thumb, { backgroundColor: colors.background, borderColor: colors.primary }, index === 0 ? lowStyle : highStyle]}
      />
    </GestureDetector>
  );

  return (
    <View
      style={styles.container}
      onLayout={(e: LayoutChangeEvent) => {
        width.set(e.nativeEvent.layout.width);
        setTrackWidth(e.nativeEvent.layout.width);
      }}>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <Animated.View style={[styles.fill, { backgroundColor: colors.primary }, fillStyle]} />
      </View>
      {thumb(0)}
      {isRange ? thumb(1) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: TOUCH_HEIGHT, justifyContent: 'center', marginHorizontal: THUMB / 2 },
  track: { height: TRACK, borderRadius: TRACK / 2, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: TRACK / 2 },
  thumb: {
    position: 'absolute',
    left: 0,
    top: (TOUCH_HEIGHT - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
  },
});
