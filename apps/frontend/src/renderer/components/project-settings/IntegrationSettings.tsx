import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Zap,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Import,
  Radio,
  Github,
  RefreshCw,
  GitBranch,
  Globe
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import type { ProjectEnvConfig, LinearSyncStatus, GitHubSyncStatus, Project, ProjectSettings as ProjectSettingsType } from '../../../shared/types';

interface IntegrationSettingsProps {
  envConfig: ProjectEnvConfig | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;

  // Project settings for main branch
  project: Project;
  settings: ProjectSettingsType;
  setSettings: React.Dispatch<React.SetStateAction<ProjectSettingsType>>;

  // Linear state
  showLinearKey: boolean;
  setShowLinearKey: React.Dispatch<React.SetStateAction<boolean>>;
  linearConnectionStatus: LinearSyncStatus | null;
  isCheckingLinear: boolean;
  linearExpanded: boolean;
  onLinearToggle: () => void;
  onOpenLinearImport: () => void;

  // GitHub state
  showGitHubToken: boolean;
  setShowGitHubToken: React.Dispatch<React.SetStateAction<boolean>>;
  gitHubConnectionStatus: GitHubSyncStatus | null;
  isCheckingGitHub: boolean;
  githubExpanded: boolean;
  onGitHubToggle: () => void;

  // Proxy state
  proxyExpanded: boolean;
  onProxyToggle: () => void;
}

