import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import * as authApi from '@/api/auth';
import { ErrorCode, errorMessage, isApiError } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { getDeviceInfo } from '@/auth/device';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { OtpInput } from '@/components/OtpInput';
import { Screen } from '@/components/Screen';
import { env } from '@/config/env';
import { setResendCooldown, startOtpFlow, useOtpFlow, type OtpFlow } from '@/features/auth/otpFlow';
import { useCountdown } from '@/hooks/useCountdown';
import { formatDuration, maskIdentifier, validateOtp } from '@/lib/identifier';
import { spacing } from '@/theme';

/** Used when the backend throttles without saying how long to wait. */
const DEFAULT_LOCK_SECONDS = 60;

export default function VerifyScreen() {
  const flow = useOtpFlow();
  // Deep link / refresh with no code requested: start over.
  if (!flow) return <Redirect href="/sign-in" />;
  return <VerifyForm flow={flow} />;
}

type Feedback = { tone: 'error' | 'info' | 'success'; message: string; retry?: boolean } | null;

function VerifyForm({ flow }: { flow: OtpFlow }) {
  const { signIn } = useAuth();
  const inputRef = useRef<TextInput>(null);
  const verifyingRef = useRef(false);
  const length = env.otpLength;

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(
    flow.expiresAt === null
      ? { tone: 'info', message: 'We sent you a code a moment ago — enter it below.' }
      : null,
  );
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const expiresIn = useCountdown(flow.expiresAt);
  const resendIn = useCountdown(flow.resendAvailableAt) ?? 0;
  const lockIn = useCountdown(lockedUntil) ?? 0;

  const expired = expiresIn === 0;
  const attemptsExhausted = failedAttempts >= env.otpMaxAttempts;
  const locked = lockIn > 0;
  const blocked = expired || attemptsExhausted;

  // A new code was sent: start fresh.
  const sendCount = flow.sendCount;
  const firstSend = useRef(sendCount);
  useEffect(() => {
    if (sendCount === firstSend.current) return;
    setCode('');
    setCodeError(null);
    setFailedAttempts(0);
    setLastSubmitted(null);
    setFeedback({ tone: 'success', message: 'We sent you a new code.' });
    inputRef.current?.focus();
  }, [sendCount]);

  const verify = useCallback(
    async (otp: string) => {
      if (verifyingRef.current) return;
      const invalid = validateOtp(otp, length);
      if (invalid) {
        setCodeError(invalid);
        return;
      }
      verifyingRef.current = true;
      setVerifying(true);
      setLastSubmitted(otp);
      setCodeError(null);
      setFeedback(null);
      try {
        const device = await getDeviceInfo();
        const tokens = await authApi.verifyOtp({
          identifierType: flow.identifierType,
          identifier: flow.identifier,
          otp,
          deviceId: device.deviceId,
          deviceName: device.deviceName,
        });
        // Route guards switch to the app once the session is stored.
        await signIn(tokens);
      } catch (err) {
        handleVerifyError(err);
      } finally {
        verifyingRef.current = false;
        setVerifying(false);
      }

      function handleVerifyError(err: unknown) {
        if (!isApiError(err)) {
          setFeedback({ tone: 'error', message: errorMessage(err) });
          return;
        }
        if (err.code === ErrorCode.OtpInvalid) {
          const attempts = failedAttempts + 1;
          setFailedAttempts(attempts);
          const nowExpired = flow.expiresAt !== null && Date.now() >= flow.expiresAt;
          if (nowExpired) {
            setCodeError('This code has expired. Request a new one below.');
          } else if (attempts >= env.otpMaxAttempts) {
            setCodeError('Too many incorrect attempts. Request a new code to continue.');
          } else {
            setCodeError('That code isn’t right. Check it and try again.');
            setCode('');
            inputRef.current?.focus();
          }
          return;
        }
        if (err.status === 429) {
          setLockedUntil(Date.now() + (err.retryAfterSeconds ?? DEFAULT_LOCK_SECONDS) * 1000);
          setFeedback({ tone: 'error', message: 'Too many attempts. Please wait before trying again.' });
          return;
        }
        if (err.fieldErrors.otp) {
          setCodeError(err.fieldErrors.otp);
          return;
        }
        if (err.fieldErrors.identifier) {
          setFeedback({ tone: 'error', message: 'Please go back and check your email or phone number.' });
          return;
        }
        setFeedback({ tone: 'error', message: err.message, retry: err.isNetworkError || (err.status ?? 0) >= 500 });
      }
    },
    [flow, length, signIn, failedAttempts],
  );

  const changeCode = (next: string) => {
    setCode(next);
    if (codeError && !blocked) setCodeError(null);
    // Auto-submit once all digits are in — but never resubmit the same code.
    if (next.length === length && next !== lastSubmitted && !blocked && !locked) {
      void verify(next);
    }
  };

  const resend = async () => {
    if (resending || resendIn > 0) return;
    setResending(true);
    setFeedback(null);
    try {
      const response = await authApi.requestOtp({ identifierType: flow.identifierType, identifier: flow.identifier });
      startOtpFlow(flow.identifierType, flow.identifier, response);
    } catch (err) {
      if (isApiError(err) && err.status === 429) {
        setResendCooldown(err.retryAfterSeconds ?? DEFAULT_LOCK_SECONDS);
      }
      setFeedback({ tone: 'error', message: errorMessage(err) });
    } finally {
      setResending(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/sign-in');
  };

  const destination = maskIdentifier(flow.identifierType, flow.identifier);
  const canSubmit = code.length === length && !blocked && !locked && !verifying;

  return (
    <Screen>
      <View style={styles.stack}>
        <Button
          label={flow.identifierType === 'email' ? '‹ Use a different email' : '‹ Use a different number'}
          variant="ghost"
          fullWidth={false}
          style={styles.back}
          disabled={verifying}
          onPress={goBack}
        />

        <View style={styles.copy}>
          <AppText variant="title">Enter your code</AppText>
          <AppText tone="muted">
            We sent a {length}-digit code to <AppText style={styles.strong}>{destination}</AppText>.
          </AppText>
        </View>

        {feedback ? (
          <Banner
            tone={feedback.tone}
            message={feedback.message}
            actionLabel={feedback.retry ? 'Try again' : undefined}
            onAction={feedback.retry ? () => void verify(code) : undefined}
          />
        ) : null}

        <View style={styles.codeBlock}>
          <OtpInput
            ref={inputRef}
            value={code}
            onChange={changeCode}
            length={length}
            disabled={verifying || blocked}
            invalid={!!codeError}
            autoFocus
          />
          <View style={styles.status} accessibilityLiveRegion="polite">
            {codeError ? (
              <AppText variant="caption" tone="danger" role="alert">
                {codeError}
              </AppText>
            ) : expired ? (
              <AppText variant="caption" tone="danger">
                This code has expired. Request a new one below.
              </AppText>
            ) : locked ? (
              <AppText variant="caption" tone="muted">
                You can try again in {formatDuration(lockIn)}.
              </AppText>
            ) : expiresIn !== null ? (
              <AppText variant="caption" tone="muted">
                Code expires in {formatDuration(expiresIn)}
              </AppText>
            ) : null}
          </View>
        </View>

        <Button
          label="Verify"
          loading={verifying}
          loadingLabel="Verifying…"
          disabled={!canSubmit}
          onPress={() => void verify(code)}
        />

        <View style={styles.resend}>
          <AppText variant="caption" tone="muted">
            Didn’t get a code?
          </AppText>
          <Button
            label={resendIn > 0 ? `Resend in ${formatDuration(resendIn)}` : 'Resend code'}
            variant="ghost"
            fullWidth={false}
            loading={resending}
            loadingLabel="Sending…"
            disabled={resendIn > 0 || verifying}
            onPress={resend}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  back: { alignSelf: 'flex-start', marginLeft: -spacing.sm },
  copy: { gap: spacing.xs },
  strong: { fontWeight: '600' },
  codeBlock: { gap: spacing.sm },
  status: { minHeight: 18, alignItems: 'center' },
  resend: { alignItems: 'center', gap: spacing.xxs },
});
