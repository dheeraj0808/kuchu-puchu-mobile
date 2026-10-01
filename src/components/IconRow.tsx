import { StyleSheet, View } from 'react-native';

import { radius, spacing, typography, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

/** Icon in a pink-shade tile with a title and a line of detail (deck 06). */
export function IconRow({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessible accessibilityLabel={`${title}. ${body}`}>
      <View style={[styles.tile, { backgroundColor: colors.surface }]}>
        <Icon name={icon} size={24} color="primary" />
      </View>
      <View style={styles.text}>
        <AppText style={[typography.body, styles.title]}>{title}</AppText>
        <AppText variant="label" tone="muted" style={styles.body}>
          {body}
        </AppText>
      </View>
    </View>
  );
}

const TILE = 48;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  tile: { width: TILE, height: TILE, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: typography.label.fontFamily },
  body: { fontFamily: typography.body.fontFamily },
});
