import { useState, useEffect, useCallback, useRef } from 'react';
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
  GitBranch
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  onGitHubToggle
}: IntegrationSettingsProps) {
  const { t } = useTranslation(['settings', 'common']);
  // Branch selection state
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  // Track whether initial branch detection has been done to prevent double-execution
  const hasDetectedMainBranch = useRef(false);
  // Track mainBranch in a ref to avoid stale closure issues in loadBranches callback
  const mainBranchRef = useRef(settings.mainBranch);

  // Keep mainBranchRef in sync with settings.mainBranch
  useEffect(() => {
    mainBranchRef.current = settings.mainBranch;
  }, [settings.mainBranch]);

  // Reset detection flag when project OR GitHub repo changes
  // This allows auto-detection to run for a new repo within the same project
  useEffect(() => {
    hasDetectedMainBranch.current = false;
  }, [project.path, envConfig?.githubRepo]);

  // Load branches function wrapped in useCallback
  // Note: We use refs for mainBranch check and detection tracking to avoid stale closures
  const loadBranches = useCallback(async () => {
    setIsLoadingBranches(true);
    try {
      const result = await window.electronAPI.getGitBranches(project.path);
      if (result.success && result.data) {
        setBranches(result.data);
        // Auto-detect main branch if not set and not already detected
        // Use mainBranchRef to avoid stale closure issues
        if (!mainBranchRef.current && !hasDetectedMainBranch.current) {
          hasDetectedMainBranch.current = true;
          const detectResult = await window.electronAPI.detectMainBranch(project.path);
          // Re-check mainBranchRef after await - user may have selected a branch during detection
          if (detectResult.success && detectResult.data !== null && detectResult.data !== undefined && !mainBranchRef.current) {
            const detectedBranch = detectResult.data;
            setSettings(prev => ({ ...prev, mainBranch: detectedBranch }));
          }
        }
      }
    } catch (error) {
      console.error('Failed to load branches:', error);
    } finally {
      setIsLoadingBranches(false);
    }
    // settings.mainBranch not in deps - we use mainBranchRef to avoid stale closures
    // hasDetectedMainBranch ref tracks whether detection has run this session
  }, [project.path, setSettings]);

  // Load branches when GitHub section expands or GitHub connection changes
  useEffect(() => {
    // Only load branches when:
    // 1. GitHub section is expanded
    // 2. Project path exists
    // 3. GitHub is enabled with repo configured
    if (!githubExpanded || !project.path) return;
    if (!envConfig?.githubEnabled || !envConfig?.githubRepo) return;

    // Only load branches when we have a successful connection
    if (gitHubConnectionStatus?.connected) {
      loadBranches();
    }
  }, [githubExpanded, project.path, envConfig?.githubEnabled, envConfig?.githubRepo, gitHubConnectionStatus?.connected, loadBranches]);

  if (!envConfig) return null;

  return (
    <>
      {/* Linear Integration Section */}
      <section className="space-y-3">
        <button
          onClick={onLinearToggle}
          className="w-full flex items-center justify-between text-sm font-semibold text-foreground hover:text-foreground/80"
        >
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            {t('projectSections.linear.integrationTitle')}
            {envConfig.linearEnabled && (
              <span className="px-2 py-0.5 text-xs bg-success/10 text-success rounded-full">
                {t('common:labels.enabled')}
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
                <Label className="font-normal text-foreground">{t('projectSections.linear.enableSync')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('projectSections.linear.enableSyncDescription')}
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
                  <Label className="text-sm font-medium text-foreground">{t('projectSections.linear.apiKey')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('projectSections.linear.apiKeyDescription')}{' '}
                    <a
                      href="https://linear.app/settings/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-info hover:underline"
                    >
                      {t('projectSections.linear.linearSettings')}
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
                        <p className="text-sm font-medium text-foreground">{t('projectSections.linear.connectionStatus')}</p>
                        <p className="text-xs text-muted-foreground">
                          {isCheckingLinear ? t('projectSections.linear.checking') :
                            linearConnectionStatus?.connected
                              ? (linearConnectionStatus.teamName ? t('projectSections.linear.connectedTo', { teamName: linearConnectionStatus.teamName }) : t('projectSections.linear.connected'))
                              : linearConnectionStatus?.error || t('projectSections.linear.notConnected')}
                        </p>
                        {linearConnectionStatus?.connected && linearConnectionStatus.issueCount !== undefined && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('projectSections.linear.tasksAvailable', { count: linearConnectionStatus.issueCount })}
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
                        <p className="text-sm font-medium text-foreground">{t('projectSections.linear.importExistingTasks')}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('projectSections.linear.importDescription')}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={onOpenLinearImport}
                        >
                          <Import className="h-4 w-4 mr-2" />
                          {t('projectSections.linear.importFromLinear')}
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
                      <Label className="font-normal text-foreground">{t('projectSections.linear.realtimeSync')}</Label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      {t('projectSections.linear.realtimeSyncDescription')}
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
                      {t('projectSections.linear.realtimeSyncWarning')}
                    </p>
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">{t('projectSections.linear.teamId')}</Label>
                    <Input
                      placeholder={t('projectSections.linear.teamIdPlaceholder')}
                      value={envConfig.linearTeamId || ''}
                      onChange={(e) => updateEnvConfig({ linearTeamId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">{t('projectSections.linear.projectId')}</Label>
                    <Input
                      placeholder={t('projectSections.linear.projectIdPlaceholder')}
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
            {t('projectSections.github.integrationTitle')}
            {envConfig.githubEnabled && (
              <span className="px-2 py-0.5 text-xs bg-success/10 text-success rounded-full">
                {t('common:labels.enabled')}
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
                <Label className="font-normal text-foreground">{t('projectSections.github.enableGitHubIssues')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('projectSections.github.syncIssuesDescription')}
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
                  <Label className="text-sm font-medium text-foreground">{t('projectSections.github.personalAccessToken')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('projectSections.github.createTokenDescription', { scope: 'repo' })}{' '}
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo&description=Auto-Build-UI"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-info hover:underline"
                    >
                      {t('projectSections.github.gitHubSettings')}
                    </a>
                  </p>
                  <div className="relative">
                    <Input
                      type={showGitHubToken ? 'text' : 'password'}
                      placeholder="ghp_xxxxxxxx or github_pat_xxxxxxxx"
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
                  <Label className="text-sm font-medium text-foreground">{t('projectSections.github.repository')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('projectSections.github.repositoryFormat', { format: 'owner/repo' })}
                  </p>
                  <Input
                    placeholder="owner/repository"
                    value={envConfig.githubRepo || ''}
                    onChange={(e) => updateEnvConfig({ githubRepo: e.target.value })}
                  />
                </div>

                {/* Connection Status */}
                {envConfig.githubToken && envConfig.githubRepo && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{t('projectSections.github.connectionStatus')}</p>
                        <p className="text-xs text-muted-foreground">
                          {isCheckingGitHub ? t('projectSections.linear.checking') :
                            gitHubConnectionStatus?.connected
                              ? t('projectSections.github.connectedTo', { repo: gitHubConnectionStatus.repoFullName })
                              : gitHubConnectionStatus?.error || t('projectSections.github.notConnectedError')}
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
                        <p className="text-sm font-medium text-foreground">{t('projectSections.github.issuesAvailable')}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('projectSections.github.issuesAvailableDescription')}
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
                      <Label className="font-normal text-foreground">{t('projectSections.github.autoSyncOnLoad')}</Label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      {t('projectSections.github.autoSyncDescription')}
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
                    <Label className="text-sm font-medium text-foreground">{t('projectSections.github.defaultBranch')}</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('projectSections.github.baseBranchForWorktrees')}
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
                          <span>{t('projectSections.github.loadingBranches')}</span>
                        </div>
                      ) : (
                        <SelectValue placeholder={t('projectSections.github.selectBranch')} />
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
                      {t('projectSections.github.tasksWillBranchFrom')} <code className="px-1 bg-muted rounded">{settings.mainBranch}</code>
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
