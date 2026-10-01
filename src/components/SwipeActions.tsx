import { Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { spacing, useTheme } from '@/theme';

import { Icon } from './Icon';

type Action = 'pass' | 'superLike' | 'like';

interface Props {
  actions: Action[];
  name: string;
  onPass: () => void;
  onLike: () => void;
  onSuperLike?: () => void;
  disabled?: boolean;
}

/**
 * Deck 18/19 buttons: pass (black-outline circle), star (pink outline, behind
 * FEATURE_SUPER_LIKE) and like (large pink heart). Real buttons, so liking
 * never depends on swiping (guide §14).
 */
export function SwipeActions({ actions, name, onPass, onLike, onSuperLike, disabled }: Props) {
  const { colors } = useTheme();
  const button = (action: Action) => {
    if (action === 'pass') {
      return (
        <Pressable
          key={action}
          accessibilityRole="button"
          accessibilityLabel={t('discover.passLabel', { name })}
          disabled={disabled}
          onPress={onPass}
          style={({ pressed }) => [styles.circle, styles.pass, { borderColor: colors.outline, backgroundColor: colors.background, opacity: pressed ? 0.7 : 1 }]}>
          <Icon name="close" size={30} />
        </Pressable>
      );
    }
    if (action === 'superLike') {
      return (
        <Pressable
          key={action}
          accessibilityRole="button"
          accessibilityLabel={t('discover.superLikeLabel', { name })}
          disabled={disabled}
          onPress={onSuperLike}
          style={({ pressed }) => [styles.circle, styles.star, { borderColor: colors.primaryBorder, backgroundColor: colors.background, opacity: pressed ? 0.7 : 1 }]}>
          <Icon name="star" size={22} color="primary" />
        </Pressable>
      );
    }
    return (
      <Pressable
        key={action}
        accessibilityRole="button"
        accessibilityLabel={t('discover.likeLabel', { name })}
        disabled={disabled}
        onPress={onLike}
        style={({ pressed }) => [styles.circle, styles.like, { backgroundColor: colors.primary, borderColor: colors.primarySoft, opacity: pressed ? 0.85 : 1 }]}>
        <Icon name="heart" size={38} color="onPrimary" />
      </Pressable>
    );
  };
  return <View style={styles.row}>{actions.map(button)}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  circle: { alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  pass: { width: 64, height: 64, borderWidth: 2 },
  star: { width: 54, height: 54, borderWidth: 2 },
  like: { width: 80, height: 80, borderWidth: 4 },
});
