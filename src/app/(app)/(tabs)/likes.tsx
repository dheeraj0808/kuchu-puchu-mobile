import { TabPlaceholder } from '@/components/TabPlaceholder';
import { t } from '@/i18n';

/** Screen 24 (Likes you) arrives in Phase 4 part 2. */
export default function LikesTab() {
  return <TabPlaceholder icon="heart-outline" title={t('tabsPlaceholder.likesTitle')} body={t('tabsPlaceholder.likesBody')} />;
}
