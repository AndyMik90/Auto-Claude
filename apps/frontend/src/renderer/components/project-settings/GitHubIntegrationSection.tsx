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
  const { t } = useTranslation('github');

  // Show OAuth flow if user previously used OAuth, or if there's no token yet
  const [showOAuthFlow, setShowOAuthFlow] = useState(
    envConfig.githubAuthMethod === 'oauth' || (!envConfig.githubToken && !envConfig.githubAuthMethod)
  );

  const badge = envConfig.githubEnabled ? (
    <StatusBadge status="success" label={t('status.enabled')} />
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
      title={t('integration.title')}
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
              <p className="text-sm font-medium text-foreground">{t('integration.projectSpecificConfig')}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('integration.projectSpecificConfigDescription', { projectName })}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">{t('integration.enableLabel')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('integration.enableDescription')}
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
                <Label className="text-sm font-medium text-foreground">{t('authentication.title')}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdateConfig({ githubToken: '', githubAuthMethod: undefined })}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {t('authentication.useManualToken')}
                </Button>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border border-success/30 bg-success/5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm text-foreground">{t('authentication.authenticatedViaOAuth')}</span>
              </div>
            </div>
          ) : showOAuthFlow ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">{t('authentication.title')}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOAuthFlow(false)}
                >
                  {t('authentication.useManualToken')}
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
                <Label className="text-sm font-medium text-foreground">{t('authentication.personalAccessToken')}</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOAuthFlow(true)}
                  className="gap-2"
                >
                  <KeyRound className="h-3 w-3" />
                  {t('authentication.useOAuthInstead')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('authentication.tokenScope')} <code className="px-1 bg-muted rounded">{t('authentication.tokenScopeLink')}</code> {t('authentication.tokenScopeFrom')}{' '}
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=Auto-Build-UI"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info hover:underline"
                >
                  {t('authentication.tokenLinkText')}
                </a>
              </p>
              <PasswordInput
                value={envConfig.githubToken || ''}
                onChange={handleManualTokenChange}
                placeholder="ghp_xxxxxxxx or github_pat_xxxxxxxx"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">{t('repository.title')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('repository.format')} <code className="px-1 bg-muted rounded">owner/repo</code> {t('repository.formatExample')}
            </p>
            <Input
              placeholder={t('repository.placeholder')}
              value={envConfig.githubRepo || ''}
              onChange={(e) => onUpdateConfig({ githubRepo: e.target.value })}
            />
          </div>

          {/* Connection Status */}
          {envConfig.githubToken && envConfig.githubRepo && (
            <ConnectionStatus
              isChecking={isCheckingGitHub}
              isConnected={gitHubConnectionStatus?.connected || false}
              title={t('connection.status')}
              successMessage={`${t('connection.connectedTo')} ${gitHubConnectionStatus?.repoFullName}`}
              errorMessage={gitHubConnectionStatus?.error || t('connection.notConnected')}
              additionalInfo={gitHubConnectionStatus?.repoDescription}
            />
          )}

          {/* Info about accessing issues */}
          {gitHubConnectionStatus?.connected && (
            <div className="rounded-lg border border-info/30 bg-info/5 p-3">
              <div className="flex items-start gap-3">
                <Github className="h-5 w-5 text-info mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{t('issues.available')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('issues.availableDescription')}
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
                <Label className="font-normal text-foreground">{t('autoSync.label')}</Label>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                {t('autoSync.description')}
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
