import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { alpha, brand, layout, radius, spacing, useTheme } from '@/theme';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  /** Blocks closing (e.g. while a request is in flight). */
  locked?: boolean;
}

/** Bottom sheet (guide §5.3) with a soft shadow and a grab handle. */
export function Sheet({ visible, onClose, locked, children }: PropsWithChildren<SheetProps>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={locked ? undefined : onClose}>
      {/* Modals need their own gesture root on Android (sliders in the Filters sheet). */}
      <GestureHandlerRootView style={styles.flex}>
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: BACKDROP }]} onPress={locked ? undefined : onClose} importantForAccessibility="no" />
        <View
          accessibilityViewIsModal
          style={[styles.panel, { backgroundColor: colors.background, paddingBottom: insets.bottom, boxShadow: colors.shadowCard }]}>
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint, { backgroundColor: colors.elevatedTint }]} />
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
          {children}
        </View>
      </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const BACKDROP = alpha(brand.black, 0.45);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.xs,
  },
  tint: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.xs },
});
