import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { layout, radius, spacing, useTheme, alpha, brand } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** Red confirm button for irreversible actions. */
  destructive?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Centred confirmation (guide §5.3 "dialog for confirmations"). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  destructive,
  loading,
  loadingLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={loading ? undefined : onCancel}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: BACKDROP }]}
        onPress={loading ? undefined : onCancel}
        accessibilityLabel={t('common.cancel')}
        importantForAccessibility="no">
        <Pressable style={[styles.card, { backgroundColor: colors.background }]} accessibilityViewIsModal onPress={() => undefined}>
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint, { backgroundColor: colors.elevatedTint }]} />
          <View style={styles.copy}>
            <AppText variant="title" role="heading">
              {title}
            </AppText>
            <AppText tone="muted">{message}</AppText>
          </View>
          <View style={styles.actions}>
            <Button
              label={confirmLabel}
              variant={destructive ? 'destructive' : 'primary'}
              loading={loading}
              loadingLabel={loadingLabel}
              onPress={onConfirm}
            />
            <Button label={t('common.cancel')} variant="plain" disabled={loading} onPress={onCancel} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const BACKDROP = alpha(brand.black, 0.45);

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: layout.formMaxWidth, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.lg },
  tint: { borderRadius: radius.lg },
  copy: { gap: spacing.xs },
  actions: { gap: spacing.xxs },
});
