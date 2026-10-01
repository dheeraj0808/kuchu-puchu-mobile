import * as Clipboard from 'expo-clipboard';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import * as authApi from '@/api/auth';
import { ErrorCode, errorMessage, isApiError } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { getDeviceInfo } from '@/auth/device';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { NumericKeypad } from '@/components/NumericKeypad';
import { OtpBoxes } from '@/components/OtpBoxes';
import { StepScreen } from '@/components/StepScreen';
import { env } from '@/config/env';
import { applyKey, extractCode, type KeypadKey } from '@/features/auth/otpCode';
import { setResendCooldown, startOtpFlow, useOtpFlow, type OtpFlow } from '@/features/auth/otpFlow';
import { DEFAULT_WAIT_SECONDS } from '@/features/auth/requestCode';
import { listenForSmsCode } from '@/features/auth/smsRetriever';
import { useCountdown } from '@/hooks/useCountdown';
import { t } from '@/i18n';
import { formatDuration, formatPhone } from '@/lib/identifier';
import { fonts, spacing, typography } from '@/theme';

export default function VerifyScreen() {
  const flow = useOtpFlow();
  // Opened without a code request (deep link, restart): start over.
  if (!flow) return <Redirect href="/sign-in" />;
  return <VerifyForm flow={flow} />;
}

type Feedback = { tone: 'error' | 'info'; message: string; retry?: boolean } | null;

/**
 * Screen 03 — Verify code. Six boxes fed by the keypad, paste (long-press)
 * or Android SMS Retriever; submits when full. Wrong code → shake + message;
 * after OTP_MAX_ATTEMPTS wrong tries the user must ask for a new code.
 * Success hands the tokens to the SessionManager and the gate routes by nextStep.
 */
