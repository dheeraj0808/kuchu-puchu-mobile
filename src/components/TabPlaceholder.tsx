import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

/** Interim tab content until the real screen ships. */
export function TabPlaceholder({ icon, title, body, children }: { icon: IconName; title: string; body: string; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.column}>
        <AppText variant="display">{title}</AppText>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Icon name={icon} size={36} color="primary" />
          <AppText tone="muted" align="center">
            {body}
          </AppText>
        </View>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: layout.formMaxWidth, alignSelf: 'center', padding: spacing.md, gap: spacing.lg },
  card: { borderRadius: 16, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
});
