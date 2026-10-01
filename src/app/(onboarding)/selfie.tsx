import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { StatusScreen } from '@/components/StatusScreen';
import { env } from '@/config/env';
import { SelfieController, type SelfieState } from '@/features/verification/selfieController';
import { useBlockScreenshots } from '@/hooks/useBlockScreenshots';
import { t, type TranslationKey } from '@/i18n';
import { layout, radius, spacing, typography, useTheme } from '@/theme';

const INSTRUCTION_KEYS = {
  centre: 'selfie.centre',
  turnLeft: 'selfie.turnLeft',
  turnRight: 'selfie.turnRight',
  lookUp: 'selfie.lookUp',
  holdStill: 'selfie.holdStill',
} as const satisfies Record<string, TranslationKey>;

/**
 * Screen 07 — Live selfie. Front camera in a pink oval, one instruction at a
 * time, progress, tips. Runs through the LivenessProvider interface and only
 * acts on the server's decision. Leaving the app mid-capture restarts the
 * session. Screenshots are blocked.
 */
export default function SelfieScreen() {
  useBlockScreenshots();
  const { reloadUser } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<SelfieState>({ kind: 'starting' });
  const controller = useRef<SelfieController | null>(null);

  useEffect(() => {
    const c = new SelfieController(setState, (err) => (err ? errorMessage(err) : t('selfie.errorBody')));
    controller.current = c;
    const sub = AppState.addEventListener('change', (s) => c.onAppState(s));
    return () => {
      sub.remove();
      c.stop();
      controller.current = null;
    };
  }, []);

  const granted = permission?.granted === true;
  useEffect(() => {
    if (granted) void controller.current?.start();
  }, [granted]);

  // The server decided: reload /auth/me and the gate moves on (photos or in review).
  useEffect(() => {
    if (state.kind === 'approved' || state.kind === 'review') void reloadUser().catch(() => undefined);
  }, [state.kind, reloadUser]);

  const close = () => {
    controller.current?.stop();
    if (router.canGoBack()) router.back();
    else router.replace('/consent');
  };
  const retry = () => void controller.current?.start();

  if (permission && !permission.granted) {
    return (
      <StatusScreen
        icon="camera-off-outline"
        title={t('selfie.permissionTitle')}
        message={t('selfie.permissionBody')}
        action={
          permission.canAskAgain
            ? { label: t('selfie.permissionAllow'), icon: 'camera-outline', onPress: () => void requestPermission() }
            : { label: t('selfie.permissionSettings'), icon: 'cog-outline', onPress: () => void Linking.openSettings() }
        }
      />
    );
  }
  if (state.kind === 'rejected') {
    const left = state.attemptsLeft;
    const attempts = left === null ? '' : ` ${left === 1 ? t('selfie.attemptLeft') : t('selfie.attemptsLeft', { count: left })}`;
    return (
      <StatusScreen
        icon="account-alert-outline"
        title={t('selfie.rejectedTitle')}
        message={`${state.reason ?? t('selfie.rejectedBody')}${attempts}`}
        action={{ label: t('selfie.tryAgain'), icon: 'refresh', onPress: retry }}
      />
    );
  }
  if (state.kind === 'exceeded') {
    return (
      <StatusScreen
        icon="clock-outline"
        title={t('selfie.exceededTitle')}
        message={t('selfie.exceededBody')}
        action={{ label: t('selfie.contactSupport'), variant: 'secondary', onPress: () => void Linking.openURL(env.supportUrl).catch(() => undefined) }}
      />
    );
  }
  if (state.kind === 'error') {
    return (
      <StatusScreen icon="alert-circle-outline" title={t('selfie.errorTitle')} message={state.message} action={{ label: t('selfie.tryAgain'), icon: 'refresh', onPress: retry }} />
    );
  }

  return <CaptureView state={state} cameraReady={granted} onClose={close} />;
}

function CaptureView({ state, cameraReady, onClose }: { state: SelfieState; cameraReady: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const [cameraFailed, setCameraFailed] = useState(false);
  const progress = state.kind === 'capturing' ? state.progress : state.kind === 'checking' || state.kind === 'approved' || state.kind === 'review' ? 1 : 0;
  const instruction =
    state.kind === 'capturing'
      ? t(INSTRUCTION_KEYS[state.instruction])
      : state.kind === 'checking' || state.kind === 'approved' || state.kind === 'review'
        ? t('selfie.checking')
        : t('selfie.starting');

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.camera }]}>
      <StatusBar style="light" />
      <View style={[styles.column, styles.flex]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('selfie.close')}
          onPress={onClose}
          hitSlop={8}
          style={[styles.close, { backgroundColor: colors.cameraChip }]}>
          <Icon name="close" size={24} color="onCamera" />
        </Pressable>

        <View style={styles.centre}>
          <View style={[styles.oval, { borderColor: colors.primary, backgroundColor: colors.cameraChip }]}>
            {cameraReady && !cameraFailed ? (
              <CameraView style={StyleSheet.absoluteFill} facing="front" mirror onMountError={() => setCameraFailed(true)} />
            ) : (
              <View style={styles.placeholder} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Icon name="account" size={120} color="cameraChipBorder" />
              </View>
            )}
          </View>

          <View style={[styles.pill, { backgroundColor: colors.onCamera }]} accessibilityLiveRegion="polite">
            <AppText style={[typography.button, { color: colors.camera }]} align="center">
              {instruction}
            </AppText>
          </View>

          <View style={styles.progressBlock}>
            <View
              style={[styles.track, { backgroundColor: colors.cameraTrack }]}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={t('selfie.checkingLive')}
              accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
              <View style={[styles.fill, { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <AppText variant="label" align="center" style={[styles.regular, { color: colors.cameraChipBorder }]}>
              {t('selfie.checkingLive')}
            </AppText>
          </View>
        </View>

        <View style={styles.tips}>
          {(['selfie.tipLight', 'selfie.tipMask', 'selfie.tipGlasses'] as const).map((key) => (
            <View key={key} style={[styles.tip, { backgroundColor: colors.cameraChip, borderColor: colors.cameraChipBorder }]}>
              <AppText variant="label" style={{ color: colors.onCamera }}>
                {t(key)}
              </AppText>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const OVAL_W = 260;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: layout.formMaxWidth, alignSelf: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  // '50%' on a non-square view draws an ellipse (deck 07 oval).
  oval: { width: OVAL_W, height: OVAL_W * 1.3, borderRadius: '50%', borderWidth: 4, overflow: 'hidden' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, maxWidth: '100%' },
  progressBlock: { alignSelf: 'stretch', gap: spacing.xs, paddingHorizontal: spacing.lg },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  regular: { fontFamily: typography.body.fontFamily },
  tips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  tip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs + 2 },
});