function VerifyForm({ flow }: { flow: OtpFlow }) {
  const { signIn } = useAuth();
  const length = env.otpLength;
  const verifyingRef = useRef(false);

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(
    flow.expiresAt === null ? { tone: 'info', message: t('verify.earlierCode') } : null,
  );

  const resendIn = useCountdown(flow.resendAvailableAt) ?? 0;
  const expiresIn = useCountdown(flow.expiresAt);
  const lockIn = useCountdown(lockedUntil) ?? 0;

  const expired = expiresIn === 0;
  const outOfTries = failedAttempts >= env.otpMaxAttempts;
  const blocked = expired || outOfTries;
  const inputDisabled = verifying || blocked || lockIn > 0;

  // A new code was sent: start fresh.
  const firstSend = useRef(flow.sendCount);
  useEffect(() => {
    if (flow.sendCount === firstSend.current) return;
    setCode('');
    setCodeError(null);
    setFailedAttempts(0);
    setFeedback({ tone: 'info', message: t('verify.resent') });
  }, [flow.sendCount]);

  const verify = useCallback(
    async (otp: string) => {
      if (verifyingRef.current) return;
      verifyingRef.current = true;
      setVerifying(true);
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
        // The gate switches to onboarding or the app once the session is stored.
        await signIn(tokens);
      } catch (err) {
        if (isApiError(err) && err.code === ErrorCode.OtpInvalid) {
          const attempts = failedAttempts + 1;
          setFailedAttempts(attempts);
          setShakeKey((k) => k + 1);
          setCode('');
          setCodeError(attempts >= env.otpMaxAttempts ? t('verify.tooManyTries') : t('verify.wrongCode'));
        } else if (isApiError(err) && err.status === 429) {
          setLockedUntil(Date.now() + (err.retryAfterSeconds ?? DEFAULT_WAIT_SECONDS) * 1000);
          setCode('');
        } else {
          const retry = isApiError(err) && (err.isNetworkError || (err.status ?? 0) >= 500);
          setFeedback({ tone: 'error', message: errorMessage(err), retry });
        }
      } finally {
        verifyingRef.current = false;
        setVerifying(false);
      }
    },
    [flow, signIn, failedAttempts],
  );

  const enterCode = useCallback(
    (next: string) => {
      setCode(next);
      if (next.length === length) void verify(next);
    },
    [length, verify],
  );

  const onKey = (key: KeypadKey) => {
    if (inputDisabled) return;
    if (codeError && !outOfTries) setCodeError(null);
    const next = applyKey(code, key, length);
    if (next !== code) enterCode(next);
  };

  const paste = async () => {
    if (inputDisabled) return;
    const found = extractCode(await Clipboard.getStringAsync().catch(() => ''), length);
    if (found) enterCode(found);
  };

  // Android SMS Retriever: fill and submit the code as soon as the SMS arrives.
  const onSmsCode = useEffectEvent((found: string) => {
    if (!inputDisabled) enterCode(found);
  });
  useEffect(() => listenForSmsCode(length, onSmsCode), [length, flow.sendCount]);

  const resend = async () => {
    if (resending || resendIn > 0) return;
    setResending(true);
    setFeedback(null);
    try {
      const response = await authApi.requestOtp({ identifierType: flow.identifierType, identifier: flow.identifier });
      startOtpFlow(flow.identifierType, flow.identifier, response);
    } catch (err) {
      if (isApiError(err) && err.status === 429) setResendCooldown(err.retryAfterSeconds ?? DEFAULT_WAIT_SECONDS);
      else setFeedback({ tone: 'error', message: errorMessage(err) });
    } finally {
      setResending(false);
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/sign-in'));
  const destination = flow.identifierType === 'phone' ? formatPhone(flow.identifier) : flow.identifier;

  const status = codeError
    ? { text: codeError, tone: 'danger' as const }
    : expired
      ? { text: t('verify.expired'), tone: 'danger' as const }
      : lockIn > 0
        ? { text: t('verify.lockedFor', { time: formatDuration(lockIn) }), tone: 'danger' as const }
        : verifying
          ? { text: t('verify.checking'), tone: 'muted' as const }
          : null;

  return (
    <StepScreen
      title={t('verify.title')}
      onBack={goBack}
      backDisabled={verifying}
      subtitle={
        <AppText tone="muted">
          {t('verify.sentTo', { destination })}
          <AppText
            tone="primary"
            style={styles.change}
            accessibilityRole="link"
            accessibilityLabel={t('verify.changeLabel', { destination })}
            onPress={verifying ? undefined : goBack}>
            {t('verify.change')}
          </AppText>
        </AppText>
      }
      footerFullWidth
      footer={<NumericKeypad onKey={onKey} disabled={inputDisabled} />}>
      <View style={styles.codeBlock}>
        <OtpBoxes
          value={code}
          length={length}
          invalid={!!codeError}
          disabled={inputDisabled}
          shakeKey={shakeKey}
          onPaste={paste}
        />

        <View style={styles.status} accessibilityLiveRegion="polite">
          {status ? (
            <AppText variant="caption" tone={status.tone} align="center" role={status.tone === 'danger' ? 'alert' : undefined}>
              {status.text}
            </AppText>
          ) : null}
          {resendIn > 0 ? (
            <AppText variant="caption" tone="muted" align="center">
              {t('verify.resendIn')}
              <AppText variant="caption" style={styles.time}>
                {formatDuration(resendIn)}
              </AppText>
            </AppText>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('verify.resend')}
              accessibilityState={{ disabled: resending, busy: resending }}
              disabled={resending}
              onPress={resend}
              hitSlop={12}>
              <AppText style={[typography.label, styles.resend]} tone="primary" align="center">
                {resending ? t('verify.resending') : t('verify.resend')}
              </AppText>
            </Pressable>
          )}
        </View>

        {feedback ? (
          <Banner
            tone={feedback.tone}
            message={feedback.message}
            actionLabel={feedback.retry ? t('common.tryAgain') : undefined}
            onAction={feedback.retry ? () => void verify(code) : undefined}
          />
        ) : null}
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  codeBlock: { gap: spacing.md },
  status: { gap: spacing.xs, minHeight: 40 },
  change: { fontFamily: fonts.semibold },
  time: { fontFamily: fonts.bold },
  resend: { paddingVertical: spacing.xxs },
});
