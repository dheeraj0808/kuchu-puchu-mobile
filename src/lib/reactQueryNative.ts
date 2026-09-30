import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, Platform, type AppStateStatus } from 'react-native';

/**
 * Teaches React Query what "focused" and "online" mean on a phone: queries
 * refetch when the app returns to the foreground or the network comes back.
 * Call once at startup; returns a cleanup function.
 */
export function connectReactQueryToDevice(): () => void {
  const unsubscribeNet = NetInfo.addEventListener((state) => {
    // `isInternetReachable` is null while unknown; treat unknown as online.
    onlineManager.setOnline(state.isConnected !== false && state.isInternetReachable !== false);
  });

  if (Platform.OS === 'web') return unsubscribeNet;

  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  });

  return () => {
    unsubscribeNet();
    subscription.remove();
  };
}
