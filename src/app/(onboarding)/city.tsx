import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { searchCities } from '@/api/endpoints/location';
import { errorMessage } from '@/api/errors';
import type { City } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ListScreen } from '@/components/ListScreen';
import { SearchField } from '@/components/SearchField';
import { sendLocation } from '@/features/onboarding/sendLocation';
import { useSaveStep } from '@/features/onboarding/useSaveStep';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { t } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';

export const CITY_SEARCH_DEBOUNCE_MS = 300;

/**
 * Screen 17 — City picker. Used when location is denied or the user prefers
 * to choose. Debounced search (300 ms) over GET /catalog/cities?q=, then
 * PUT /profile/location {cityId}. States: hint, loading, results, empty, error.
 */
export default function CityPickerScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<City | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const settled = useDebouncedValue(query.trim(), CITY_SEARCH_DEBOUNCE_MS);
  const results = useQuery({
    queryKey: ['catalog', 'cities', settled],
    queryFn: ({ signal }) => searchCities(settled, signal),
    enabled: settled.length > 0,
    staleTime: 10 * 60_000,
  });
  const save = useSaveStep((city: City) => sendLocation({ cityId: city.id }));

  const submit = async () => {
    if (!selected) return;
    setFormError(null);
    try {
      await save.mutateAsync(selected); // The gate moves on to notifications.
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const list = results.data ?? [];

  return (
    <ListScreen
      title={t('city.title')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/location'))}
      footer={
        <Button
          label={selected ? t('city.use', { city: selected.name }) : t('city.useDisabled')}
          disabled={!selected}
          loading={save.isPending}
          loadingLabel={t('common.saving')}
          onPress={submit}
        />
      }>
      <SearchField value={query} onChangeText={setQuery} placeholder={t('city.search')} autoFocus />

      {!settled ? (
        <AppText tone="muted">{t('city.hint')}</AppText>
      ) : results.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : results.isError ? (
        <Banner message={t('city.loadError')} actionLabel={t('common.tryAgain')} onAction={() => void results.refetch()} />
      ) : list.length === 0 ? (
        <AppText tone="muted">{t('city.noResults', { query: settled })}</AppText>
      ) : (
        <View accessibilityRole="radiogroup" style={[styles.card, { borderColor: colors.border }]}>
          {list.map((city, i) => {
            const isSelected = selected?.id === city.id;
            return (
              <Pressable
                key={city.id}
                accessibilityRole="radio"
                accessibilityLabel={`${city.name}, ${city.state}`}
                accessibilityState={{ checked: isSelected, selected: isSelected }}
                onPress={() => setSelected(city)}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                  pressed && { backgroundColor: colors.surface },
                ]}>
                <View style={[styles.tile, { backgroundColor: colors.surface }]}>
                  <Icon name="map-marker-outline" size={22} />
                </View>
                <View style={styles.text}>
                  <AppText style={[typography.body, styles.name]}>{city.name}</AppText>
                  <AppText variant="label" tone="muted" style={styles.state}>
                    {city.state}
                  </AppText>
                </View>
                {isSelected ? <Icon name="check-circle" size={24} color="primary" /> : null}
              </Pressable>
            );
          })}
        </View>
      )}

      <AppText variant="label" tone="muted" style={styles.state}>
        {t('city.caption')}
      </AppText>
      {formError ? <Banner message={formError} actionLabel={t('common.tryAgain')} onAction={submit} /> : null}
    </ListScreen>
  );
}

const TILE = 40;

const styles = StyleSheet.create({
  loading: { paddingVertical: spacing.lg },
  card: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 64 },
  tile: { width: TILE, height: TILE, borderRadius: radius.sm - 2, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: typography.label.fontFamily },
  state: { fontFamily: typography.body.fontFamily },
});
