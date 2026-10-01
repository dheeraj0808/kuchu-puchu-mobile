import { StyleSheet, View } from 'react-native';

import { typography, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

/** Bottom-tab icon: pink when active, grey otherwise, optional count badge (deck 18). */
export function TabIcon({ name, focused, badge }: { name: IconName; focused: boolean; badge?: number }) {
  const { colors } = useTheme();
  return (
    <View>
      <Icon name={name} size={26} color={focused ? 'primary' : 'textSubtle'} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
          <AppText style={[typography.caption, styles.badgeText]} tone="onPrimary" maxFontSizeMultiplier={1.2}>
            {badge > 9 ? '9+' : badge}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: -6, right: -10, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontSize: 10, lineHeight: 12, fontFamily: typography.label.fontFamily },
});
