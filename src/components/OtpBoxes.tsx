import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { activeIndex } from '@/features/auth/otpCode';
import { t } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';

import { AppText } from './AppText';

interface OtpBoxesProps {
  value: string;
  length: number;
  invalid?: boolean;
  disabled?: boolean;
  /** Increment to play the wrong-code shake. */
  shakeKey?: number;
  /** Long-press / accessibility "paste" action. */
  onPaste?: () => void;
}

/**
 * Deck 03 code boxes. Display only: digits come from the keypad, paste or
 * SMS autofill. Filled boxes have a pink border; the next box is highlighted.
 */
export function OtpBoxes({ value, length, invalid, disabled, shakeKey = 0, onPaste }: OtpBoxesProps) {
  const { colors } = useTheme();
  const [shake] = useState(() => new Animated.Value(0));
  const active = activeIndex(value, length);

  useEffect(() => {
    if (shakeKey === 0) return;
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 8, -8, 4, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 50, useNativeDriver: true })),
    ).start();
  }, [shakeKey, shake]);

  return (
    <Pressable
      onLongPress={onPaste}
      disabled={disabled}
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('verify.boxesLabel', { length })}
      accessibilityValue={{ text: t('verify.boxesValue', { count: value.length, length }) }}
      accessibilityHint={onPaste ? t('verify.pasteHint') : undefined}
      accessibilityActions={onPaste ? [{ name: 'paste', label: t('verify.paste') }] : undefined}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'paste' && onPaste?.()}>
      <Animated.View style={[styles.row, { transform: [{ translateX: shake }] }]}>
        {Array.from({ length }, (_, i) => {
          const digit = value[i] ?? '';
          const isActive = !disabled && i === active && value.length < length;
          const borderColor = invalid ? colors.danger : digit || isActive ? colors.primary : colors.primaryBorder;
          return (
            <View
              key={i}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              style={[
                styles.box,
                {
                  borderColor,
                  borderWidth: isActive ? 2 : 1.5,
                  backgroundColor: colors.background,
                  opacity: disabled ? 0.6 : 1,
                },
              ]}>
              <AppText style={typography.title} maxFontSizeMultiplier={1.3}>
                {digit}
              </AppText>
            </View>
          );
        })}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, alignSelf: 'stretch' },
  box: {
    flex: 1,
    maxWidth: 52,
    aspectRatio: 0.9,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
