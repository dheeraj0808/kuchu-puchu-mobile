import { useState, type Ref } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  ref?: Ref<TextInput>;
}

/**
 * One real TextInput under N visual cells. Typing advances, backspace moves
 * back, and pasted or SMS/keychain-autofilled codes ("123 456", "123-456")
 * fill every cell at once — without the focus juggling of N separate inputs.
 */
export function OtpInput({ value, onChange, length, disabled, invalid, autoFocus, ref }: OtpInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <Pressable
      onPress={() => {
        if (ref && typeof ref === 'object') ref.current?.focus();
      }}
      disabled={disabled}
      style={styles.row}
      importantForAccessibility="no">
      {Array.from({ length }, (_, i) => {
        const char = value[i] ?? '';
        const isActive = focused && !disabled && i === activeIndex;
        return (
          <View
            key={i}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[
              styles.cell,
              {
                backgroundColor: disabled ? colors.surfaceMuted : colors.surface,
                borderColor: invalid ? colors.danger : isActive ? colors.primary : char ? colors.borderStrong : colors.border,
                borderWidth: isActive || invalid ? 2 : 1,
              },
            ]}>
            <AppText style={styles.digit}>{char}</AppText>
            {isActive && !char ? <View style={[styles.caret, { backgroundColor: colors.primary }]} /> : null}
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        autoCorrect={false}
        caretHidden
        contextMenuHidden={false}
        accessibilityLabel={`Verification code, ${length} digits`}
        accessibilityValue={{ text: value ? `${value.length} of ${length} digits entered` : 'empty' }}
        aria-invalid={invalid}
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs, alignSelf: 'stretch' },
  cell: {
    flex: 1,
    maxWidth: 56,
    aspectRatio: 0.86,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 24, lineHeight: 30, fontWeight: '600', fontVariant: ['tabular-nums'] },
  caret: { position: 'absolute', width: 2, height: 24, borderRadius: 1 },
  // Covers the cells so taps focus it and OS autofill can target it. Kept
  // (nearly) invisible rather than opacity 0, which breaks iOS autofill.
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    color: 'transparent',
    backgroundColor: 'transparent',
    opacity: 0.02,
    fontSize: 1,
  },
});
