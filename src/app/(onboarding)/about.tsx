import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { updateProfile } from '@/api/endpoints/profile';
import { errorMessage } from '@/api/errors';
import type { LookingFor, ProfileAbout } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Chip, ChipGroup } from '@/components/Chip';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { TextField } from '@/components/TextField';
import { BIO_MAX, SHORT_FIELD_MAX } from '@/features/onboarding/rules';
import { contactDetailsField, useSaveStep } from '@/features/onboarding/useSaveStep';
import { t } from '@/i18n';
import { spacing } from '@/theme';

const LOOKING_FOR: LookingFor[] = ['long_term', 'marriage', 'short_term', 'friends', 'not_sure'];
type Field = 'bio' | 'jobTitle' | 'education';

/**
 * Screen 11 — About you ("Tell people a little more"). Everything optional;
 * Skip saves nothing but records the step. PATCH /profile. A 422
 * CONTACT_DETAILS_NOT_ALLOWED highlights the field named in details.field.
 */
export default function AboutScreen() {
  const { user } = useAuth();
  const saved = user?.profile;
  const [values, setValues] = useState<Record<Field, string>>({
    bio: saved?.bio ?? '',
    jobTitle: saved?.jobTitle ?? '',
    education: saved?.education ?? '',
  });
  const [lookingFor, setLookingFor] = useState<LookingFor | null>(saved?.lookingFor ?? null);
  const [blockedField, setBlockedField] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const save = useSaveStep((body: ProfileAbout) => updateProfile(body));

  const change = (field: Field) => (text: string) => {
    setValues((v) => ({ ...v, [field]: text }));
    if (blockedField === field) setBlockedField(null);
  };

  const run = async (body: ProfileAbout) => {
    setFormError(null);
    setBlockedField(null);
    try {
      await save.mutateAsync(body);
    } catch (err) {
      const field = contactDetailsField(err);
      if (field) setBlockedField(field);
      else setFormError(errorMessage(err));
    }
  };

  const submit = () => {
    const body: ProfileAbout = {};
    (Object.keys(values) as Field[]).forEach((key) => {
      const v = values[key].trim();
      if (v) body[key] = v;
    });
    if (lookingFor) body.lookingFor = lookingFor;
    void run(body);
  };

  const fieldError = (field: Field) => (blockedField === field ? t('about.contactNotAllowed') : null);

  return (
    <OnboardingScreen
      step="about"
      title={t('about.title')}
      onSkip={() => void run({})}
      skipDisabled={save.isPending}
      footer={<Button label={t('common.continue')} loading={save.isPending} loadingLabel={t('common.saving')} onPress={submit} />}>
      <View style={styles.form}>
        <TextField
          label={t('about.bioLabel')}
          value={values.bio}
          onChangeText={change('bio')}
          placeholder={t('about.bioPlaceholder')}
          error={fieldError('bio')}
          multiline
          maxLength={BIO_MAX}
          showCounter
        />
        <TextField
          label={t('about.jobLabel')}
          value={values.jobTitle}
          onChangeText={change('jobTitle')}
          error={fieldError('jobTitle')}
          maxLength={SHORT_FIELD_MAX}
          autoCapitalize="sentences"
          autoComplete="organization-title"
        />
        <TextField
          label={t('about.educationLabel')}
          value={values.education}
          onChangeText={change('education')}
          error={fieldError('education')}
          maxLength={SHORT_FIELD_MAX}
          autoCapitalize="sentences"
        />
        <View style={styles.block}>
          <AppText variant="label">{t('about.lookingForLabel')}</AppText>
          <ChipGroup label={t('about.lookingForLabel')}>
            {LOOKING_FOR.map((option) => (
              <Chip
                key={option}
                role="radio"
                label={t(`lookingFor.${option}`)}
                selected={lookingFor === option}
                onPress={() => setLookingFor((current) => (current === option ? null : option))}
              />
            ))}
          </ChipGroup>
        </View>
        {formError ? <Banner message={formError} actionLabel={t('common.tryAgain')} onAction={submit} /> : null}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  block: { gap: spacing.sm },
});
