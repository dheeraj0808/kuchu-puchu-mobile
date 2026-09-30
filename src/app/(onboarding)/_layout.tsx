import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

/** Onboarding (guide §8): consent → selfie → photos → basics … Screens arrive in Phase 2. */
export default function OnboardingLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
