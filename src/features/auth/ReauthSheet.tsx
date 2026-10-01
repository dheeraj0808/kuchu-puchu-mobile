import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import * as accountApi from '@/api/account';
import { ErrorCode, errorMessage, isApiError } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { cancelReauth, completeReauth, useReauthStore } from '@/auth/reauth';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Icon } from '@/components/Icon';
import { NumericKeypad } from '@/components/NumericKeypad';
import { OtpBoxes } from '@/components/OtpBoxes';
import { Sheet } from '@/components/Sheet';
import { env } from '@/config/env';
import { useCountdown } from '@/hooks/useCountdown';
import { t } from '@/i18n';
import { formatDuration, formatPhone, maskEmail } from '@/lib/identifier';
import { fonts, spacing, typography } from '@/theme';

import { applyKey, type KeypadKey } from './otpCode';
import { DEFAULT_WAIT_SECONDS } from './requestCode';

/**
 * OTP step-up sheet (guide §11 REAUTH_REQUIRED). Mounted once for the
 * signed-in app; opens whenever reauth.ts asks for it. Sends a code on open,
 * verifies on the sixth digit, then lets the original request repeat.
 */
export function ReauthSheet() {
  const visible = useReauthStore((s) => s.visible);
  const round = useReauthStore((s) => s.round);
  return (
    <Sheet visible={visible} onClose={cancelReauth}>
      {visible ? <ReauthForm key={round} /> : null}
    </Sheet>
  );
}

function ReauthForm() {
  const { user } = useAuth();
  const length = env.otpLength;
  const verifyingRef = useRef(false);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [sending, setSending] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const resendIn = useCountdown(resendAt) ?? 0;

  const handleSent = (res: { resendAfterSeconds: number }) => {
    setResendAt(Date.now() + res.resendAfterSeconds * 1000);
    setSending(false);
  };
  const handleSendFailed = (err: unknown) => {
    // A code sent moments ago still works: just show the countdown.
    if (isApiError(err) && err.code === ErrorCode.OtpCooldown) {
      setResendAt(Date.now() + (err.retryAfterSeconds ?? DEFAULT_WAIT_SECONDS) * 1000);
    } else {
      setError(isApiError(err) && err.isNetworkError ? errorMessage(err) : t('reauth.sendFailed'));
    }
    setSending(false);
  };
  const onSent = useEffectEvent(handleSent);
  const onSendFailed = useEffectEvent(handleSendFailed);

  // First code goes out as the sheet opens (state starts as "sending").
  useEffect(() => {
    accountApi.requestReauthCode().then(
      (res) => onSent(res),
      (err: unknown) => onSendFailed(err),
    );
  }, []);

  const send = () => {
    setSending(true);
    setError(null);
    accountApi.requestReauthCode().then(handleSent, handleSendFailed);
  };

  const verify = async (otp: string) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifying(true);
    setError(null);
    try {
      await accountApi.verifyReauthCode(otp);
      completeReauth();
    } catch (err) {
      setCode('');
      if (isApiError(err) && err.code === ErrorCode.OtpInvalid) {
        setShakeKey((k) => k + 1);
        setError(t('reauth.wrongCode'));
      } else {
        setError(errorMessage(err));
      }
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  };

  const onKey = (key: KeypadKey) => {
    if (verifying || sending) return;
    if (error) setError(null);
    const next = applyKey(code, key, length);
    setCode(next);
    if (next.length === length) void verify(next);
  };

  const destination = user?.phone ? formatPhone(user.phone) : user?.email ? maskEmail(user.email) : null;

  return (
    <View style={styles.body}>
      <View style={styles.header}>
        <AppText variant="title" style={styles.title}>
          {t('reauth.title')}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('reauth.close')}
          onPress={cancelReauth}
          hitSlop={12}
          disabled={verifying}>
          <Icon name="close" size={24} />
        </Pressable>
      </View>
      <View style={styles.content}>
        <AppText tone="muted">
          {destination ? t('reauth.sentTo', { destination }) : t('reauth.sentToAccount')}
        </AppText>
        <OtpBoxes value={code} length={length} invalid={!!error} disabled={verifying || sending} shakeKey={shakeKey} />
        <View style={styles.status} accessibilityLiveRegion="polite">
          {error ? (
            <AppText variant="caption" tone="danger" align="center" role="alert">
              {error}
            </AppText>
          ) : sending || verifying ? (
            <AppText variant="caption" tone="muted" align="center">
              {sending ? t('reauth.sending') : t('reauth.checking')}
            </AppText>
          ) : null}
          {resendIn > 0 ? (
            <AppText variant="caption" tone="muted" align="center">
              {t('reauth.resendIn')}
              <AppText variant="caption" style={styles.time}>
                {formatDuration(resendIn)}
              </AppText>
            </AppText>
          ) : !sending ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('reauth.resend')} onPress={send} hitSlop={12}>
              <AppText style={typography.label} tone="primary" align="center">
                {t('reauth.resend')}
              </AppText>
            </Pressable>
          ) : null}
        </View>
        {error && !sending && resendAt === null ? <Banner message={error} actionLabel={t('common.tryAgain')} onAction={send} /> : null}
      </View>
      <NumericKeypad onKey={onKey} disabled={verifying || sending} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  title: { flex: 1 },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  status: { gap: spacing.xs, minHeight: 40 },
  time: { fontFamily: fonts.bold },
});
