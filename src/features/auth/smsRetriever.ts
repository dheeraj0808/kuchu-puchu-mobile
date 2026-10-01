import { NativeModules, Platform } from 'react-native';

import { extractCode } from './otpCode';

/**
 * Android SMS Retriever (guide §2): reads the one-time code from an SMS that
 * ends with this app's hash, with no SMS permission. The backend's DLT SMS
 * template must include the hash (`getAppHash()` in a dev build prints it).
 *
 * The native module is only present in development/production builds, not
 * in Expo Go, on iOS or on web; there every function quietly does nothing.
 */

type OtpVerifyModule = typeof import('react-native-otp-verify');

function load(): OtpVerifyModule | null {
  if (Platform.OS !== 'android' || !NativeModules.OtpVerify) return null;
  try {
    // Lazy: importing it eagerly crashes where the native module is missing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-otp-verify') as OtpVerifyModule;
  } catch {
    return null;
  }
}

/** Listens for the code SMS; returns a stop function. */
export function listenForSmsCode(length: number, onCode: (code: string) => void): () => void {
  const lib = load();
  if (!lib) return () => undefined;
  let active = true;

  lib
    .getOtp()
    .then(() =>
      lib.addListener((message: string) => {
        const code = active && message ? extractCode(message, length) : null;
        if (code) onCode(code);
      }),
    )
    .catch(() => undefined);

  return () => {
    active = false;
    lib.removeListener();
  };
}

/** The 11-character hash to put at the end of the OTP SMS template. */
export async function getAppHash(): Promise<string | null> {
  const lib = load();
  if (!lib) return null;
  try {
    return (await lib.getHash())[0] ?? null;
  } catch {
    return null;
  }
}
