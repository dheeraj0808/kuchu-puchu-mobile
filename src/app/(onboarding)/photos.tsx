import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { deletePhoto, listPhotos, reorderPhotos, uploadPhoto } from '@/api/endpoints/photos';
import { ErrorCode, errorMessage, isApiError } from '@/api/errors';
import type { Photo } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Icon, type IconName } from '@/components/Icon';
import { NoteCard } from '@/components/NoteCard';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Sheet } from '@/components/Sheet';
import { env } from '@/config/env';
import { resolveOnboardingScreen } from '@/features/onboarding/steps';
import { PhotoGrid, type UploadingSlot } from '@/features/verification/PhotoGrid';
import { canContinuePhotos, localFileProblem, movePhoto, summarizePhotos } from '@/features/verification/photoRules';
import { pickPhoto } from '@/features/verification/pickPhoto';
import { preparePhoto } from '@/features/verification/preparePhoto';
import { t } from '@/i18n';
import { spacing, typography, useTheme } from '@/theme';

const PHOTOS_KEY = ['photos'] as const;

type Notice = { message: string; offerRemove?: boolean } | null;

/**
 * Screen 09 — Photos. 3 × 2 grid, first = main photo. Add from camera or
 * gallery (prepared to JPEG ≤ 2048 px, uploaded with progress and cancel),
 * drag or use accessibility actions to reorder, remove with confirm.
 * Continue needs 4 approved photos (photoRules.canContinuePhotos).
 */
