import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { unblock } from '@/api/endpoints/safety';
import type { BlockedUser } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Icon } from '@/components/Icon';
import { ListScreen } from '@/components/ListScreen';
import { BLOCKS_KEY, formatBlockedDate, useBlocks } from '@/features/safety/useBlocks';
import { t } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';

/**
 * Screen 44 — Blocked people. Unblock asks first, because the old match
 * never comes back. States: loading, list, empty, error with retry.
 */
export default function BlockedScreen() {
  const queryClient = useQueryClient();
  const blocks = useBlocks();
  const [confirming, setConfirming] = useState<BlockedUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: (block: BlockedUser) => unblock(block.id),
    onMutate: () => setError(null),
    onSuccess: (_res, block) => queryClient.setQueryData<BlockedUser[]>(BLOCKS_KEY, (list = []) => list.filter((b) => b.id !== block.id)),
    onError: () => setError(t('blocked.actionError')),
    onSettled: () => setConfirming(null),
  });

  const list = blocks.data ?? [];

  return (
    <ListScreen title={t('blocked.title')} onBack={() => router.back()}>
      {blocks.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : blocks.isError ? (
        <Banner message={t('blocked.loadError')} actionLabel={t('common.tryAgain')} onAction={() => void blocks.refetch()} />
      ) : list.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="account-cancel-outline" size={40} color="textSubtle" />
          <AppText variant="heading" align="center">
            {t('blocked.emptyTitle')}
          </AppText>
          <AppText tone="muted" align="center">
            {t('blocked.emptyBody')}
          </AppText>
        </View>
      ) : (
        <View style={styles.list}>
          {list.map((b) => (
            <BlockedRow key={b.id} block={b} onUnblock={() => setConfirming(b)} />
          ))}
        </View>
      )}
      {error ? <Banner message={error} /> : null}
      <AppText variant="label" tone="muted" style={styles.caption}>
        {t('blocked.caption')}
      </AppText>

      <ConfirmDialog
        visible={confirming !== null}
        title={t('blocked.confirmTitle', { name: confirming?.name ?? '' })}
        message={t('blocked.confirmBody')}
        confirmLabel={t('blocked.confirm')}
        loading={remove.isPending}
        loadingLabel={t('blocked.unblocking')}
        onConfirm={() => confirming && remove.mutate(confirming)}
        onCancel={() => setConfirming(null)}
      />
    </ListScreen>
  );
}

function BlockedRow({ block, onUnblock }: { block: BlockedUser; onUnblock: () => void }) {
  const { colors } = useTheme();
  const date = t('blocked.blockedOn', { date: formatBlockedDate(block.blockedAt) });
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: colors.surface }]} importantForAccessibility="no-hide-descendants">
        <Icon name="account-outline" size={26} color="textMuted" />
      </View>
      <View style={styles.text} accessible accessibilityLabel={`${block.name}, ${date}`}>
        <AppText style={[typography.body, styles.name]}>{block.name}</AppText>
        <AppText variant="label" tone="muted" style={styles.regular}>
          {date}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('blocked.unblockLabel', { name: block.name })}
        onPress={onUnblock}
        hitSlop={8}
        style={({ pressed }) => [styles.pill, { borderColor: colors.outline, opacity: pressed ? 0.7 : 1 }]}>
        <AppText style={typography.label}>{t('blocked.unblock')}</AppText>
      </Pressable>
    </View>
  );
}

const AVATAR = 48;

const styles = StyleSheet.create({
  loading: { paddingVertical: spacing.xl },
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56 },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: typography.label.fontFamily },
  regular: { fontFamily: typography.body.fontFamily },
  pill: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, minHeight: 40, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  caption: { fontFamily: typography.body.fontFamily },
});
