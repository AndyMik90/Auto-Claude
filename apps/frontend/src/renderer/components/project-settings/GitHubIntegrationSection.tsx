import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Github, RefreshCw, KeyRound, Info, CheckCircle2 } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import { StatusBadge } from './StatusBadge';
import { PasswordInput } from './PasswordInput';
import { ConnectionStatus } from './ConnectionStatus';
import { GitHubOAuthFlow } from './GitHubOAuthFlow';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';
import type { ProjectEnvConfig, GitHubSyncStatus } from '../../../shared/types';

interface GitHubIntegrationSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  envConfig: ProjectEnvConfig;
  onUpdateConfig: (updates: Partial<ProjectEnvConfig>) => void;
  gitHubConnectionStatus: GitHubSyncStatus | null;
  isCheckingGitHub: boolean;
  projectName?: string;
}

export function GitHubIntegrationSection({
  isExpanded,
  onToggle,
  envConfig,
  onUpdateConfig,
  gitHubConnectionStatus,
  isCheckingGitHub,
  projectName,
}: GitHubIntegrationSectionProps) {
  const { t } = useTranslation('settings');

  // Show OAuth flow if user previously used OAuth, or if there's no token yet
  const [showOAuthFlow, setShowOAuthFlow] = useState(
    envConfig.githubAuthMethod === 'oauth' || (!envConfig.githubToken && !envConfig.githubAuthMethod)
  );

  const badge = envConfig.githubEnabled ? (
    <StatusBadge status="success" label={t('githubIntegration.enabled')} />
  ) : null;

  const handleOAuthSuccess = (token: string, _username?: string) => {
    onUpdateConfig({ githubToken: token, githubAuthMethod: 'oauth' });
    setShowOAuthFlow(false);
  };

  const handleManualTokenChange = (value: string) => {
    onUpdateConfig({ githubToken: value, githubAuthMethod: 'pat' });
  };

  return (
    <CollapsibleSection
      title={t('githubIntegration.title')}
      icon={<Github className="h-4 w-4" />}
      isExpanded={isExpanded}
      onToggle={onToggle}
      badge={badge}
    >
      {/* Project-Specific Configuration Notice */}
      {projectName && (
        <div className="rounded-lg border border-info/30 bg-info/5 p-3 mb-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-info mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{t('githubIntegration.projectSpecific.title')}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('githubIntegration.projectSpecific.description', { projectName })}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">{t('githubIntegration.enableToggle.label')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('githubIntegration.enableToggle.description')}
          </p>
        </div>
        <Switch
          checked={envConfig.githubEnabled}
          onCheckedChange={(checked) => onUpdateConfig({ githubEnabled: checked })}
        />
      </div>

      {envConfig.githubEnabled && (
        <>
          {/* Show OAuth connected state when authenticated via OAuth */}
          {envConfig.githubAuthMethod === 'oauth' && envConfig.githubToken && !showOAuthFlow ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">{t('githubIntegration.authentication.title')}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdateConfig({ githubToken: '', githubAuthMethod: undefined })}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {t('githubIntegration.authentication.useManualToken')}
                </Button>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border border-success/30 bg-success/5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm text-foreground">{t('githubIntegration.authentication.oauthConnected')}</span>
              </div>
            </div>
          ) : showOAuthFlow ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">{t('githubIntegration.authentication.title')}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOAuthFlow(false)}
                >
                  {t('githubIntegration.authentication.useManualToken')}
                </Button>
              </div>
              <GitHubOAuthFlow
                onSuccess={handleOAuthSuccess}
                onCancel={() => setShowOAuthFlow(false)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">{t('githubIntegration.token.label')}</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOAuthFlow(true)}
                  className="gap-2"
                >
                  <KeyRound className="h-3 w-3" />
                  {t('githubIntegration.authentication.useOAuthInstead')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('githubIntegration.token.description', { scope: t('githubIntegration.token.scope') })}{' '}
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=Auto-Build-UI"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info hover:underline"
                >
                  {t('githubIntegration.token.linkText')}
                </a>
              </p>
              <PasswordInput
                value={envConfig.githubToken || ''}
                onChange={handleManualTokenChange}
                placeholder={t('githubIntegration.token.placeholder')}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">{t('githubIntegration.repository.label')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('githubIntegration.repository.description', { format: t('githubIntegration.repository.format') })}
            </p>
            <Input
              placeholder={t('githubIntegration.repository.placeholder')}
              value={envConfig.githubRepo || ''}
              onChange={(e) => onUpdateConfig({ githubRepo: e.target.value })}
            />
          </div>

          {/* Connection Status */}
          {envConfig.githubToken && envConfig.githubRepo && (
            <ConnectionStatus
              isChecking={isCheckingGitHub}
              isConnected={gitHubConnectionStatus?.connected || false}
              title={t('githubIntegration.connection.title')}
              successMessage={t('githubIntegration.connection.connected', { repo: gitHubConnectionStatus?.repoFullName })}
              errorMessage={gitHubConnectionStatus?.error || t('githubIntegration.connection.notConnected')}
              additionalInfo={gitHubConnectionStatus?.repoDescription}
            />
          )}

          {/* Info about accessing issues */}
          {gitHubConnectionStatus?.connected && (
            <div className="rounded-lg border border-info/30 bg-info/5 p-3">
              <div className="flex items-start gap-3">
                <Github className="h-5 w-5 text-info mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{t('githubIntegration.issuesAvailable.title')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('githubIntegration.issuesAvailable.description')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Auto-sync Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-info" />
                <Label className="font-normal text-foreground">{t('githubIntegration.autoSync.label')}</Label>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                {t('githubIntegration.autoSync.description')}
              </p>
            </div>
            <Switch
              checked={envConfig.githubAutoSync || false}
              onCheckedChange={(checked) => onUpdateConfig({ githubAutoSync: checked })}
            />
          </div>
        </>
      )}
    </CollapsibleSection>
  );
}
