import { router, useLocalSearchParams } from 'expo-router';

import { StatusScreen } from '@/components/StatusScreen';
import { t } from '@/i18n';

/** Placeholder for Settings rows whose screens arrive in later phases. */
export default function ComingSoonScreen() {
  const { title } = useLocalSearchParams<{ title?: string }>();
  return (
    <StatusScreen
      icon="progress-clock"
      title={title || t('common.comingSoonTitle')}
      message={t('common.comingSoonBody')}
      action={{ label: t('common.back'), variant: 'secondary', onPress: () => router.back() }}
    />
  );
}
