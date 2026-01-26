import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Zap, AlertCircle, ExternalLink, Eye, EyeOff, ClipboardList, Loader2, RefreshCw } from 'lucide-react';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { Button } from '../../ui/button';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { LinearIntegration } from './LinearIntegration';
import { useSettingsStore } from '../../../stores/settings-store';
import type {
  ProjectEnvConfig,
  LinearSyncStatus,
  GitLabSyncStatus,
  AppSettings
} from '../../../../shared/types';

// GitLab icon component
function GitLabIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" role="img" aria-labelledby="gitlab-issues-icon-title">
      <title id="gitlab-issues-icon-title">GitLab Issues</title>
      <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
    </svg>
  );
}

// JIRA icon component
function JiraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" role="img" aria-labelledby="jira-icon-title">
      <title id="jira-icon-title">JIRA</title>
      <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"/>
    </svg>
  );
}

interface IssueTrackerSettingsProps {
  envConfig: ProjectEnvConfig | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;
  // Linear state
  showLinearKey: boolean;
  setShowLinearKey: React.Dispatch<React.SetStateAction<boolean>>;
  linearConnectionStatus: LinearSyncStatus | null;
  isCheckingLinear: boolean;
  onOpenLinearImport: () => void;
  // GitLab Issues state (shared with source control)
  gitLabConnectionStatus: GitLabSyncStatus | null;
  isCheckingGitLab: boolean;
}

/**
 * Issue Tracker settings tab.
 * Allows selection between JIRA, Linear, and GitLab Issues.
 */
export function IssueTrackerSettings({
  envConfig,
  updateEnvConfig,
  showLinearKey,
  setShowLinearKey,
  linearConnectionStatus,
  isCheckingLinear,
  onOpenLinearImport,
  gitLabConnectionStatus,
  isCheckingGitLab: _isCheckingGitLab
}: IssueTrackerSettingsProps) {
  const { t } = useTranslation('settings');
  const globalSettings = useSettingsStore((state) => state.settings);

  if (!envConfig) return null;

  // Determine current provider
  const currentProvider = envConfig.issueTrackerProvider ||
    (envConfig.jiraEnabled ? 'jira' :
     envConfig.linearEnabled ? 'linear' :
     envConfig.gitlabEnabled ? 'gitlab' : undefined);

  const handleProviderChange = (provider: 'jira' | 'linear' | 'gitlab') => {
    updateEnvConfig({
      issueTrackerProvider: provider,
      // Only enable the selected provider for issue tracking
      jiraEnabled: provider === 'jira',
      linearEnabled: provider === 'linear'
      // Note: gitlabEnabled is handled by source control, we just use it for issues
    });
  };

  // Check if JIRA is configured (either project-level or global)
  const isJiraConfigured = !!(
    (envConfig.jiraHost && envConfig.jiraEmail && envConfig.jiraToken) ||
    (globalSettings?.globalJiraHost && globalSettings?.globalJiraEmail && globalSettings?.globalJiraToken)
  );

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">
            {t('projectSections.integrations.issueTracker.provider')}
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            {t('projectSections.integrations.issueTracker.providerDescription')}
          </p>
        </div>

        <RadioGroup
          value={currentProvider || ''}
          onValueChange={(value) => handleProviderChange(value as 'jira' | 'linear' | 'gitlab')}
          className="grid grid-cols-3 gap-4"
        >
          {/* JIRA Option */}
          <div className="relative">
            <RadioGroupItem value="jira" id="jira-tracker" className="peer sr-only" />
            <Label
              htmlFor="jira-tracker"
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
            >
              <JiraIcon className="h-8 w-8" />
              <span className="font-medium">JIRA</span>
              {isJiraConfigured && currentProvider === 'jira' && (
                <CheckCircle2 className="h-4 w-4 text-success absolute top-2 right-2" />
              )}
            </Label>
          </div>

          {/* Linear Option */}
          <div className="relative">
            <RadioGroupItem value="linear" id="linear-tracker" className="peer sr-only" />
            <Label
              htmlFor="linear-tracker"
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
            >
              <Zap className="h-8 w-8" />
              <span className="font-medium">Linear</span>
              {linearConnectionStatus?.connected && (
                <CheckCircle2 className="h-4 w-4 text-success absolute top-2 right-2" />
              )}
            </Label>
          </div>

          {/* GitLab Issues Option */}
          <div className="relative">
            <RadioGroupItem value="gitlab" id="gitlab-tracker" className="peer sr-only" />
            <Label
              htmlFor="gitlab-tracker"
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
            >
              <GitLabIcon className="h-8 w-8" />
              <span className="font-medium">GitLab Issues</span>
              {gitLabConnectionStatus?.connected && currentProvider === 'gitlab' && (
                <CheckCircle2 className="h-4 w-4 text-success absolute top-2 right-2" />
              )}
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Provider-specific Configuration */}
      {currentProvider === 'jira' && (
        <div className="border-t border-border pt-6">
          <JiraSettings
            envConfig={envConfig}
            updateEnvConfig={updateEnvConfig}
            globalSettings={globalSettings}
            isJiraConfigured={isJiraConfigured}
          />
        </div>
      )}

      {currentProvider === 'linear' && (
        <div className="border-t border-border pt-6">
          <LinearIntegration
            envConfig={envConfig}
            updateEnvConfig={updateEnvConfig}
            showLinearKey={showLinearKey}
            setShowLinearKey={setShowLinearKey}
            linearConnectionStatus={linearConnectionStatus}
            isCheckingLinear={isCheckingLinear}
            onOpenLinearImport={onOpenLinearImport}
          />
        </div>
      )}

      {currentProvider === 'gitlab' && (
        <div className="border-t border-border pt-6">
          <GitLabIssuesInfo gitLabConnectionStatus={gitLabConnectionStatus} />
        </div>
      )}

      {!currentProvider && (
        <div className="border-t border-border pt-6">
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('projectSections.integrations.issueTracker.selectProvider')}
          </p>
        </div>
      )}
    </div>
  );
}

