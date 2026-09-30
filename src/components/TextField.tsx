import { useState, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { radius, spacing, typography, useTheme } from '@/theme';

import { AppText } from './AppText';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
  ref?: Ref<TextInput>;
}

export function TextField({ label, error, hint, editable = true, onFocus, onBlur, style, ref, ...rest }: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;
  const helper = error ?? hint;

  return (
    <View style={styles.container}>
      <AppText variant="label" style={styles.label} nativeID={`${label}-label`}>
        {label}
      </AppText>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={hint}
        aria-invalid={!!error}
        editable={editable}
        placeholderTextColor={colors.textSubtle}
        selectionColor={colors.primary}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          typography.body,
          {
            color: colors.text,
            backgroundColor: editable ? colors.background : colors.surface,
            borderColor,
            borderWidth: focused || error ? 2 : 1,
          },
          style,
        ]}
        {...rest}
      />
      {helper ? (
        <AppText
          variant="caption"
          tone={error ? 'danger' : 'muted'}
          style={styles.helper}
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          role={error ? 'alert' : undefined}>
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch' },
  label: { marginBottom: spacing.xs },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  helper: { marginTop: spacing.xs },
});
