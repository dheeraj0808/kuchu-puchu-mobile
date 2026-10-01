import { Platform, StyleSheet, Switch, View } from 'react-native';

import { spacing, typography, useTheme } from '@/theme';

import { AppText } from './AppText';

interface ToggleRowProps {
  label: string;
  /** Second line under the label (deck 46 "Rohan will not know it was you"). */
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

/** Label with a pink switch (deck 10 "Show gender on my profile"). */
export function ToggleRow({ label, hint, value, onChange, disabled }: ToggleRowProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <AppText style={[typography.body, styles.label]}>{label}</AppText>
        {hint ? (
          <AppText variant="label" tone="muted" style={styles.hint}>
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled: !!disabled }}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.borderStrong }}
        thumbColor={colors.onPrimary}
        ios_backgroundColor={colors.borderStrong}
        {...Platform.select({ web: { activeThumbColor: colors.onPrimary } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
  text: { flex: 1, gap: 2 },
  label: { fontFamily: typography.label.fontFamily },
  hint: { fontFamily: typography.body.fontFamily },
});
