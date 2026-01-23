import { useTranslation } from 'react-i18next';

interface AnalyticsProps {
  projectId: string;
}

/**
 * Analytics Dashboard placeholder component.
 * This is a placeholder that will be replaced with the full implementation
 * in subtask-6-4 (phase-6-core-components).
 */
export function Analytics({ projectId }: AnalyticsProps) {
  const { t } = useTranslation('analytics');

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>{t('loading')}</p>
      </div>
    </div>
  );
}