export function IntegrationSettings({
  envConfig,
  updateEnvConfig,
  project,
  settings,
  setSettings,
  showLinearKey,
  setShowLinearKey,
  linearConnectionStatus,
  isCheckingLinear,
  linearExpanded,
  onLinearToggle,
  onOpenLinearImport,
  showGitHubToken,
  setShowGitHubToken,
  gitHubConnectionStatus,
  isCheckingGitHub,
  githubExpanded,
  onGitHubToggle,
  proxyExpanded,
  onProxyToggle
}: IntegrationSettingsProps) {
  const { t } = useTranslation('settings');
  
  // Branch selection state
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  // Load branches when GitHub section expands
  useEffect(() => {
    if (githubExpanded && project.path) {
      loadBranches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadBranches is intentionally excluded to avoid infinite loops
  }, [githubExpanded, project.path]);

  const loadBranches = async () => {
    setIsLoadingBranches(true);
    try {
      const result = await window.electronAPI.getGitBranches(project.path);
      if (result.success && result.data) {
        setBranches(result.data);
        // Auto-detect main branch if not set
        if (!settings.mainBranch) {
          const detectResult = await window.electronAPI.detectMainBranch(project.path);
          if (detectResult.success && detectResult.data) {
            setSettings(prev => ({ ...prev, mainBranch: detectResult.data! }));
          }
        }
      }
    } catch (error) {
      console.error('Failed to load branches:', error);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  if (!envConfig) return null;

  return (
    <>
      {/* Proxy Settings Section */}
      <section className="space-y-3">
        <button
          onClick={onProxyToggle}
          className="w-full flex items-center justify-between text-sm font-semibold text-foreground hover:text-foreground/80"
        >
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {t('proxy.title', 'Proxy Settings')}
            {(envConfig.httpProxy || envConfig.httpsProxy) && (
              <span className="px-2 py-0.5 text-xs bg-success/10 text-success rounded-full">
                {t('proxy.enabled', 'Enabled')}
              </span>
            )}
          </div>
          {proxyExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {proxyExpanded && (
          <div className="space-y-4 pl-6 pt-2">
            <div className="rounded-lg border border-info/30 bg-info/5 p-3">
              <p className="text-xs text-muted-foreground">
                {t('proxy.description', 'Configure HTTP/HTTPS proxy for API requests. Useful for corporate networks or bypassing restrictions.')}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                {t('proxy.httpProxy', 'HTTP Proxy')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('proxy.httpProxyHelp', 'Format: http://proxy.example.com:8080 or http://user:pass@proxy.example.com:8080')}
              </p>
              <Input
                type="text"
                placeholder="http://proxy.example.com:8080"
                value={envConfig.httpProxy || ''}
                onChange={(e) => updateEnvConfig({ httpProxy: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                {t('proxy.httpsProxy', 'HTTPS Proxy')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('proxy.httpsProxyHelp', 'Format: http://proxy.example.com:8080 (note: still uses http:// scheme)')}
              </p>
              <Input
                type="text"
                placeholder="http://proxy.example.com:8080"
                value={envConfig.httpsProxy || ''}
                onChange={(e) => updateEnvConfig({ httpsProxy: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                {t('proxy.noProxy', 'No Proxy')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('proxy.noProxyHelp', 'Comma-separated list of hosts to exclude from proxy (e.g., localhost,127.0.0.1,.local)')}
              </p>
              <Input
                type="text"
                placeholder="localhost,127.0.0.1,.local"
                value={envConfig.noProxy || ''}
                onChange={(e) => updateEnvConfig({ noProxy: e.target.value })}
              />
            </div>

            {(envConfig.httpProxy || envConfig.httpsProxy) && (
              <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {t('proxy.configured', 'Proxy Configured')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('proxy.configuredDescription', 'API requests will be routed through the configured proxy server.')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <Separator />

      {/* Linear Integration Section */}
      <section className="space-y-3">
        <button
          onClick={onLinearToggle}
          className="w-full flex items-center justify-between text-sm font-semibold text-foreground hover:text-foreground/80"
        >
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            {t('linear.title')}
            {envConfig.linearEnabled && (
              <span className="px-2 py-0.5 text-xs bg-success/10 text-success rounded-full">
                {t('linear.enabled')}
              </span>
            )}
          </div>
          {linearExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {linearExpanded && (
          <div className="space-y-4 pl-6 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-normal text-foreground">{t('linear.enableSync')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('linear.createAndUpdate')}
                </p>
              </div>
              <Switch
                checked={envConfig.linearEnabled}
                onCheckedChange={(checked) => updateEnvConfig({ linearEnabled: checked })}
              />
            </div>

            {envConfig.linearEnabled && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">{t('linear.apiKey')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('linear.getApiKey')}{' '}
                    <a
                      href="https://linear.app/settings/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-info hover:underline"
                    >
                      {t('linear.linearSettings')}
                    </a>
                  </p>
                  <div className="relative">
                    <Input
                      type={showLinearKey ? 'text' : 'password'}
                      placeholder="lin_api_xxxxxxxx"
                      value={envConfig.linearApiKey || ''}
                      onChange={(e) => updateEnvConfig({ linearApiKey: e.target.value })}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLinearKey(!showLinearKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showLinearKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Connection Status */}
                {envConfig.linearApiKey && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{t('linxxxxxxxxxctionStatus')}</p>
                        <p className="text-xs text-muted-foreground">
                          {isCheckingLinear ? t('linear.checking') :
                            linearConnectionStatus?.connected
                              ? `${t('linexxxxxxxxcted')}${linearConnectionStatus.teamName ? ` ${t('linear.to')} ${linearConnectionStatus.teamName}` : ''}`
                              : linearConnectionStatus?.error || t('linear.notConnected')}
                        </p>
                        {linearConnectionStatusxxxxxxxcted && linearxxxxxctionStatus.issueCount !== undefined && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {linearConnectionStatus.issueCount}+ {t('linear.tasksAvailable')}
                          </p>
                        )}
                      </div>
                      {isCheckingLinear ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : linearConnectionStatus?.connected ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-warning" />
                      )}
                    </div>
                  </div>
                )}

                {/* Import Existing Tasks Button */}
                {linearConnectionStatus?.connected && (
                  <div className="rounded-lg border border-info/30 bg-info/5 p-3">
                    <div className="flex items-start gap-3">
                      <Import className="h-5 w-5 text-info mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{t('linear.importExistingTasks')}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('linear.selectWhichIssues')}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={onOpenLinearImport}
                        >
                          <Import className="h-4 w-4 mr-2" />
                          {t('linear.importTasksButton')}
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
                      <Label className="font-normal text-foreground">{t('linear.realTimeSync')}</Label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      {t('linear.autoImport')}
                    </p>
                  </div>
                  <Switch
                    checked={envConfig.linearRealtimeSync || false}
                    onCheckedChange={(checked) => updateEnvConfig({ linearRealtimeSync: checked })}
                  />
                </div>

                {envConfig.linearRealtimeSync && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 ml-6">
                    <p className="text-xs text-warning">
                      {t('linear.whenEnabled')}
                    </p>
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">{t('linear.teamId')}</Label>
                    <Input
                      placeholder={t('linear.autoDetected')}
                      value={envConfig.linearTeamId || ''}
                      onChange={(e) => updateEnvConfig({ linearTeamId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">{t('linear.projectId')}</Label>
                    <Input
                      placeholder={t('linear.autoCreated')}
                      value={envConfig.linearProjectId || ''}
                      onChange={(e) => updateEnvConfig({ linearProjectId: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <Separator />

      {/* GitHub Integration Section */}
      <section className="space-y-3">
        <button
          onClick={onGitHubToggle}
          className="w-full flex items-center justify-between text-sm font-semibold text-foreground hover:text-foreground/80"
        >
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4" />
            {t('sections.githubIntegration.title')}
            {envConfig.githubEnabled && (
              <span className="px-2 py-0.5 text-xs bg-success/10 text-success rounded-full">
                {t('sections.githubIntegration.statusEnabled')}
              </span>
            )}
          </div>
          {githubExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {githubExpanded && (
          <div className="space-y-4 pl-6 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-normal text-foreground">{t('sections.githubIntegration.enableLabel')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('sections.githubIntegration.enableDescription')}
                </p>
              </div>
              <Switch
                checked={envConfig.githubEnabled}
                onCheckedChange={(checked) => updateEnvConfig({ githubEnabled: checked })}
              />
            </div>

            {envConfig.githubEnabled && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">{t('sections.githubIntegration.patTitle')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('sections.githubIntegration.patInstructions', {
                      interpolation: { escapeValue: false },
                      defaultValue: 'Create a token with repo scope from GitHub Settings'
                    })}{' '}
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo&description=Auto-Build-UI"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-info hover:underline"
                    >
                      GitHub Settings
                    </a>
                  </p>
                  <div className="relative">
                    <Input
                      type={showGitHubToken ? 'text' : 'password'}
                      placeholder={t('sections.githubIntegration.patPlaceholder')}
                      value={envConfig.githubToken || ''}
                      onChange={(e) => updateEnvConfig({ githubToken: e.target.value })}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGitHubToken(!showGitHubToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showGitHubToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">{t('sections.githubIntegration.repoTitle')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('sections.githubIntegration.repoFormat', {
                      interpolation: { escapeValue: false },
                      defaultValue: 'Format: owner/repo (e.g., facebook/react)'
                    })}
                  </p>
                  <Input
                    placeholder={t('sections.githubIntegration.repoPlaceholder')}
                    value={envConfig.githubRepo || ''}
                    onChange={(e) => updateEnvConfig({ githubRepo: e.target.value })}
                  />
                </div>

                {/* Connection Status */}
                {envConfig.githubToken && envConfig.githubRepo && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{t('sections.githubIntegration.connectionTitle')}</p>
                        <p className="text-xs text-muted-foreground">
                          {isCheckingGitHub ? t('sections.githubIntegration.checking') :
                            gitHubConnectionStatus?.connected
                              ? t('sections.githubIntegration.connectionSuccess', { repoFullName: gitHubConnectionStatus.repoFullName })
                              : gitHubConnectionStatus?.error || t('sections.githubIntegration.connectionError')}
                        </p>
                        {gitHubConnectionStatus?.connected && gitHubConnectionStatus.repoDescription && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            {gitHubConnectionStatus.repoDescription}
                          </p>
                        )}
                      </div>
                      {isCheckingGitHub ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : gitHubConnectionStatus?.connected ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-warning" />
                      )}
                    </div>
                  </div>
                )}

                {/* Info about accessing issues */}
                {gitHubConnectionStatus?.connected && (
                  <div className="rounded-lg border border-info/30 bg-info/5 p-3">
                    <div className="flex items-start gap-3">
                      <Github className="h-5 w-5 text-info mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{t('sections.githubIntegration.issuesAvailableTitle')}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('sections.githubIntegration.issuesAvailableDescription')}
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
                      <Label className="font-normal text-foreground">{t('sections.githubIntegration.autoSyncLabel')}</Label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      {t('sections.githubIntegration.autoSyncDescription')}
                    </p>
                  </div>
                  <Switch
                    checked={envConfig.githubAutoSync || false}
                    onCheckedChange={(checked) => updateEnvConfig({ githubAutoSync: checked })}
                  />
                </div>

                <Separator />

                {/* Main Branch Selection */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-info" />
                    <Label className="text-sm font-medium text-foreground">{t('sections.githubIntegration.mainBranchLabel')}</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('sections.githubIntegration.mainBranchDescription')}
                  </p>
                  <Select
                    value={settings.mainBranch || ''}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, mainBranch: value }))}
                    disabled={isLoadingBranches || branches.length === 0}
                  >
                    <SelectTrigger>
                      {isLoadingBranches ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>{t('sections.githubIntegration.loadingBranches')}</span>
                        </div>
                      ) : (
                        <SelectValue placeholder={t('sections.githubIntegration.selectMainBranch')} />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {settings.mainBranch && (
                    <p className="text-xs text-muted-foreground">
                      {t('sections.githubIntegration.tasksWillBranch', {
                        mainBranch: settings.mainBranch,
                        interpolation: { escapeValue: false },
                        defaultValue: `Tasks will be created on branches like auto-claude/task-name from ${settings.mainBranch}`
                      })}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </>
  );
}

