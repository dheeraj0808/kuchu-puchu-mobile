import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import * as authApi from '@/api/auth';
import { ErrorCode, isApiError, errorMessage } from '@/api/errors';
import type { IdentifierType } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { Wordmark } from '@/components/Wordmark';
import { resumeOtpFlowAfterCooldown, startOtpFlow } from '@/features/auth/otpFlow';
import { normalizeIdentifier, validateIdentifier } from '@/lib/identifier';
import { spacing } from '@/theme';

const METHODS = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
] as const;

export default function SignInScreen() {
  const { notice, clearNotice } = useAuth();
  const inputRef = useRef<TextInput>(null);

  const [method, setMethod] = useState<IdentifierType>('email');
  // Keep each method's draft so switching tabs doesn't lose what was typed.
  const [values, setValues] = useState<Record<IdentifierType, string>>({ email: '', phone: '' });
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const value = values[method];

  const changeMethod = (next: IdentifierType) => {
    setMethod(next);
    setFieldError(null);
    setFormError(null);
    setSubmitted(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const changeValue = (text: string) => {
    setValues((prev) => ({ ...prev, [method]: text }));
    if (formError) setFormError(null);
    // Re-validate live only after the first submit attempt, to avoid nagging.
    if (submitted) setFieldError(validateIdentifier(method, text));
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitted(true);
    setFormError(null);
    clearNotice();

    const error = validateIdentifier(method, value);
    setFieldError(error);
    if (error) {
      inputRef.current?.focus();
      return;
    }

    const identifier = normalizeIdentifier(method, value);
    setSubmitting(true);
    try {
      const response = await authApi.requestOtp({ identifierType: method, identifier });
      startOtpFlow(method, identifier, response);
      router.push('/verify');
    } catch (err) {
      if (isApiError(err) && err.code === ErrorCode.OtpCooldown && err.retryAfterSeconds) {
        // A code was sent moments ago and is still valid — continue with it.
        resumeOtpFlowAfterCooldown(method, identifier, err.retryAfterSeconds);
        router.push('/verify');
        return;
      }
      if (isApiError(err) && err.fieldErrors.identifier) {
        setFieldError(err.fieldErrors.identifier);
        inputRef.current?.focus();
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isEmail = method === 'email';

  return (
    <Screen>
      <View style={styles.stack}>
        <Wordmark />

        <View style={styles.copy}>
          <AppText variant="display">Welcome</AppText>
          <AppText tone="muted">Sign in or create your account. We’ll send a one-time code to confirm it’s you.</AppText>
        </View>

        {notice ? <Banner tone="info" message={notice} /> : null}

        <SegmentedControl
          accessibilityLabel="Sign in with"
          options={METHODS}
          value={method}
          onChange={changeMethod}
          disabled={submitting}
        />

        <TextField
          key={method}
          ref={inputRef}
          label={isEmail ? 'Email address' : 'Phone number'}
          placeholder={isEmail ? 'you@example.com' : '+91 98765 43210'}
          hint={isEmail ? undefined : 'Include your country code.'}
          value={value}
          onChangeText={changeValue}
          onBlur={() => submitted && setFieldError(validateIdentifier(method, value))}
          onSubmitEditing={submit}
          error={fieldError}
          editable={!submitting}
          keyboardType={isEmail ? 'email-address' : 'phone-pad'}
          inputMode={isEmail ? 'email' : 'tel'}
          textContentType={isEmail ? 'emailAddress' : 'telephoneNumber'}
          autoComplete={isEmail ? 'email' : 'tel'}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          maxLength={isEmail ? 254 : 24}
          autoFocus
        />

        {formError ? <Banner message={formError} actionLabel="Retry" onAction={submit} /> : null}

        <Button label="Send code" loading={submitting} loadingLabel="Sending code…" onPress={submit} />

        <View style={styles.trust}>
          <AppText variant="caption" tone="muted" align="center">
            🔒 Passwordless sign-in. Codes expire after a few minutes and can only be used once.
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  copy: { gap: spacing.xs },
  trust: { paddingHorizontal: spacing.sm },
});
