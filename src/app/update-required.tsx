import { useState } from 'react';
import { Linking, Platform } from 'react-native';

import { StatusScreen } from '@/components/StatusScreen';
import { env } from '@/config/env';
import { useLaunchBlocker } from '@/features/appConfig/useLaunchBlocker';
import { t } from '@/i18n';

/**
 * Screen 04 — Update required. Shown when this build is below
 * /app/config minVersion. Blocks the whole app; the only way out is the store.
 */
export default function UpdateRequiredScreen() {
  const { config } = useLaunchBlocker();
  const [opening, setOpening] = useState(false);

  const openStore = async () => {
    setOpening(true);
    try {
      for (const url of storeLinks(config?.storeUrl ?? null)) {
        try {
          await Linking.openURL(url);
          return;
        } catch {
          // Play Store app missing (e.g. emulator without it): try the web link.
        }
      }
    } finally {
      setOpening(false);
    }
  };

  return (
    <StatusScreen
      icon="tray-arrow-down"
      title={t('updateRequired.title')}
      message={t('updateRequired.body')}
      action={{
        label: Platform.OS === 'ios' ? t('updateRequired.actionIos') : t('updateRequired.action'),
        loading: opening,
        loadingLabel: t('updateRequired.opening'),
        onPress: openStore,
      }}
    />
  );
}

/** The server's link first, then the Play Store app, then Play on the web. */
function storeLinks(serverUrl: string | null): string[] {
  const links: string[] = [];
  if (serverUrl) links.push(serverUrl);
  if (Platform.OS === 'android' && env.applicationId) {
    links.push(`market://details?id=${env.applicationId}`);
    links.push(`https://play.google.com/store/apps/details?id=${env.applicationId}`);
  }
  return links;
}
