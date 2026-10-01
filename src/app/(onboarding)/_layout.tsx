import { Stack } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { ReauthSheet } from '@/features/auth/ReauthSheet';
import { resolveOnboardingScreen } from '@/features/onboarding/steps';
import { useTheme } from '@/theme';

/**
 * Onboarding (guide §8). Only the screen the server's progress points to is
 * reachable: when a step saves and /auth/me is reloaded, its guard closes and
 * the router moves to the next one. Reopening the app lands on the same step.
 */
export default function OnboardingLayout() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const screen = resolveOnboardingScreen(user);

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
        <Stack.Protected guard={screen === 'consent'}>
          <Stack.Screen name="consent" />
          <Stack.Screen name="selfie" options={{ animation: 'fade', contentStyle: { backgroundColor: colors.background } }} />
        </Stack.Protected>
        <Stack.Protected guard={screen === 'selfieReview'}>
          <Stack.Screen name="selfie-review" />
        </Stack.Protected>
        {/* Photos: its own step, or added while the selfie is in review. */}
        <Stack.Protected guard={screen === 'photos' || screen === 'selfieReview'}>
          <Stack.Screen name="photos" />
        </Stack.Protected>
        <Stack.Protected guard={screen === 'basics'}>
          <Stack.Screen name="basics" />
        </Stack.Protected>
        <Stack.Protected guard={screen === 'about'}>
          <Stack.Screen name="about" />
        </Stack.Protected>
        <Stack.Protected guard={screen === 'interests'}>
          <Stack.Screen name="interests" />
        </Stack.Protected>
        <Stack.Protected guard={screen === 'prompts'}>
          <Stack.Screen name="prompts" />
        </Stack.Protected>
        <Stack.Protected guard={screen === 'preferences'}>
          <Stack.Screen name="preferences" />
        </Stack.Protected>
        {/* The city picker belongs to the location step (permission denied or chosen). */}
        <Stack.Protected guard={screen === 'location'}>
          <Stack.Screen name="location" />
          <Stack.Screen name="city" />
        </Stack.Protected>
        <Stack.Protected guard={screen === 'notifications'}>
          <Stack.Screen name="notifications" />
        </Stack.Protected>
        <Stack.Protected guard={screen === 'later'}>
          <Stack.Screen name="setup" />
        </Stack.Protected>
      </Stack>
      <ReauthSheet />
    </>
  );
}
