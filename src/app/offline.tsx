import { StatusScreen } from '@/components/StatusScreen';
import { useLaunchBlocker } from '@/features/appConfig/useLaunchBlocker';
import { t } from '@/i18n';

/**
 * Screen 50 — Offline. The app couldn't reach the server at launch, either
 * for /app/config or to confirm the stored session (which is kept). Retries
 * on Try again, when the network returns and on return to the foreground.
 */
export default function OfflineScreen() {
  const { error, retry, retrying } = useLaunchBlocker();
  return (
    <StatusScreen
      icon="wifi-off"
      title={t('offline.title')}
      message={t('offline.body')}
      action={{
        label: t('common.tryAgain'),
        icon: 'refresh',
        loading: retrying,
        loadingLabel: t('common.retrying'),
        onPress: () => void retry(),
      }}
      caption={error ? t('common.errorCode', { code: error.reference }) : undefined}
    />
  );
}
