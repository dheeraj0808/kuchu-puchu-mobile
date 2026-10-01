import { useState, type Ref } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { fonts, radius, spacing, typography, useTheme } from '@/theme';

import { AppText } from './AppText';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
  /** Fixed text inside the field before the input, e.g. "+91" (deck 02). */
  prefix?: string;
  ref?: Ref<TextInput>;
}

export function TextField({ label, error, hint, prefix, editable = true, onFocus, onBlur, style, ref, ...rest }: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const hasValue = typeof rest.value === 'string' && rest.value.length > 0;
  const borderColor = error ? colors.danger : focused || hasValue ? colors.primary : colors.primaryBorder;
  const helper = error ?? hint;

  return (
    <View style={styles.container}>
      <AppText variant="label" style={styles.label}>
        {label}
      </AppText>
      <View
        style={[
          styles.field,
          {
            backgroundColor: editable ? colors.background : colors.surface,
            borderColor,
            borderWidth: 1.5,
          },
        ]}>
        {prefix ? (
          <View style={[styles.prefix, { borderRightColor: colors.border }]} importantForAccessibility="no">
            <AppText style={[typography.body, { fontFamily: fonts.semibold }]}>{prefix}</AppText>
          </View>
        ) : null}
        <TextInput
          ref={ref}
          accessibilityLabel={prefix ? `${label}, ${prefix}` : label}
          accessibilityHint={hint}
          aria-invalid={!!error}
          editable={editable}
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.primary}
          maxFontSizeMultiplier={1.6}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, typography.body, { color: colors.text }, style]}
          {...rest}
        />
      </View>
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
  field: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderRadius: radius.sm, overflow: 'hidden' },
  prefix: { paddingLeft: spacing.md, paddingRight: spacing.sm, borderRightWidth: 1.5, marginVertical: spacing.sm + 2 },
  input: {
    flex: 1,
    // Lets the input shrink inside the row instead of pushing past the border.
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    // Web only: drop the browser focus ring; the field's own border shows focus.
    ...Platform.select({ web: { outlineColor: 'transparent', outlineWidth: 0 } }),
  },
  helper: { marginTop: spacing.xs },
});
