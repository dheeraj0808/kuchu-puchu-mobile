import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

export function Card({ title, children }: PropsWithChildren<{ title?: string }>) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      {title ? (
        <AppText variant="label" tone="muted" style={styles.title}>
          {title.toUpperCase()}
        </AppText>
      ) : null}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

interface RowProps {
  label: string;
  value: string;
  badge?: { label: string; tone: 'success' | 'muted' };
  last?: boolean;
}

export function Row({ label, value, badge, last }: RowProps) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${badge ? `, ${badge.label}` : ''}`}
      style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <View style={styles.rowText}>
        <AppText variant="caption" tone="muted">
          {label}
        </AppText>
        <AppText variant="body" numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      </View>
      {badge ? (
        <View
          style={[
            styles.badge,
            { backgroundColor: badge.tone === 'success' ? colors.successSoft : colors.surfaceMuted },
          ]}>
          <AppText variant="caption" tone={badge.tone === 'success' ? 'success' : 'muted'} style={styles.badgeText}>
            {badge.label}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { alignSelf: 'stretch', gap: spacing.xs },
  title: { marginLeft: spacing.xxs, fontSize: 12, letterSpacing: 0.6 },
  card: { borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: spacing.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm + 2, gap: spacing.sm },
  rowText: { flex: 1, gap: 2 },
  value: { fontWeight: '500' },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  badgeText: { fontWeight: '600', fontSize: 12 },
});
