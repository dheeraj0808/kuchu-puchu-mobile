import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { BackButton } from './BackButton';

interface StepScreenProps {
  title: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  backDisabled?: boolean;
  /** Pinned to the bottom, above the keyboard (e.g. the main button or a keypad). */
  footer?: ReactNode;
  /** Footer spans the full width (keypad) instead of the padded column. */
  footerFullWidth?: boolean;
}

/**
 * Layout of a sign-in / onboarding step (deck 02, 03): back button, title,
 * subtitle, scrollable content and a footer pinned to the bottom. Content
 * scrolls rather than clipping at large font sizes.
 */
export function StepScreen({
  title,
  subtitle,
  onBack,
  backDisabled,
  footer,
  footerFullWidth,
  children,
}: PropsWithChildren<StepScreenProps>) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.column, styles.scroll]}
          keyboardShouldPersistTaps="handled">
          {onBack ? <BackButton onPress={onBack} disabled={backDisabled} /> : null}
          <View style={styles.header}>
            <AppText variant="display">{title}</AppText>
            {typeof subtitle === 'string' ? <AppText tone="muted">{subtitle}</AppText> : subtitle}
          </View>
          {children}
        </ScrollView>
        {footer ? <View style={footerFullWidth ? undefined : [styles.column, styles.footer]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: layout.formMaxWidth, alignSelf: 'center', paddingHorizontal: spacing.md },
  scroll: { flexGrow: 1, paddingTop: spacing.xs, paddingBottom: spacing.lg, gap: spacing.lg },
  header: { gap: spacing.xs, marginTop: spacing.xs },
  footer: { paddingBottom: spacing.md, paddingTop: spacing.xs },
});
