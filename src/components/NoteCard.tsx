import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

/** Pink-shade note with a pink left bar (deck 09 tip, deck 48 plan warning). */
export function NoteCard({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderLeftColor: colors.primary }]}>
      <AppText>{children}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderLeftWidth: 4, padding: spacing.md },
});
