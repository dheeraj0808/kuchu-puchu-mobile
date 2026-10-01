import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { AppText } from './AppText';
import { BackButton } from './BackButton';

const SIDE = 40;

/** Back button on the left, title centred (deck 40, 45, 48). */
export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.row}>
      <BackButton onPress={onBack} />
      <AppText variant="heading" align="center" numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
      <View style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  title: { flex: 1 },
  side: { width: SIDE },
});
