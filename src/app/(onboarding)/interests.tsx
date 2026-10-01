import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { getInterestCatalog, putInterests } from '@/api/endpoints/profile';
import { errorMessage } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Chip, ChipGroup } from '@/components/Chip';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { SearchField } from '@/components/SearchField';
import { canContinueInterests, matchesSearch, toggleInterest } from '@/features/onboarding/rules';
import { useSaveStep } from '@/features/onboarding/useSaveStep';
import { t } from '@/i18n';
import { spacing } from '@/theme';

/**
 * Screen 12 — Interests. Chips by category from GET /catalog/interests,
 * filtered by search; pick 3 to 10. PUT /profile/interests.
 * States: loading, content, empty (no search results), error with retry.
 */
export default function InterestsScreen() {
  const { user } = useAuth();
  const catalog = useQuery({ queryKey: ['catalog', 'interests'], queryFn: getInterestCatalog, staleTime: Infinity });
  const [selected, setSelected] = useState<string[]>(user?.profile?.interestIds ?? []);
  const [query, setQuery] = useState('');
  const [limitHit, setLimitHit] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const save = useSaveStep((ids: string[]) => putInterests(ids));

  const visible = useMemo(
    () =>
      (catalog.data ?? [])
        .map((c) => ({ ...c, interests: c.interests.filter((i) => !query || matchesSearch(i.name, query)) }))
        .filter((c) => c.interests.length > 0),
    [catalog.data, query],
  );

  const toggle = (id: string) => {
    const result = toggleInterest(selected, id);
    setSelected(result.selected);
    setLimitHit(result.limitReached);
  };

  const submit = async () => {
    setFormError(null);
    try {
      await save.mutateAsync(selected);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  return (
    <OnboardingScreen
      step="interests"
      title={t('interests.title')}
      subtitle={t('interests.subtitle')}
      footer={
        <Button
          label={selected.length > 0 ? t('interests.continueCount', { count: selected.length }) : t('common.continue')}
          disabled={!canContinueInterests(selected.length)}
          loading={save.isPending}
          loadingLabel={t('common.saving')}
          onPress={submit}
        />
      }>
      <SearchField value={query} onChangeText={setQuery} placeholder={t('interests.search')} />

      {limitHit ? <Banner tone="info" message={t('interests.limit')} /> : null}
      {formError ? <Banner message={formError} actionLabel={t('common.tryAgain')} onAction={submit} /> : null}

      {catalog.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : catalog.isError ? (
        <Banner message={t('interests.loadError')} actionLabel={t('common.tryAgain')} onAction={() => void catalog.refetch()} />
      ) : visible.length === 0 ? (
        <AppText tone="muted" align="center">
          {t('interests.noResults', { query })}
        </AppText>
      ) : (
        visible.map((category) => (
          <View key={category.id} style={styles.category}>
            <AppText variant="heading">{category.name}</AppText>
            <ChipGroup label={category.name}>
              {category.interests.map((interest) => (
                <Chip
                  key={interest.id}
                  label={interest.name}
                  selected={selected.includes(interest.id)}
                  onPress={() => toggle(interest.id)}
                />
              ))}
            </ChipGroup>
          </View>
        ))
      )}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: spacing.xl },
  category: { gap: spacing.sm },
});
