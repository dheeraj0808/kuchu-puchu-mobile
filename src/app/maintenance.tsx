import { StatusScreen } from '@/components/StatusScreen';
import { useLaunchBlocker } from '@/features/appConfig/useLaunchBlocker';
import { t } from '@/i18n';

/**
 * Screen 05 — Maintenance. /app/config reports maintenance (or the API
 * answers 503). Try again re-checks config; it also re-checks every minute
 * and on return to the foreground, so the app unblocks by itself.
 */
export default function MaintenanceScreen() {
  const { retry, retrying } = useLaunchBlocker();
  return (
    <StatusScreen
      icon="cog-outline"
      title={t('maintenance.title')}
      message={t('maintenance.body')}
      action={{
        label: t('common.tryAgain'),
        icon: 'refresh',
        variant: 'secondary',
        loading: retrying,
        loadingLabel: t('common.retrying'),
        onPress: () => void retry(),
      }}
    />
  );
}
