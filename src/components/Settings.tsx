import { Children, Fragment, isValidElement, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, typography, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

/** A titled card of rows separated by hairlines (deck 40, 45). */
export function SettingsGroup({ title, children }: PropsWithChildren<{ title?: string }>) {
  const { colors } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.group}>
      {title ? (
        <AppText variant="label" tone="muted" accessibilityRole="header" style={styles.groupTitle}>
          {title}
        </AppText>
      ) : null}
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.background }]}>
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 ? <View style={[styles.separator, { backgroundColor: colors.border }]} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

interface SettingsRowProps {
  icon: IconName;
  title: string;
  subtitle?: string | null;
  onPress?: () => void;
  /** Red title and icon (Delete account). */
  destructive?: boolean;
  /** Shows the right chevron. Defaults to true when the row navigates. */
  chevron?: boolean;
  /** Replaces the chevron, e.g. a text button. */
  accessory?: ReactNode;
  disabled?: boolean;
}

/** Icon in a pink-shade tile, title, optional subtitle, chevron. */
export function SettingsRow({ icon, title, subtitle, onPress, destructive, chevron = !!onPress, accessory, disabled }: SettingsRowProps) {
  const { colors } = useTheme();
  const content = (
    <>
      <View style={[styles.iconTile, { backgroundColor: colors.surface }]}>
        <Icon name={icon} size={22} color={destructive ? 'danger' : 'text'} />
      </View>
      <View style={styles.text}>
        <AppText style={[typography.body, styles.title]} tone={destructive ? 'danger' : 'default'}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="label" tone="muted" style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {accessory ?? (chevron ? <Icon name="chevron-right" size={22} color="textSubtle" /> : null)}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
      {content}
    </Pressable>
  );
}

const TILE = 40;

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  groupTitle: { marginLeft: spacing.xs },
  card: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 64 },
  iconTile: { width: TILE, height: TILE, borderRadius: radius.sm - 2, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: typography.label.fontFamily },
  subtitle: { fontFamily: typography.body.fontFamily },
});