interface JiraSettingsProps {
  envConfig: ProjectEnvConfig;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;
  globalSettings: AppSettings | null;
  isJiraConfigured: boolean;
}

interface JiraConnectionStatus {
  connected: boolean;
  displayName?: string;
  error?: string;
}

/**
 * Full JIRA settings for project-level configuration.
 * Shows migration prompt if global settings exist.
 */
function JiraSettings({
  envConfig,
  updateEnvConfig,
  globalSettings,
  isJiraConfigured
}: JiraSettingsProps) {
  const { t } = useTranslation('settings');
  const [showToken, setShowToken] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<JiraConnectionStatus | null>(null);

  // Check if using global fallback
  const usingGlobalFallback = !envConfig.jiraHost && globalSettings?.globalJiraHost;

  // Get effective values (project-level or global fallback)
  const effectiveHost = envConfig.jiraHost || globalSettings?.globalJiraHost || '';
  const effectiveEmail = envConfig.jiraEmail || globalSettings?.globalJiraEmail || '';
  const effectiveToken = envConfig.jiraToken || globalSettings?.globalJiraToken || '';

  const handleTestConnection = async () => {
    if (!effectiveHost || !effectiveEmail || !effectiveToken) {
      setConnectionStatus({
        connected: false,
        error: t('projectSections.integrations.issueTracker.jira.missingFields')
      });
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus(null);

    try {
      const result = await window.electronAPI.testJiraConnection(
        effectiveHost,
        effectiveEmail,
        effectiveToken
      );

      if (result.success && result.data) {
        setConnectionStatus({
          connected: true,
          displayName: result.data.displayName
        });
      } else {
        setConnectionStatus({
          connected: false,
          error: result.error || t('projectSections.integrations.issueTracker.jira.connectionFailed')
        });
      }
    } catch (error) {
      setConnectionStatus({
        connected: false,
        error: error instanceof Error ? error.message : t('projectSections.integrations.issueTracker.jira.connectionFailed')
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleMigrateFromGlobal = () => {
    if (globalSettings) {
      updateEnvConfig({
        jiraEnabled: true,
        jiraHost: globalSettings.globalJiraHost,
        jiraEmail: globalSettings.globalJiraEmail,
        jiraToken: globalSettings.globalJiraToken,
        jiraProjectKey: globalSettings.globalJiraDefaultProject
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Enable Toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">
            {t('projectSections.integrations.issueTracker.jira.enable')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t('projectSections.integrations.issueTracker.jira.enableDescription')}
          </p>
        </div>
        <Switch
          checked={envConfig.jiraEnabled ?? false}
          onCheckedChange={(checked) => updateEnvConfig({ jiraEnabled: checked })}
        />
      </div>

      {envConfig.jiraEnabled && (
        <>
          {/* Migration prompt if using global fallback */}
          {usingGlobalFallback && (
            <div className="rounded-lg border border-info/30 bg-info/5 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-info mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {t('projectSections.integrations.issueTracker.jira.usingGlobal')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('projectSections.integrations.issueTracker.jira.migratePrompt')}
                  </p>
                  <button
                    onClick={handleMigrateFromGlobal}
                    className="text-xs text-info hover:underline mt-2 flex items-center gap-1"
                  >
                    {t('projectSections.integrations.issueTracker.jira.migrateButton')}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* JIRA Host */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t('projectSections.integrations.issueTracker.jira.host')}
            </Label>
            <Input
              placeholder="https://company.atlassian.net"
              value={envConfig.jiraHost || globalSettings?.globalJiraHost || ''}
              onChange={(e) => updateEnvConfig({ jiraHost: e.target.value })}
            />
          </div>

          {/* JIRA Email */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t('projectSections.integrations.issueTracker.jira.email')}
            </Label>
            <Input
              type="email"
              placeholder="user@company.com"
              value={envConfig.jiraEmail || globalSettings?.globalJiraEmail || ''}
              onChange={(e) => updateEnvConfig({ jiraEmail: e.target.value })}
            />
          </div>

          {/* JIRA API Token */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t('projectSections.integrations.issueTracker.jira.token')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('projectSections.integrations.issueTracker.jira.tokenDescription')}{' '}
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline"
              >
                Atlassian Account Settings
              </a>
            </p>
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                placeholder="ATATT3xFf..."
                value={envConfig.jiraToken || ''}
                onChange={(e) => updateEnvConfig({ jiraToken: e.target.value })}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* JIRA Project Key */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">
                {t('projectSections.integrations.issueTracker.jira.projectKey')}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('projectSections.integrations.issueTracker.jira.projectKeyDescription')}
            </p>
            <Input
              placeholder="CAP"
              value={envConfig.jiraProjectKey || ''}
              onChange={(e) => updateEnvConfig({ jiraProjectKey: e.target.value })}
            />
          </div>

          {/* Test Connection Button */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isTestingConnection || !effectiveHost || !effectiveEmail || !effectiveToken}
              className="gap-2"
            >
              {isTestingConnection ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('projectSections.integrations.issueTracker.jira.testing')}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  {t('projectSections.integrations.issueTracker.jira.testConnection')}
                </>
              )}
            </Button>
          </div>

          {/* Connection Status */}
          {connectionStatus && (
            <div className={`rounded-lg border p-3 ${
              connectionStatus.connected
                ? 'border-success/30 bg-success/10'
                : 'border-destructive/30 bg-destructive/10'
            }`}>
              <div className="flex items-center gap-3">
                {connectionStatus.connected ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <div>
                  <p className={`text-sm font-medium ${
                    connectionStatus.connected ? 'text-success' : 'text-destructive'
                  }`}>
                    {connectionStatus.connected
                      ? t('projectSections.integrations.issueTracker.jira.connected')
                      : t('projectSections.integrations.issueTracker.jira.connectionFailed')}
                  </p>
                  <p className={`text-xs mt-0.5 ${
                    connectionStatus.connected ? 'text-success/80' : 'text-destructive/80'
                  }`}>
                    {connectionStatus.connected
                      ? `${t('projectSections.integrations.issueTracker.jira.authenticatedAs')} ${connectionStatus.displayName}`
                      : connectionStatus.error}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


interface GitLabIssuesInfoProps {
  gitLabConnectionStatus: GitLabSyncStatus | null;
}

/**
 * GitLab Issues info when GitLab is selected as issue tracker.
 */
function GitLabIssuesInfo({ gitLabConnectionStatus }: GitLabIssuesInfoProps) {
  const { t } = useTranslation('settings');

  if (gitLabConnectionStatus?.connected) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-success/30 bg-success/10 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <p className="text-sm font-medium text-success">
                {t('projectSections.integrations.issueTracker.gitlab.connected')}
              </p>
              <p className="text-xs text-success/80 mt-0.5">
                {t('projectSections.integrations.issueTracker.gitlab.usingSourceControl')}
              </p>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('projectSections.integrations.issueTracker.gitlab.info')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
        <div>
          <p className="text-sm font-medium">
            {t('projectSections.integrations.issueTracker.gitlab.notConnected')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('projectSections.integrations.issueTracker.gitlab.configureFirst')}
          </p>
        </div>
      </div>
    </div>
  );
}
