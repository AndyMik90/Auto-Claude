import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { RefreshCw } from 'lucide-react';
import { useProjectStore } from '../../stores/project-store';
import { useSettingsStore } from '../../stores/settings-store';
import { ProjectEnvConfig } from '../../../shared/types/project';

export function ConfigInspector() {
  const { t } = useTranslation(['debug']);
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);
  const selectedProject = useProjectStore((state) =>
    state.projects.find((p) => p.id === selectedProjectId)
  );
  const settings = useSettingsStore((state) => state.settings);
  const [envConfig, setEnvConfig] = useState<ProjectEnvConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadEnvConfig = async () => {
    if (!selectedProject?.autoBuildPath) {
      setEnvConfig(null);
      return;
    }

    setIsLoading(true);
    try {
      const result = await window.electronAPI.getProjectEnv(selectedProject.id);
      if (result.success && result.data) {
        setEnvConfig(result.data as ProjectEnvConfig);
      } else {
        setEnvConfig(null);
      }
    } catch {
      setEnvConfig(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEnvConfig();
  }, [selectedProject?.id, selectedProject?.autoBuildPath]);

  const renderConfigSection = (title: string, data: Record<string, any>) => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      <div className="rounded-lg border bg-muted/50 p-4">
        {Object.keys(data).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('config.noData')}</p>
        ) : (
          <dl className="space-y-2">
            {Object.entries(data).map(([key, value]) => (
              <div key={key} className="flex flex-col sm:flex-row sm:items-baseline gap-2">
                <dt className="text-sm font-medium text-foreground min-w-[200px]">{key}</dt>
                <dd className="text-sm text-muted-foreground font-mono break-all">
                  {value === undefined || value === null
                    ? '<undefined>'
                    : typeof value === 'boolean'
                    ? value.toString()
                    : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={loadEnvConfig}
          disabled={isLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {t('config.refreshButton')}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="pr-4">
          {/* Application Settings */}
          {renderConfigSection(t('config.settingsTitle'), {
            'Auto Build Path': settings.autoBuildPath || '<not configured>',
            'Theme': settings.theme || 'system',
            'Language': settings.language || 'en',
          })}

          <Separator className="my-6" />

          {/* Project Configuration */}
          {selectedProject ? (
            renderConfigSection(t('config.projectTitle'), {
              'Project ID': selectedProject.id,
              'Project Name': selectedProject.name,
              'Project Path': selectedProject.path,
              'Auto Build Path': selectedProject.autoBuildPath || '<not initialized>',
              'Created At': new Date(selectedProject.createdAt).toLocaleString(),
            })
          ) : (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{t('config.projectTitle')}</h3>
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">No project selected</p>
              </div>
            </div>
          )}

          <Separator className="my-6" />

          {/* Environment Variables */}
          {envConfig && renderConfigSection(t('config.envTitle'), envConfig)}
        </div>
      </ScrollArea>
    </div>
  );
}
