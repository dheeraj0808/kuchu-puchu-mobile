import { StyleSheet, View } from 'react-native';

import type { DiscoveryMissing } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { t } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';

/** Card skeleton while the first batch loads. */
export function CardSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.skeleton, { backgroundColor: colors.surface }]} accessible accessibilityLabel={t('discover.loading')} accessibilityRole="progressbar">
      <View style={styles.skeletonInfo}>
        <View style={[styles.bar, { width: '55%', height: 28, backgroundColor: colors.border }]} />
        <View style={styles.row}>
          <View style={[styles.bar, { width: 96, backgroundColor: colors.border }]} />
          <View style={[styles.bar, { width: 120, backgroundColor: colors.border }]} />
        </View>
        <View style={[styles.bar, { width: '100%', height: 56, backgroundColor: colors.border }]} />
      </View>
    </View>
  );
}

/** Screen 25 radar: pink rings with a search icon. */
export function RadarIllustration() {
  const { colors } = useTheme();
  return (
    <View style={styles.radar} accessible accessibilityRole="image" accessibilityLabel={t('empty.illustration')}>
      <View style={[styles.ring, styles.ringOuter, { borderColor: colors.primaryBorder }]} />
      <View style={[styles.ring, styles.ringMid, { borderColor: colors.primaryBorder }]} />
      <View style={[styles.core, { backgroundColor: colors.surface }]}>
        <Icon name="magnify" size={40} color="primary" />
      </View>
    </View>
  );
}

/** 409 DISCOVERY_NOT_READY: what's missing, with a way to finish each. */
export function NotReadyList({ missing, onFinish, busy }: { missing: DiscoveryMissing[]; onFinish: () => void; busy: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.notReady}>
      <View style={styles.copy}>
        <AppText variant="display">{t('discover.notReadyTitle')}</AppText>
        <AppText tone="muted">{t('discover.notReadyBody')}</AppText>
      </View>
      <View style={[styles.card, { borderColor: colors.border }]}>
        {missing.map((m, i) => (
          <View key={m} style={[styles.item, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <Icon name="alert-circle-outline" size={22} color="primary" />
            <AppText style={[typography.body, styles.flex]}>{t(`missing.${m}`)}</AppText>
            <Button variant="ghost" fullWidth={false} label={t('discover.finish')} disabled={busy} onPress={onFinish} />
          </View>
        ))}
      </View>
      <Button variant="secondary" label={t('discover.checkAgain')} loading={busy} onPress={onFinish} />
    </View>
  );
}

const RADAR = 260;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  skeleton: { flex: 1, borderRadius: radius.lg, justifyContent: 'flex-end', padding: spacing.md },
  skeletonInfo: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.xs },
  bar: { height: 24, borderRadius: radius.sm },
  radar: { width: RADAR, height: RADAR, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 2 },
  ringOuter: { width: RADAR, height: RADAR, opacity: 0.55 },
  ringMid: { width: RADAR * 0.69, height: RADAR * 0.69 },
  core: { width: RADAR * 0.38, height: RADAR * 0.38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  notReady: { gap: spacing.lg },
  copy: { gap: spacing.xs },
  card: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.md, minHeight: 56 },
});
