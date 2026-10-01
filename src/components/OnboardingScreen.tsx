import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ONBOARDING_SEGMENTS, filledSegments, type OnboardingSegment } from '@/features/onboarding/steps';
import { t } from '@/i18n';
import { layout, spacing, typography, useTheme } from '@/theme';

import { AppText } from './AppText';
import { OnboardingProgress } from './OnboardingProgress';

interface OnboardingScreenProps {
  step: OnboardingSegment;
  title: string;
  subtitle?: string;
  /** Pink "Skip" top-right (deck 11, 13 only). */
  onSkip?: () => void;
  skipDisabled?: boolean;
  /** Pinned to the bottom: the Continue button. */
  footer: ReactNode;
  /** Centred layout with an icon above the title (deck 08). */
  hero?: ReactNode;
}

/** Shell for onboarding steps: progress bar, optional Skip, title, scrolling content, pinned footer. */
export function OnboardingScreen({ step, title, subtitle, onSkip, skipDisabled, footer, hero, children }: PropsWithChildren<OnboardingScreenProps>) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={[styles.column, styles.top]}>
          <OnboardingProgress filled={filledSegments(step)} total={ONBOARDING_SEGMENTS.length} />
          {onSkip ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.skip')}
              accessibilityState={{ disabled: !!skipDisabled }}
              disabled={skipDisabled}
              onPress={onSkip}
              hitSlop={12}
              style={styles.skip}>
              <AppText style={typography.label} tone="primary">
                {t('onboarding.skip')}
              </AppText>
            </Pressable>
          ) : null}
        </View>
        <ScrollView style={styles.flex} contentContainerStyle={[styles.column, styles.scroll]} keyboardShouldPersistTaps="handled">
          {hero ? <View style={styles.hero}>{hero}</View> : null}
          <View style={styles.header}>
            <AppText variant="display" align={hero ? 'center' : undefined}>
              {title}
            </AppText>
            {subtitle ? (
              <AppText tone="muted" align={hero ? 'center' : undefined}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
          {children}
        </ScrollView>
        <View style={[styles.column, styles.footer]}>{footer}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: layout.formMaxWidth, alignSelf: 'center', paddingHorizontal: spacing.md },
  top: { paddingTop: spacing.sm, gap: spacing.sm },
  skip: { alignSelf: 'flex-end', paddingVertical: spacing.xxs },
  scroll: { flexGrow: 1, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.lg },
  header: { gap: spacing.xs },
  hero: { alignItems: 'center', paddingTop: spacing.lg },
  footer: { paddingTop: spacing.xs, paddingBottom: spacing.md },
});
