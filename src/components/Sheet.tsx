import type { PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
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
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: BACKDROP }]} onPress={locked ? undefined : onClose} importantForAccessibility="no" />
        <View
          accessibilityViewIsModal
          style={[styles.panel, { backgroundColor: colors.background, paddingBottom: insets.bottom, boxShadow: colors.shadowCard }]}>
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

const BACKDROP = alpha(brand.black, 0.45);

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.xs,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.xs },
});
