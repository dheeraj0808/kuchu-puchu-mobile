import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ListScreen } from '@/components/ListScreen';
import { SettingsGroup, SettingsRow } from '@/components/Settings';
import { t, type TranslationKey } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';

const TIPS = [
  { icon: 'account-multiple-outline', title: 'safety.publicTitle', body: 'safety.publicBody' },
  { icon: 'phone-outline', title: 'safety.friendTitle', body: 'safety.friendBody' },
  { icon: 'message-outline', title: 'safety.chatTitle', body: 'safety.chatBody' },
] as const;

/** Guide §9.5 / deck 47: Indian helplines. */
export const HELPLINES: readonly { name: TranslationKey; number: string }[] = [
  { name: 'safety.emergency', number: '112' },
  { name: 'safety.women', number: '181' },
  { name: 'safety.cyber', number: '1930' },
];

/** Screen 47 — Safety centre. Static tips, helplines (Call opens the dialer) and how reporting and verification work. */
export default function SafetyCentreScreen() {
  const { colors } = useTheme();
  return (
    <ListScreen title={t('safety.title')} onBack={() => router.back()}>
      <View>
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <AppText variant="title" tone="onPrimary">
            {t('safety.heroTitle')}
          </AppText>
          <AppText tone="onPrimaryMuted">{t('safety.heroBody')}</AppText>
        </View>
        <View style={styles.tips}>
          <SettingsGroup>
            {TIPS.map((tip) => (
              <SettingsRow key={tip.title} icon={tip.icon} title={t(tip.title)} subtitle={t(tip.body)} />
            ))}
          </SettingsGroup>
        </View>
      </View>

      <SettingsGroup title={t('safety.helplines')}>
        {HELPLINES.map((h) => (
          <SettingsRow
            key={h.number}
            icon="phone-outline"
            title={t(h.name)}
            subtitle={h.number}
            accessory={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('safety.callLabel', { name: t(h.name), number: h.number })}
                onPress={() => void Linking.openURL(`tel:${h.number}`).catch(() => undefined)}
                hitSlop={12}>
                <AppText style={typography.label} tone="primary">
                  {t('safety.call')}
                </AppText>
              </Pressable>
            }
          />
        ))}
      </SettingsGroup>

      {(['reporting', 'verification'] as const).map((topic) => (
        <View key={topic} style={[styles.section, { backgroundColor: colors.surface }]}>
          <AppText variant="heading">{t(`safety.${topic}Title`)}</AppText>
          <AppText tone="muted">{t(`safety.${topic}Body`)}</AppText>
        </View>
      ))}
    </ListScreen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xs },
  // The tips card tucks under the hero, as in the deck.
  tips: { marginTop: -spacing.md },
  section: { borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
});
