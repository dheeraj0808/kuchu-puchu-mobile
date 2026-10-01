import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { blockUser } from '@/api/endpoints/safety';
import { errorMessage } from '@/api/errors';
import type { ReportCategory } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ListScreen } from '@/components/ListScreen';
import { RadioRow } from '@/components/RadioRow';
import { StatusScreen } from '@/components/StatusScreen';
import { TextField } from '@/components/TextField';
import { ToggleRow } from '@/components/ToggleRow';
import { REPORT_CATEGORIES, REPORT_DETAILS_MAX, detailsProblem, submitReportFlow, type ReportOutcome } from '@/features/safety/reportFlow';
import { BLOCKS_KEY } from '@/features/safety/useBlocks';
import { t } from '@/i18n';
import { spacing } from '@/theme';

type Step = 'category' | 'details' | 'thanks';

/**
 * Screen 46 — Report (reusable: Discover, profile and chat open it with a
 * user id and name). Category → optional details → thank you. "Also block"
 * is on by default. The outcome of a report is never shown.
 */
export default function ReportScreen() {
  const params = useLocalSearchParams<{ userId: string; name?: string }>();
  const userId = String(params.userId);
  const name = params.name || t('common.thisPerson');

  const [step, setStep] = useState<Step>('category');
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ReportOutcome | null>(null);
  const [blocking, setBlocking] = useState(false);
  const queryClient = useQueryClient();

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const submit = async () => {
    if (!category || detailsProblem(details)) return;
    setSending(true);
    setError(null);
    try {
      const result = await submitReportFlow({ targetUserId: userId, category, details, alsoBlock });
      if (result.blocked) void queryClient.invalidateQueries({ queryKey: BLOCKS_KEY });
      setOutcome(result);
      setStep('thanks');
    } catch (err) {
      // 404 → "This profile is no longer available" (blocked, hidden and deleted look the same).
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const retryBlock = async () => {
    setBlocking(true);
    try {
      await blockUser(userId);
      void queryClient.invalidateQueries({ queryKey: BLOCKS_KEY });
      setOutcome({ blocked: true, blockFailed: false });
    } catch {
      // Keep the offer on screen.
    } finally {
      setBlocking(false);
    }
  };

  if (step === 'thanks' && outcome) {
    return (
      <StatusScreen
        icon="shield-check-outline"
        title={t('report.thanksTitle')}
        message={`${t('report.thanksBody', { name })}${outcome.blocked ? `\n\n${t('report.thanksBlocked', { name })}` : ''}`}
        action={{ label: t('report.done'), onPress: close }}
        secondaryAction={outcome.blockFailed ? { label: t('report.retryBlock'), loading: blocking, onPress: retryBlock } : undefined}
        caption={outcome.blockFailed ? t('report.blockFailed', { name }) : undefined}
      />
    );
  }

  if (step === 'details') {
    return (
      <ListScreen
        title={t('report.title', { name })}
        onBack={() => setStep('category')}
        footer={<Button label={t('report.submit')} loading={sending} loadingLabel={t('report.submitting')} disabled={!!detailsProblem(details)} onPress={submit} />}>
        <View style={styles.header}>
          <AppText variant="display">{t('report.detailsTitle')}</AppText>
          <AppText tone="muted">{t('report.detailsBody')}</AppText>
        </View>
        <TextField
          label={t('report.detailsLabel')}
          value={details}
          onChangeText={setDetails}
          placeholder={t('report.detailsPlaceholder')}
          multiline
          maxLength={REPORT_DETAILS_MAX}
          showCounter
        />
        {error ? <Banner message={error} actionLabel={t('common.tryAgain')} onAction={submit} /> : null}
      </ListScreen>
    );
  }

  return (
    <ListScreen
      title={t('report.title', { name })}
      onBack={close}
      close
      backLabel={t('report.close')}
      footer={<Button label={t('common.continue')} disabled={!category} onPress={() => setStep('details')} />}>
      <AppText variant="display">{t('report.question')}</AppText>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('report.categoriesLabel')} style={styles.list}>
        {REPORT_CATEGORIES.map((c) => (
          <RadioRow key={c} label={t(`reportCategories.${c}`)} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </View>
      <ToggleRow label={t('report.alsoBlock', { name })} hint={t('report.alsoBlockHint', { name })} value={alsoBlock} onChange={setAlsoBlock} />
    </ListScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  list: { gap: spacing.xs + 2 },
});
