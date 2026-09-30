import { StatusScreen } from '@/components/StatusScreen';
import { useLaunchBlocker } from '@/features/appConfig/useLaunchBlocker';
import { t } from '@/i18n';

/**
 * Generic launch error (guide §11 "5xx → generic error with retry and
 * requestId"). Same layout as screen 50; the code lets support find the request.
 */
export default function LaunchErrorScreen() {
  const { error, retry, retrying } = useLaunchBlocker();
  return (
    <StatusScreen
      icon="alert-circle-outline"
      title={t('genericError.title')}
      message={t('genericError.body')}
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
