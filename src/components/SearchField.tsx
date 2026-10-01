import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { t } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';

import { Icon } from './Icon';

interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}

/** Search box (deck 12, 17): pink shade when idle, white with a pink border while focused. */
export function SearchField({ value, onChangeText, placeholder, autoFocus }: SearchFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.field,
        { backgroundColor: focused ? colors.background : colors.surface, borderColor: focused ? colors.primary : colors.primaryBorder },
      ]}>
      <Icon name="magnify" size={22} color={focused ? 'primary' : 'textMuted'} />
      <TextInput
        accessibilityLabel={placeholder}
        accessibilityRole="search"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        placeholderTextColor={colors.textSubtle}
        selectionColor={colors.primary}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        maxFontSizeMultiplier={1.6}
        style={[styles.input, typography.body, { color: colors.text }]}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.clearSearch')} onPress={() => onChangeText('')} hitSlop={12}>
          <Icon name="close-circle" size={20} color="textSubtle" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    ...Platform.select({ web: { outlineColor: 'transparent', outlineWidth: 0 } }),
  },
});
