import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { getVerification } from '@/api/endpoints/verification';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { REVIEW_POLL_MS, startPolling } from '@/features/verification/poller';
import { t } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';

function receivedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  const time = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return date.toDateString() === new Date().toDateString() ? t('review.today', { time }) : date.toLocaleDateString('en-IN');
}

/**
 * Screen 08 — Selfie in review. Polls GET /verification every 60 s while
 * open and refreshes on return to the foreground; when approved, /auth/me is
 * reloaded and the gate moves on. Photos can be added meanwhile.
 */
export default function SelfieReviewScreen() {
  const { colors } = useTheme();
  const { reloadUser } = useAuth();
  const verification = useQuery({ queryKey: ['verification'], queryFn: getVerification });
  const { refetch } = verification;

  useEffect(() => {
    const poll = startPolling(() => void refetch(), REVIEW_POLL_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && poll.refreshNow());
    return () => {
      sub.remove();
      poll.stop(); // Leaving the screen stops polling.
    };
  }, [refetch]);

  const status = verification.data?.face.status;
  useEffect(() => {
    if (status === 'approved') void reloadUser().catch(() => undefined);
  }, [status, reloadUser]);

  const approved = status === 'approved';
  const steps = [
    { title: t('review.received'), detail: receivedLabel(verification.data?.face.submittedAt ?? null) ?? '', state: 'done' as const },
    { title: t('review.safety'), detail: approved ? t('review.done') : t('review.inProgress'), state: approved ? ('done' as const) : ('current' as const) },
    { title: t('review.verified'), detail: t('review.verifiedBody'), state: approved ? ('done' as const) : ('next' as const) },
  ];

  return (
    <OnboardingScreen
      step="selfie"
      title={t('review.title')}
      subtitle={t('review.body')}
      hero={
        <View style={[styles.halo, { backgroundColor: colors.primarySoft }]}>
          <View style={[styles.ring, { borderColor: colors.primaryBorder, backgroundColor: colors.background }]}>
            <Icon name="clock-outline" size={32} color="primary" />
          </View>
        </View>
      }
      footer={<Button label={t('review.addPhotos')} onPress={() => router.push('/photos')} />}>
      <View style={[styles.timeline, { backgroundColor: colors.surface }]} accessibilityLiveRegion="polite">
        {steps.map((step) => (
          <View
            key={step.title}
            style={styles.step}
            accessible
            accessibilityLabel={t(step.state === 'done' ? 'review.stepDone' : step.state === 'current' ? 'review.stepCurrent' : 'review.stepNext', { step: step.title })}>
            {step.state === 'done' ? (
              <Icon name="check-circle" size={26} color="primary" />
            ) : (
              <View style={[styles.dot, { borderColor: step.state === 'current' ? colors.primary : colors.borderStrong }]} />
            )}
            <View style={styles.flex}>
              <AppText style={[typography.body, styles.title]}>{step.title}</AppText>
              {step.detail ? (
                <AppText variant="label" tone="muted" style={styles.detail}>
                  {step.detail}
                </AppText>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </OnboardingScreen>
  );
}

const HALO = 136;
const RING = 88;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  halo: { width: HALO, height: HALO, borderRadius: HALO / 2, alignItems: 'center', justifyContent: 'center' },
  ring: { width: RING, height: RING, borderRadius: RING / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  timeline: { borderRadius: radius.md, padding: spacing.md, gap: spacing.md },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2.5 },
  title: { fontFamily: typography.label.fontFamily },
  detail: { fontFamily: typography.body.fontFamily },
});
