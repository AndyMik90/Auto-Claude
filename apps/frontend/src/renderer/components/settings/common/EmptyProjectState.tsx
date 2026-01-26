import { FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Shows an empty state when no project is selected in settings.
 */
export function EmptyProjectState() {
  const { t } = useTranslation('settings');
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <p className="text-muted-foreground">
        {t('projectSettings.emptyState')}
      </p>
    </div>
  );
}
