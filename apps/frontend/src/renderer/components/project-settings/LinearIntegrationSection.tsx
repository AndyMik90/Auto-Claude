import { useTranslation } from 'react-i18next';
import { Zap, Import, Radio } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import { StatusBadge } from './StatusBadge';
import { PasswordInput } from './PasswordInput';
import { ConnectionStatus } from './ConnectionStatus';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import type { ProjectEnvConfig, LinearSyncStatus } from '../../../shared/types';

interface LinearIntegrationSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  envConfig: ProjectEnvConfig;
  onUpdateConfig: (updates: Partial<ProjectEnvConfig>) => void;
  linearConnectionStatus: LinearSyncStatus | null;
  isCheckingLinear: boolean;
  onOpenImportModal: () => void;
}

export function LinearIntegrationSection({
  isExpanded,
  onToggle,
  envConfig,
  onUpdateConfig,
  linearConnectionStatus,
  isCheckingLinear,
  onOpenImportModal,
}: LinearIntegrationSectionProps) {
  const { t } = useTranslation('settings');

  const badge = envConfig.linearEnabled ? (
    <StatusBadge status="success" label={t('linearIntegration.enabled')} />
  ) : null;

  return (
    <CollapsibleSection
      title={t('linearIntegration.title')}
      icon={<Zap className="h-4 w-4" />}
      isExpanded={isExpanded}
      onToggle={onToggle}
      badge={badge}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">{t('linearIntegration.enableToggle.label')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('linearIntegration.enableToggle.description')}
          </p>
        </div>
        <Switch
          checked={envConfig.linearEnabled}
          onCheckedChange={(checked) => onUpdateConfig({ linearEnabled: checked })}
        />
      </div>

      {envConfig.linearEnabled && (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">{t('linearIntegration.apiKey.label')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('linearIntegration.apiKey.description')}{' '}
              <a
                href="https://linear.app/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline"
              >
                {t('linearIntegration.apiKey.linkText')}
              </a>
            </p>
            <PasswordInput
              value={envConfig.linearApiKey || ''}
              onChange={(value) => onUpdateConfig({ linearApiKey: value })}
              placeholder={t('linearIntegration.apiKey.placeholder')}
            />
          </div>

          {/* Connection Status */}
          {envConfig.linearApiKey && (
            <ConnectionStatus
              isChecking={isCheckingLinear}
              isConnected={linearConnectionStatus?.connected || false}
              title={t('linearIntegration.connection.title')}
              successMessage={
                linearConnectionStatus?.teamName
                  ? t('linearIntegration.connection.connectedToTeam', { teamName: linearConnectionStatus.teamName })
                  : t('linearIntegration.connection.connected')
              }
              errorMessage={linearConnectionStatus?.error || t('linearIntegration.connection.notConnected')}
              additionalInfo={
                linearConnectionStatus?.connected && linearConnectionStatus.issueCount !== undefined
                  ? t('linearIntegration.connection.tasksAvailable', { count: linearConnectionStatus.issueCount })
                  : undefined
              }
            />
          )}

          {/* Import Existing Tasks Button */}
          {linearConnectionStatus?.connected && (
            <div className="rounded-lg border border-info/30 bg-info/5 p-3">
              <div className="flex items-start gap-3">
                <Import className="h-5 w-5 text-info mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{t('linearIntegration.import.title')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('linearIntegration.import.description')}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={onOpenImportModal}
                  >
                    <Import className="h-4 w-4 mr-2" />
                    {t('linearIntegration.import.button')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Real-time Sync Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-info" />
                <Label className="font-normal text-foreground">{t('linearIntegration.realtimeSync.label')}</Label>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                {t('linearIntegration.realtimeSync.description')}
              </p>
            </div>
            <Switch
              checked={envConfig.linearRealtimeSync || false}
              onCheckedChange={(checked) => onUpdateConfig({ linearRealtimeSync: checked })}
            />
          </div>

          {envConfig.linearRealtimeSync && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 ml-6">
              <p className="text-xs text-warning">
                {t('linearIntegration.realtimeSync.warning')}
              </p>
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t('linearIntegration.filters.teamId')}</Label>
              <Input
                placeholder={t('linearIntegration.filters.teamIdPlaceholder')}
                value={envConfig.linearTeamId || ''}
                onChange={(e) => onUpdateConfig({ linearTeamId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t('linearIntegration.filters.projectId')}</Label>
              <Input
                placeholder={t('linearIntegration.filters.projectIdPlaceholder')}
                value={envConfig.linearProjectId || ''}
                onChange={(e) => onUpdateConfig({ linearProjectId: e.target.value })}
              />
            </div>
          </div>
        </>
      )}
    </CollapsibleSection>
  );
}
