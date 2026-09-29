import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="index" options={{ title: 'Account' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings', headerBackTitle: 'Account' }} />
    </Stack>
  );
}
