import type { PropsWithChildren, ReactElement } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type RefreshControlProps,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { layout, radius, spacing, useTheme } from '@/theme';

interface ScreenProps {
  /** `form`: narrow, vertically centred, carded on wide screens. `content`: top-aligned, wider. */
  variant?: 'form' | 'content';
  edges?: Edge[];
  refreshControl?: ReactElement<RefreshControlProps>;
}

export function Screen({ variant = 'form', edges = ['top', 'bottom'], refreshControl, children }: PropsWithChildren<ScreenProps>) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= layout.wideBreakpoint;
  const isForm = variant === 'form';
  const gutter = width < 360 ? spacing.md : spacing.lg;

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scroll,
            { paddingHorizontal: gutter },
            isForm ? styles.centered : styles.top,
            isWide && { paddingVertical: spacing.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          refreshControl={refreshControl}>
          <View
            style={[
              styles.inner,
              { maxWidth: isForm ? layout.formMaxWidth : layout.contentMaxWidth },
              isForm &&
                isWide && [
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow },
                ],
            ]}>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', paddingVertical: spacing.lg },
  centered: { justifyContent: 'center' },
  top: { justifyContent: 'flex-start' },
  inner: { width: '100%' },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
});
