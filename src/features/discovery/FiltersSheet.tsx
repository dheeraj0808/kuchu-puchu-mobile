import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import type { Preferences, ShowMe } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Chip, ChipGroup } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { PlusPill } from '@/components/PlusPill';
import { RangeSlider } from '@/components/RangeSlider';
import { Sheet } from '@/components/Sheet';
import { AGE_MAX, AGE_MIN, DEFAULT_DISTANCE_KM, DISTANCE_MAX_KM, DISTANCE_MIN_KM, SHOW_ME } from '@/features/onboarding/preferences';
import { t } from '@/i18n';
import { spacing, typography } from '@/theme';

import { applyPreferences } from './applyPreferences';

const FALLBACK: Preferences = { showMe: 'everyone', ageMin: 24, ageMax: 32, maxDistanceKm: DEFAULT_DISTANCE_KM };

/**
 * Screen 20 — Filters, a bottom sheet over Discover. Saving runs
 * PUT /preferences and flushes the local queue. Paid rows are locked.
 */
export function FiltersSheet({ visible, onClose, onLocked }: { visible: boolean; onClose: () => void; onLocked: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      {visible ? <FiltersForm onDone={onClose} onLocked={onLocked} /> : null}
    </Sheet>
  );
}

function FiltersForm({ onDone, onLocked }: { onDone: () => void; onLocked: () => void }) {
  const { user, reloadUser } = useAuth();
  const saved = user?.preferences ?? FALLBACK;
  const [showMe, setShowMe] = useState<ShowMe>(saved.showMe);
  const [ages, setAges] = useState<[number, number]>([saved.ageMin, saved.ageMax]);
  const [distance, setDistance] = useState(saved.maxDistanceKm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    setSaving(true);
    setError(null);
    try {
      await applyPreferences({ showMe, ageMin: ages[0], ageMax: ages[1], maxDistanceKm: distance }, { reloadUser });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.body}>
      <AppText variant="display">{t('filtersSheet.title')}</AppText>
      <View style={styles.block}>
        <AppText variant="label">{t('preferences.showMe')}</AppText>
        <ChipGroup label={t('preferences.showMe')}>
          {SHOW_ME.map((o) => (
            <Chip key={o} role="radio" label={t(`showMe.${o}`)} selected={showMe === o} onPress={() => setShowMe(o)} />
          ))}
        </ChipGroup>
      </View>
      <View>
        <Header label={t('preferences.ageRange')} value={t('preferences.ageValue', { min: ages[0], max: ages[1] })} />
        <RangeSlider
          min={AGE_MIN}
          max={AGE_MAX}
          values={ages}
          onChange={(v) => setAges([v[0]!, v[1]!])}
          thumbLabels={[t('preferences.ageMinLabel'), t('preferences.ageMaxLabel')]}
          formatValue={(v) => t('preferences.years', { value: v })}
        />
      </View>
      <View>
        <Header label={t('preferences.distance')} value={t('preferences.distanceValue', { km: distance })} />
        <RangeSlider
          min={DISTANCE_MIN_KM}
          max={DISTANCE_MAX_KM}
          values={[distance]}
          onChange={(v) => setDistance(v[0]!)}
          thumbLabels={[t('preferences.distanceLabel')]}
          formatValue={(v) => t('preferences.km', { value: v })}
        />
      </View>
      {(['filtersSheet.verifiedOnly', 'filtersSheet.more'] as const).map((key) => (
        <Pressable key={key} accessibilityRole="button" accessibilityLabel={t('filtersSheet.lockedLabel', { name: t(key) })} onPress={onLocked} style={styles.locked}>
          <Icon name="lock-outline" size={22} color="primary" />
          <AppText style={[typography.body, styles.flex]}>{t(key)}</AppText>
          <PlusPill />
        </Pressable>
      ))}
      {error ? <Banner message={error} /> : null}
      <Button label={t('filtersSheet.apply')} loading={saving} loadingLabel={t('filtersSheet.applying')} onPress={apply} />
    </View>
  );
}

function Header({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.header}>
      <AppText style={[typography.body, styles.label, styles.flex]}>{label}</AppText>
      <AppText style={typography.body} tone="primary">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.md },
  block: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center' },
  label: { fontFamily: typography.label.fontFamily },
  locked: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
});
