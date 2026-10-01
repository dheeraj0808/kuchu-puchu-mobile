import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, spacing, useTheme } from '@/theme';

import { ScreenHeader } from './ScreenHeader';

interface ListScreenProps {
  title: string;
  onBack: () => void;
  /** Pinned to the bottom (e.g. "Sign out of all devices"). */
  footer?: ReactNode;
  /** X instead of a back chevron (deck 46). */
  close?: boolean;
  backLabel?: string;
}

/** Centred-title screen with scrolling content (deck 40, 45, 48). */
export function ListScreen({ title, onBack, footer, close, backLabel, children }: PropsWithChildren<ListScreenProps>) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.column}>
        <ScreenHeader title={title} onBack={onBack} close={close} backLabel={backLabel} />
      </View>
      <ScrollView style={styles.flex} contentContainerStyle={[styles.column, styles.scroll]}>
        {children}
      </ScrollView>
      {footer ? <View style={[styles.column, styles.footer]}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: layout.formMaxWidth, alignSelf: 'center', paddingHorizontal: spacing.md },
  scroll: { flexGrow: 1, paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: spacing.lg },
  footer: { paddingVertical: spacing.md },
});
