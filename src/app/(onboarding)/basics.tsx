import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createProfile } from '@/api/endpoints/profile';
import { ErrorCode, errorMessage, isApiError } from '@/api/errors';
import type { Gender, ProfileBasics } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Chip, ChipGroup } from '@/components/Chip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { TextField } from '@/components/TextField';
import { ToggleRow } from '@/components/ToggleRow';
import {
  NAME_MAX,
  ageOn,
  dobProblem,
  formatDobInput,
  nameProblem,
  parseDob,
  toIsoDate,
  todayLocal,
} from '@/features/onboarding/rules';
import { contactDetailsField, useSaveStep } from '@/features/onboarding/useSaveStep';
import { t } from '@/i18n';
import { spacing } from '@/theme';

const GENDERS: Gender[] = ['woman', 'man', 'non_binary', 'other'];

/**
 * Screen 10 — Basics ("About you"): first name, date of birth (18+, locked
 * once saved, confirmed in a dialog), gender and whether to show it. POST /profile.
 */
export default function BasicsScreen() {
  const { reloadUser } = useAuth();
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [showGender, setShowGender] = useState(true);
  const [touched, setTouched] = useState({ name: false, dob: false });
  const [confirming, setConfirming] = useState(false);
  const [serverField, setServerField] = useState<{ field: 'firstName' | 'dob'; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const save = useSaveStep((body: ProfileBasics) => createProfile(body));

  const nameIssue = nameProblem(name);
  const dobIssue = dobProblem(dob);
  const parsed = parseDob(dob);
  const age = parsed ? ageOn(parsed, todayLocal()) : null;
  const valid = !nameIssue && !dobIssue && gender !== null;

  const nameError =
    serverField?.field === 'firstName'
      ? serverField.message
      : touched.name && nameIssue
        ? t(nameIssue === 'tooShort' ? 'basics.nameTooShort' : 'basics.nameTooLong')
        : null;
  const dobError =
    serverField?.field === 'dob'
      ? serverField.message
      : dobIssue && dobIssue !== 'incomplete'
        ? t(dobIssue === 'underage' ? 'basics.dobUnderage' : dobIssue === 'future' ? 'basics.dobFuture' : 'basics.dobInvalid')
        : touched.dob && dobIssue === 'incomplete' && dob.length > 0
          ? t('basics.dobInvalid')
          : null;

  const submit = async () => {
    if (!valid || !parsed || !gender) return;
    setFormError(null);
    setServerField(null);
    try {
      await save.mutateAsync({ firstName: name.trim(), dateOfBirth: toIsoDate(parsed), gender, showGender });
    } catch (err) {
      setConfirming(false);
      if (contactDetailsField(err)) setServerField({ field: 'firstName', message: t('about.contactNotAllowed') });
      else if (isApiError(err) && err.code === ErrorCode.Underage) setServerField({ field: 'dob', message: t('basics.dobUnderage') });
      else if (isApiError(err) && err.code === ErrorCode.ProfileAlreadyExists) await reloadUser().catch(() => undefined);
      else setFormError(errorMessage(err));
    }
  };

  return (
    <OnboardingScreen
      step="basics"
      title={t('basics.title')}
      footer={<Button label={t('common.continue')} disabled={!valid} onPress={() => setConfirming(true)} />}>
      <View style={styles.form}>
        <TextField
          label={t('basics.nameLabel')}
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (serverField?.field === 'firstName') setServerField(null);
          }}
          onBlur={() => setTouched((s) => ({ ...s, name: true }))}
          hint={t('basics.nameHelper')}
          error={nameError}
          maxLength={NAME_MAX}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="next"
        />
        <TextField
          label={t('basics.dobLabel')}
          value={dob}
          onChangeText={(v) => {
            setDob(formatDobInput(v));
            if (serverField?.field === 'dob') setServerField(null);
          }}
          onBlur={() => setTouched((s) => ({ ...s, dob: true }))}
          placeholder={t('basics.dobPlaceholder')}
          hint={age !== null && !dobIssue ? t('basics.dobAge', { age }) : t('basics.dobHelper')}
          error={dobError}
          rightIcon="lock-outline"
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete="birthdate-full"
          maxLength={14}
        />
        <View style={styles.block}>
          <AppText variant="label">{t('basics.genderLabel')}</AppText>
          <ChipGroup label={t('basics.genderLabel')}>
            {GENDERS.map((g) => (
              <Chip key={g} role="radio" label={t(`genders.${g}`)} selected={gender === g} onPress={() => setGender(g)} />
            ))}
          </ChipGroup>
        </View>
        <ToggleRow label={t('basics.showGender')} value={showGender} onChange={setShowGender} />
        {formError ? <Banner message={formError} actionLabel={t('common.tryAgain')} onAction={() => setConfirming(true)} /> : null}
      </View>

      <ConfirmDialog
        visible={confirming}
        title={t('basics.confirmTitle')}
        message={t('basics.confirmBody', { date: dob, age: age ?? '' })}
        confirmLabel={t('basics.confirmYes')}
        loading={save.isPending}
        loadingLabel={t('common.saving')}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  block: { gap: spacing.sm },
});
