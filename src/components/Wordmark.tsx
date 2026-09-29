import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

/** Brand mark: two overlapping circles (two people, one connection) + name. */
export function Wordmark() {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel="Kuchu Puchu">
      <View style={styles.mark}>
        <View style={[styles.circle, { backgroundColor: colors.primary }]} />
        <View style={[styles.circle, styles.second, { borderColor: colors.primary, backgroundColor: colors.primarySoft }]} />
      </View>
      <AppText variant="heading" style={styles.name}>
        kuchu puchu
      </AppText>
    </View>
  );
}

const SIZE = 22;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  mark: { width: SIZE * 1.6, height: SIZE, flexDirection: 'row' },
  circle: { width: SIZE, height: SIZE, borderRadius: radius.pill },
  second: { marginLeft: -SIZE * 0.4, borderWidth: 2, opacity: 0.95 },
  name: { letterSpacing: -0.2 },
});
