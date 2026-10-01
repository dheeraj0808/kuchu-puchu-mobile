import { useState, type Ref } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { t } from '@/i18n';
import { fonts, radius, spacing, typography, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
  /** Fixed text inside the field before the input, e.g. "+91" (deck 02). */
  prefix?: string;
  /** Decorative icon at the right edge, e.g. the date-of-birth lock (deck 10). */
  rightIcon?: IconName;
  /** Shows "88 / 500" under the field (deck 11). Uses maxLength. */
  showCounter?: boolean;
  ref?: Ref<TextInput>;
}

/**
 * Deck input: pink-shade fill with a soft pink border when idle, white with
 * a pink border while focused, red border and message on error.
 */
export function TextField({
  label,
  error,
  hint,
  prefix,
  rightIcon,
  showCounter,
  editable = true,
  multiline,
  maxLength,
  onFocus,
  onBlur,
  style,
  ref,
  ...rest
}: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.primaryBorder;
  const helper = error ?? hint;
  const length = typeof rest.value === 'string' ? rest.value.length : 0;

  return (
    <View style={styles.container}>
      <AppText variant="label" style={styles.label}>
        {label}
      </AppText>
      <View
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          { backgroundColor: focused && editable ? colors.background : colors.surface, borderColor },
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
          multiline={multiline}
          maxLength={maxLength}
          textAlignVertical={multiline ? 'top' : 'center'}
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
          style={[styles.input, multiline && styles.inputMultiline, typography.body, { color: colors.text }, style]}
          {...rest}
        />
        {rightIcon ? (
          <View style={styles.rightIcon}>
            <Icon name={rightIcon} size={20} color="textSubtle" />
          </View>
        ) : null}
      </View>
      {helper || (showCounter && maxLength) ? (
        <View style={styles.below}>
          <View style={styles.helper}>
            {helper ? (
              <AppText
                variant="caption"
                tone={error ? 'danger' : 'muted'}
                accessibilityLiveRegion={error ? 'polite' : 'none'}
                role={error ? 'alert' : undefined}>
                {helper}
              </AppText>
            ) : null}
          </View>
          {showCounter && maxLength ? (
            <AppText variant="caption" tone="subtle" accessibilityLabel={t('common.counterLabel', { count: length, max: maxLength })}>
              {t('common.counter', { count: length, max: maxLength })}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch' },
  label: { marginBottom: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  fieldMultiline: { alignItems: 'stretch' },
  prefix: { paddingLeft: spacing.md, paddingRight: spacing.sm, borderRightWidth: 1.5, marginVertical: spacing.sm + 2 },
  input: {
    flex: 1,
    // Lets the input shrink inside the row instead of pushing past the border.
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    // Web only: drop the browser focus ring; the field's own border shows focus.
    ...Platform.select({ web: { outlineColor: 'transparent', outlineWidth: 0 } }),
  },
  inputMultiline: { minHeight: 104, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  rightIcon: { paddingRight: spacing.md },
  below: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xs },
  helper: { flex: 1 },
});
