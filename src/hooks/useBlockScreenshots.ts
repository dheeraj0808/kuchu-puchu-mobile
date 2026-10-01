import { usePreventScreenCapture } from 'expo-screen-capture';
import { Platform } from 'react-native';

/**
 * Guide §13 rule 3: block screenshots on sensitive screens (selfie, contact
 * card, ID, delete account). expo-screen-capture has no web implementation
 * and throws there, so web gets a no-op.
 */
export const useBlockScreenshots: () => void = Platform.OS === 'web' ? () => undefined : () => usePreventScreenCapture();
