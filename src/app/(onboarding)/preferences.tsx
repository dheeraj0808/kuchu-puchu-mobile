import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { putPreferences } from '@/api/endpoints/preferences';
import { errorMessage } from '@/api/errors';
import type { Preferences, ShowMe } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Chip, ChipGroup } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { PlusPill } from '@/components/PlusPill';
import { RangeSlider } from '@/components/RangeSlider';
import { Sheet } from '@/components/Sheet';
import {
  AGE_MAX,
  AGE_MIN,
  DEFAULT_DISTANCE_KM,
  DISTANCE_MAX_KM,
  DISTANCE_MIN_KM,
  SHOW_ME,
  defaultAgeRange,
  preferencesProblem,
} from '@/features/onboarding/preferences';
import { ageOn, parseDob, todayLocal } from '@/features/onboarding/rules';
import { useSaveStep } from '@/features/onboarding/useSaveStep';
import { t } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';

/** "2000-03-14" → age today, for the default range. */
function ownAge(iso: string | undefined): number | null {
  if (!iso) return null;
  const dob = parseDob(iso.split('-').reverse().join(''));
  return dob ? ageOn(dob, todayLocal()) : null;
}

/**
 * Screen 14 — Preferences ("Who do you want to meet?"): show me, age range
 * 18–100, distance 1–200 km. Paid filters are shown locked. PUT /preferences.
 */
export default function PreferencesScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const saved = user?.preferences;
  const [showMe, setShowMe] = useState<ShowMe | null>(saved?.showMe ?? null);
  const [ages, setAges] = useState<[number, number]>(
    saved ? [saved.ageMin, saved.ageMax] : defaultAgeRange(ownAge(user?.profile?.dateOfBirth)),
  );
  const [distance, setDistance] = useState(saved?.maxDistanceKm ?? DEFAULT_DISTANCE_KM);
  const [paywall, setPaywall] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const save = useSaveStep((body: Preferences) => putPreferences(body));

  const body: Partial<Preferences> = { showMe: showMe ?? undefined, ageMin: ages[0], ageMax: ages[1], maxDistanceKm: distance };
  const valid = preferencesProblem(body) === null;

  const submit = async () => {
    if (!valid || !showMe) return;
    setFormError(null);
    try {
      await save.mutateAsync({ showMe, ageMin: ages[0], ageMax: ages[1], maxDistanceKm: distance });
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  return (
    <OnboardingScreen
      step="preferences"
      title={t('preferences.title')}
      footer={<Button label={t('common.continue')} disabled={!valid} loading={save.isPending} loadingLabel={t('common.saving')} onPress={submit} />}>
      <View style={styles.block}>
        <AppText variant="label">{t('preferences.showMe')}</AppText>
        <ChipGroup label={t('preferences.showMe')}>
          {SHOW_ME.map((option) => (
            <Chip key={option} role="radio" label={t(`showMe.${option}`)} selected={showMe === option} onPress={() => setShowMe(option)} />
          ))}
        </ChipGroup>
      </View>

      <View style={styles.sliderBlock}>
        <SliderHeader label={t('preferences.ageRange')} value={t('preferences.ageValue', { min: ages[0], max: ages[1] })} />
        <RangeSlider
          min={AGE_MIN}
          max={AGE_MAX}
          values={ages}
          onChange={(v) => setAges([v[0]!, v[1]!])}
          thumbLabels={[t('preferences.ageMinLabel'), t('preferences.ageMaxLabel')]}
          formatValue={(v) => t('preferences.years', { value: v })}
        />
      </View>

      <View style={styles.sliderBlock}>
        <SliderHeader label={t('preferences.distance')} value={t('preferences.distanceValue', { km: distance })} />
        <RangeSlider
          min={DISTANCE_MIN_KM}
          max={DISTANCE_MAX_KM}
          values={[distance]}
          onChange={(v) => setDistance(v[0]!)}
          thumbLabels={[t('preferences.distanceLabel')]}
          formatValue={(v) => t('preferences.km', { value: v })}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('preferences.moreFiltersLabel')}
        accessibilityHint={t('preferences.moreFiltersBody')}
        onPress={() => setPaywall(true)}
        style={({ pressed }) => [styles.filters, { borderColor: colors.primaryBorder, opacity: pressed ? 0.85 : 1 }]}>
        <Icon name="lock-outline" size={22} color="primary" />
        <View style={styles.flex}>
          <AppText style={[typography.body, styles.filtersTitle]}>{t('preferences.moreFilters')}</AppText>
          <AppText variant="label" tone="muted" style={styles.regular}>
            {t('preferences.moreFiltersBody')}
          </AppText>
        </View>
        <PlusPill />
      </Pressable>

      {formError ? <Banner message={formError} actionLabel={t('common.tryAgain')} onAction={submit} /> : null}

      <Sheet visible={paywall} onClose={() => setPaywall(false)}>
        <View style={styles.sheet}>
          <PlusPill align="start" />
          <AppText variant="title">{t('preferences.paywallTitle')}</AppText>
          <AppText tone="muted">{t('preferences.paywallBody')}</AppText>
          <Button label={t('common.done')} onPress={() => setPaywall(false)} />
        </View>
      </Sheet>
    </OnboardingScreen>
  );
}

function SliderHeader({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.sliderHeader}>
      <AppText style={[typography.body, styles.filtersTitle, styles.flex]}>{label}</AppText>
      <AppText style={typography.body} tone="primary" accessibilityLiveRegion="polite">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: spacing.sm },
  sliderBlock: { gap: spacing.xxs },
  sliderHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  filtersTitle: { fontFamily: typography.label.fontFamily },
  regular: { fontFamily: typography.body.fontFamily },
  sheet: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.md },
});
