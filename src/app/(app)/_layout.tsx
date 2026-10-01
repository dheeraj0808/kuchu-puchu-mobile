import { Stack } from 'expo-router';

import { ReauthSheet } from '@/features/auth/ReauthSheet';
import { useTheme } from '@/theme';

export const unstable_settings = { initialRouteName: '(tabs)' };

/** Signed-in app: bottom tabs, with Settings, Report and Profile detail pushed on top. */
export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="people/[userId]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="report/[userId]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" />
      </Stack>
      {/* One OTP step-up sheet for every REAUTH_REQUIRED in the signed-in app. */}
      <ReauthSheet />
    </>
  );
}
