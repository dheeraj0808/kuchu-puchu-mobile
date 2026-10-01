import { TabPlaceholder } from '@/components/TabPlaceholder';
import { t } from '@/i18n';

/** Screen 27 (Matches) arrives in Phase 4 part 2. */
export default function MatchesTab() {
  return <TabPlaceholder icon="message-outline" title={t('tabsPlaceholder.matchesTitle')} body={t('tabsPlaceholder.matchesBody')} />;
}
