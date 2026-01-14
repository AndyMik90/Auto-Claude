import { Zap, Import, Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('linear');

  const badge = envConfig.linearEnabled ? (
    <StatusBadge status="success" label={t('status.enabled')} />
  ) : null;

  return (
    <CollapsibleSection
      title={t('integration.title')}
      icon={<Zap className="h-4 w-4" />}
      isExpanded={isExpanded}
      onToggle={onToggle}
      badge={badge}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">{t('integration.enableLabel')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('integration.enableDescription')}
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
            <Label className="text-sm font-medium text-foreground">{t('authentication.apiKey')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('authentication.getApiKeyFrom')}{' '}
              <a
                href="https://linear.app/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline"
              >
                {t('authentication.settingsLink')}
              </a>
            </p>
            <PasswordInput
              value={envConfig.linearApiKey || ''}
              onChange={(value) => onUpdateConfig({ linearApiKey: value })}
              placeholder="lin_api_xxxxxxxx"
            />
          </div>

          {/* Connection Status */}
          {envConfig.linearApiKey && (
            <ConnectionStatus
              isChecking={isCheckingLinear}
              isConnected={linearConnectionStatus?.connected || false}
              title={t('connection.status')}
              successMessage={`${t('connection.connectedTo')}${linearConnectionStatus?.teamName ? ` ${linearConnectionStatus.teamName}` : ''}`}
              errorMessage={linearConnectionStatus?.error || t('connection.notConnected')}
              additionalInfo={
                linearConnectionStatus?.connected && linearConnectionStatus.issueCount !== undefined
                  ? `${linearConnectionStatus.issueCount}+ ${t('connection.tasksAvailable')}`
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
                  <p className="text-sm font-medium text-foreground">{t('import.title')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('import.description')}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={onOpenImportModal}
                  >
                    <Import className="h-4 w-4 mr-2" />
                    {t('import.buttonText')}
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
                <Label className="font-normal text-foreground">{t('realtimeSync.label')}</Label>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                {t('realtimeSync.description')}
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
                {t('realtimeSync.warningMessage')}
              </p>
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t('filters.teamId')}</Label>
              <Input
                placeholder={t('filters.autoDetected')}
                value={envConfig.linearTeamId || ''}
                onChange={(e) => onUpdateConfig({ linearTeamId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t('filters.projectId')}</Label>
              <Input
                placeholder={t('filters.autoCreated')}
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
