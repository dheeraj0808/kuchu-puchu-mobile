import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import type { IdentifierType } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StepScreen } from '@/components/StepScreen';
import { TextField } from '@/components/TextField';
import { requestCode } from '@/features/auth/requestCode';
import { useCountdown } from '@/hooks/useCountdown';
import { t } from '@/i18n';
import {
  COUNTRY_CODE,
  formatDuration,
  formatNationalPhone,
  isValidEmail,
  nationalDigits,
  normalizeEmail,
  normalizePhone,
  phoneProblem,
} from '@/lib/identifier';
import { spacing } from '@/theme';

const METHODS = [
  { value: 'phone', label: t('signIn.phoneTab') },
  { value: 'email', label: t('signIn.emailTab') },
] as const;

/**
 * Screen 02 — Sign in. Phone (+91, 10 digits) or email. "Send code" stays
 * disabled until the input is valid; the reply is the same for every number.
 * States: content, sending (button loading), rate-limited (countdown), error (banner).
 */
export default function SignInScreen() {
  const { notice, clearNotice } = useAuth();
  const inputRef = useRef<TextInput>(null);
  // Welcome passes the button the user tapped ("Continue with phone / email").
  const params = useLocalSearchParams<{ method?: string }>();

  const [method, setMethod] = useState<IdentifierType>(params.method === 'email' ? 'email' : 'phone');
  // Each tab keeps its own draft so switching doesn't lose what was typed.
  const [values, setValues] = useState<Record<IdentifierType, string>>({ email: '', phone: '' });
  const [serverInvalid, setServerInvalid] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  const waitSeconds = useCountdown(waitUntil) ?? 0;

  const isPhone = method === 'phone';
  const value = values[method];
  const identifier = isPhone ? normalizePhone(value) : isValidEmail(value) ? normalizeEmail(value) : null;
  // Only complain once the input looks finished; "Send code" is disabled meanwhile.
  const fieldError =
    serverInvalid || (isPhone ? phoneProblem(value) === 'invalid' : value.includes('@') && value.includes('.') && !identifier)
      ? t(isPhone ? 'signIn.phoneInvalid' : 'signIn.emailInvalid')
      : null;
  const waiting = waitSeconds > 0;

  const changeMethod = (next: IdentifierType) => {
    setMethod(next);
    setServerInvalid(false);
    setFormError(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const changeValue = (text: string) => {
    setValues((prev) => ({ ...prev, [method]: isPhone ? nationalDigits(text) : text }));
    setServerInvalid(false);
    if (formError) setFormError(null);
  };

  const submit = async () => {
    if (!identifier || submitting || waiting) return;
    clearNotice();
    setFormError(null);
    setSubmitting(true);
    const outcome = await requestCode(method, identifier);
    setSubmitting(false);

    switch (outcome.kind) {
      case 'sent':
        router.push('/verify');
        return;
      case 'wait':
        setWaitUntil(outcome.until);
        return;
      case 'invalid':
        setServerInvalid(true);
        inputRef.current?.focus();
        return;
      case 'error':
        setFormError(outcome.message);
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));

  return (
    <StepScreen
      title={t(isPhone ? 'signIn.titlePhone' : 'signIn.titleEmail')}
      subtitle={t(isPhone ? 'signIn.subtitlePhone' : 'signIn.subtitleEmail')}
      onBack={goBack}
      backDisabled={submitting}
      footer={
        <Button
          label={waiting ? t('signIn.waitToSend', { time: formatDuration(waitSeconds) }) : t('signIn.send')}
          loading={submitting}
          loadingLabel={t('signIn.sending')}
          disabled={!identifier || waiting}
          onPress={submit}
        />
      }>
      <View style={styles.form}>
        {notice ? <Banner tone="info" message={notice} /> : null}

        <SegmentedControl
          accessibilityLabel={t('signIn.methodLabel')}
          options={METHODS}
          value={method}
          onChange={changeMethod}
          disabled={submitting}
        />

        {isPhone ? (
          <TextField
            key="phone"
            ref={inputRef}
            label={t('signIn.phoneLabel')}
            prefix={COUNTRY_CODE}
            placeholder={t('signIn.phonePlaceholder')}
            hint={t('signIn.phoneHelper')}
            error={fieldError}
            value={formatNationalPhone(value)}
            onChangeText={changeValue}
            onSubmitEditing={submit}
            editable={!submitting}
            keyboardType="phone-pad"
            inputMode="tel"
            textContentType="telephoneNumber"
            autoComplete="tel-national"
            returnKeyType="send"
            maxLength={16}
            autoFocus
          />
        ) : (
          <TextField
            key="email"
            ref={inputRef}
            label={t('signIn.emailLabel')}
            placeholder={t('signIn.emailPlaceholder')}
            hint={t('signIn.emailHelper')}
            error={fieldError}
            value={value}
            onChangeText={changeValue}
            onSubmitEditing={submit}
            editable={!submitting}
            keyboardType="email-address"
            inputMode="email"
            textContentType="emailAddress"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            maxLength={254}
            autoFocus
          />
        )}

        {formError ? <Banner message={formError} actionLabel={t('common.tryAgain')} onAction={submit} /> : null}
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
});
