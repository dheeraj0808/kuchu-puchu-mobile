import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabIcon } from '@/components/TabIcon';
import { useUnreadMatches } from '@/features/discovery/useUnreadMatches';
import { t } from '@/i18n';
import { typography, useTheme } from '@/theme';

/** Deck bottom tabs: Discover, Likes, Matches (unread badge), Profile. Active = pink. */
export default function TabsLayout() {
  const { colors } = useTheme();
  const unread = useUnreadMatches();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        // Room for the 26 px icon, its badge and the label above the system bar.
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border, height: 64 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom + 6 },
        tabBarLabelStyle: { fontFamily: typography.label.fontFamily, fontSize: 12, lineHeight: 16 },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.discover'), tabBarIcon: ({ focused }) => <TabIcon name="cards-outline" focused={focused} /> }}
      />
      <Tabs.Screen
        name="likes"
        options={{ title: t('tabs.likes'), tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'heart' : 'heart-outline'} focused={focused} /> }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: t('tabs.matches'),
          tabBarAccessibilityLabel: unread ? t('tabs.matchesUnread', { count: unread }) : t('tabs.matches'),
          tabBarIcon: ({ focused }) => <TabIcon name="message-outline" focused={focused} badge={unread} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: ({ focused }) => <TabIcon name="account-outline" focused={focused} /> }}
      />
    </Tabs>
  );
}