export default function PhotosScreen() {
  const { colors } = useTheme();
  const { reloadUser } = useAuth();
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<UploadingSlot[]>([]);
  const [sourceSheet, setSourceSheet] = useState(false);
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Photo | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [continuing, setContinuing] = useState(false);
  const uploadSeq = useRef(0);

  const photosQuery = useQuery({
    queryKey: PHOTOS_KEY,
    queryFn: listPhotos,
    // Pick up moderation results while any photo is in review (push will replace this later).
    refetchInterval: (q) => (q.state.data?.some((p) => p.status === 'review') ? (env.useAuthMock ? 3_000 : 15_000) : false),
  });
  const photos = photosQuery.data ?? [];
  const summary = summarizePhotos(photos);

  const showError = (err: unknown) => {
    if (isApiError(err) && err.code === ErrorCode.Aborted) return;
    setNotice({ message: errorMessage(err), offerRemove: isApiError(err) && err.code === ErrorCode.PhotoLimitReached });
  };

  const add = async (source: 'camera' | 'gallery') => {
    setSourceSheet(false);
    setNotice(null);
    const picked = await pickPhoto(source).catch(() => ({ kind: 'cancelled' as const }));
    if (picked.kind === 'cameraDenied') return setNotice({ message: t('photos.cameraDenied') });
    if (picked.kind !== 'picked') return;
    const problem = localFileProblem(picked.asset);
    if (problem === 'tooSmall') return setNotice({ message: t('photos.tooSmall') });
    if (problem) return setNotice({ message: t('errors.PHOTO_INVALID_FILE') });

    const key = `upload-${++uploadSeq.current}`;
    const abort = new AbortController();
    const update = (progress: number) => setUploads((list) => list.map((u) => (u.key === key ? { ...u, progress } : u)));
    setUploads((list) => [...list, { key, progress: 0, cancel: () => abort.abort() }]);
    try {
      const file = await preparePhoto(picked.asset);
      const photo = await uploadPhoto(file, { onProgress: update, signal: abort.signal });
      queryClient.setQueryData<Photo[]>(PHOTOS_KEY, (list = []) => [...list, photo]);
    } catch (err) {
      showError(err);
    } finally {
      setUploads((list) => list.filter((u) => u.key !== key));
      void queryClient.invalidateQueries({ queryKey: PHOTOS_KEY });
    }
  };

  const move = async (from: number, to: number) => {
    if (from === to || to < 0 || to >= photos.length) return;
    setNotice(null);
    const previous = photos;
    const next = movePhoto(photos, from, to);
    queryClient.setQueryData(PHOTOS_KEY, next); // Optimistic; reverted on error.
    try {
      queryClient.setQueryData(PHOTOS_KEY, await reorderPhotos(next.map((p) => p.id)));
    } catch (err) {
      queryClient.setQueryData(PHOTOS_KEY, previous);
      showError(err);
    }
  };

  const remove = async (photo: Photo) => {
    setNotice(null);
    try {
      await deletePhoto(photo.id);
      queryClient.setQueryData<Photo[]>(PHOTOS_KEY, (list = []) => list.filter((p) => p.id !== photo.id));
    } catch (err) {
      showError(err);
    } finally {
      setConfirmRemove(null);
    }
  };

  const proceed = async () => {
    setContinuing(true);
    try {
      // Server moves nextStep once 4 photos are approved (and the selfie is).
      const me = await reloadUser();
      // Photos done but the selfie is still with the safety team: go back to screen 08 to wait.
      if (resolveOnboardingScreen(me) === 'selfieReview') router.replace('/selfie-review');
    } catch (err) {
      showError(err);
    } finally {
      setContinuing(false);
    }
  };

  const menuPhoto = menuIndex !== null ? photos[menuIndex] : undefined;
  const caption =
    summary.inReview > 0
      ? t('photos.summaryReview', { approved: summary.approved, needed: summary.needed, review: summary.inReview })
      : t('photos.summary', { approved: summary.approved, needed: summary.needed });

  return (
    <OnboardingScreen
      step="photos"
      title={t('photos.title')}
      subtitle={t('photos.subtitle')}
      footer={
        <View style={styles.footer}>
          <AppText variant="label" tone="muted" align="center" style={styles.regular} accessibilityLiveRegion="polite">
            {caption}
          </AppText>
          <Button
            label={t('common.continue')}
            disabled={!canContinuePhotos(photos) || uploads.length > 0}
            loading={continuing}
            loadingLabel={t('common.saving')}
            onPress={proceed}
          />
        </View>
      }>
      {photosQuery.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : photosQuery.isError ? (
        <Banner message={t('photos.loadError')} actionLabel={t('common.tryAgain')} onAction={() => void photosQuery.refetch()} />
      ) : (
        <PhotoGrid
          photos={photos}
          uploads={uploads}
          onAdd={() => setSourceSheet(true)}
          onOpen={setMenuIndex}
          onMove={(from, to) => void move(from, to)}
          onRemove={(i) => setConfirmRemove(photos[i] ?? null)}
        />
      )}

      {notice ? (
        <Banner
          message={notice.message}
          actionLabel={notice.offerRemove && photos.length > 0 ? t('photos.remove') : undefined}
          onAction={notice.offerRemove ? () => setMenuIndex(photos.length - 1) : undefined}
        />
      ) : null}

      <NoteCard>{t('photos.tip')}</NoteCard>

      <Sheet visible={sourceSheet} onClose={() => setSourceSheet(false)}>
        <View style={styles.sheet}>
          <AppText variant="title">{t('photos.sourceTitle')}</AppText>
          <SheetRow icon="camera-outline" label={t('photos.camera')} onPress={() => void add('camera')} />
          <SheetRow icon="image-multiple-outline" label={t('photos.gallery')} onPress={() => void add('gallery')} />
        </View>
      </Sheet>

      <Sheet visible={menuPhoto !== undefined} onClose={() => setMenuIndex(null)}>
        {menuPhoto && menuIndex !== null ? (
          <View style={styles.sheet}>
            <AppText variant="title">{t('photos.menuTitle', { position: menuIndex + 1 })}</AppText>
            {menuPhoto.status === 'rejected' && menuPhoto.rejectionReason ? (
              <View style={[styles.reason, { backgroundColor: colors.dangerSoft }]}>
                <AppText variant="label" tone="danger">
                  {t('photos.rejectedReason')}
                </AppText>
                <AppText>{menuPhoto.rejectionReason}</AppText>
              </View>
            ) : null}
            {menuIndex > 0 ? <SheetRow icon="star-outline" label={t('photos.makeMain')} onPress={() => (setMenuIndex(null), void move(menuIndex, 0))} /> : null}
            {menuIndex > 0 ? <SheetRow icon="arrow-left" label={t('photos.moveLeft')} onPress={() => (setMenuIndex(null), void move(menuIndex, menuIndex - 1))} /> : null}
            {menuIndex < photos.length - 1 ? (
              <SheetRow icon="arrow-right" label={t('photos.moveRight')} onPress={() => (setMenuIndex(null), void move(menuIndex, menuIndex + 1))} />
            ) : null}
            <SheetRow icon="trash-can-outline" label={t('photos.remove')} destructive onPress={() => (setMenuIndex(null), setConfirmRemove(menuPhoto))} />
          </View>
        ) : null}
      </Sheet>

      <ConfirmDialog
        visible={confirmRemove !== null}
        title={t('photos.removeTitle')}
        message={t('photos.removeBody')}
        confirmLabel={t('photos.removeConfirm')}
        destructive
        onConfirm={() => confirmRemove && void remove(confirmRemove)}
        onCancel={() => setConfirmRemove(null)}
      />
    </OnboardingScreen>
  );
}

function SheetRow({ icon, label, onPress, destructive }: { icon: IconName; label: string; onPress: () => void; destructive?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
      <Icon name={icon} size={24} color={destructive ? 'danger' : 'text'} />
      <AppText style={[typography.body, styles.rowText]} tone={destructive ? 'danger' : 'default'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: spacing.xl },
  footer: { gap: spacing.sm },
  regular: { fontFamily: typography.body.fontFamily },
  sheet: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.xs, borderRadius: 12 },
  rowText: { flex: 1, fontFamily: typography.label.fontFamily },
  reason: { borderRadius: 12, padding: spacing.sm, gap: 2, marginBottom: spacing.xs },
});
