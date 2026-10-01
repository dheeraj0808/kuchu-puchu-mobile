import { Stack } from 'expo-router';

import { ReauthSheet } from '@/features/auth/ReauthSheet';
import { useTheme } from '@/theme';

/** Signed-in app. The Discover / Likes / Matches / Profile tabs arrive in Phase 4. */
export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
      {/* One OTP step-up sheet for every REAUTH_REQUIRED in the signed-in app. */}
      <ReauthSheet />
    </>
  );
}
