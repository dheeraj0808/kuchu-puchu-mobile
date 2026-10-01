import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { useLaunchBlocker } from '@/features/appConfig/useLaunchBlocker';
import { queryClient } from '@/lib/queryClient';
import { connectReactQueryToDevice } from '@/lib/reactQueryNative';
import { fontFiles, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Fonts that fail to load fall back to the system font rather than blocking launch.
  const [fontsLoaded, fontError] = useFonts(fontFiles);
  useEffect(connectReactQueryToDevice, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RootNavigator fontsReady={fontsLoaded || !!fontError} />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * The gate (guide §8). Decides where the user is each time the app opens,
 * /app/config changes or the session changes:
 *
 *   below minVersion ........ update-required (04)
 *   maintenance on .......... maintenance (05)
 *   offline at launch ....... offline (50)
 *   account restricted ...... restricted (49)
 *   no session .............. (auth)/welcome (01)
 *   nextStep ≠ done ......... (onboarding)
 *   nextStep = done ......... (app)
 *
 * Only one group is reachable at a time, so deep links can't skip the gate.
 */
function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { status, user, restriction } = useAuth();
  const { pending, blocker } = useLaunchBlocker();
  const { colors, scheme } = useTheme();

  const ready = fontsReady && !pending;
  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  // Nothing renders until the gate is decided, so protected content never flashes.
  if (!ready) return null;

  // 403 ACCOUNT_RESTRICTED: screen 49 only; nothing else is reachable.
  const restricted = status === 'signedIn' && restriction !== null;
  const open = blocker === null && !restricted;
  const onboarded = (user?.nextStep ?? 'done') === 'done';

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={blocker === 'updateRequired'}>
          <Stack.Screen name="update-required" />
        </Stack.Protected>
        <Stack.Protected guard={blocker === 'maintenance'}>
          <Stack.Screen name="maintenance" />
        </Stack.Protected>
        <Stack.Protected guard={blocker === 'offline'}>
          <Stack.Screen name="offline" />
        </Stack.Protected>
        <Stack.Protected guard={blocker === 'error'}>
          <Stack.Screen name="launch-error" />
        </Stack.Protected>
        <Stack.Protected guard={blocker === null && restricted}>
          <Stack.Screen name="restricted" />
        </Stack.Protected>
        <Stack.Protected guard={open && status === 'signedOut'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={open && status === 'signedIn' && !onboarded}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={open && status === 'signedIn' && onboarded}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
