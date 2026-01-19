import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, User, Lock, Globe, ChevronDown, GitBranch, Server } from 'lucide-react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Separator } from '../../ui/separator';
import { Button } from '../../ui/button';
import { PasswordInput } from '../../project-settings/PasswordInput';
import type { ProjectEnvConfig, ProjectSettings } from '../../../../shared/types';

// Debug logging
const DEBUG = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';
function debugLog(message: string, data?: unknown) {
  if (DEBUG) {
    if (data !== undefined) {
      console.warn(`[GiteaIntegration] ${message}`, data);
    } else {
      console.warn(`[GiteaIntegration] ${message}`);
    }
  }
}

interface GiteaConnectionStatus {
  connected: boolean;
  repoFullName?: string;
  repoDescription?: string;
  error?: string;
}

interface GiteaIntegrationProps {
  envConfig: ProjectEnvConfig | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;
  showGiteaToken: boolean;
  setShowGiteaToken: React.Dispatch<React.SetStateAction<boolean>>;
  giteaConnectionStatus: GiteaConnectionStatus | null;
  isCheckingGitea: boolean;
  projectPath?: string;
  // Project settings for mainBranch (used by kanban tasks and terminal worktrees)
  settings?: ProjectSettings;
  setSettings?: React.Dispatch<React.SetStateAction<ProjectSettings>>;
}

/**
 * Gitea integration settings component.
 * Manages Gitea token, repository configuration, and connection status.
 * Supports self-hosted Gitea instances.
 */
export function GiteaIntegration({
  envConfig,
  updateEnvConfig,
  showGiteaToken: _showGiteaToken,
  setShowGiteaToken: _setShowGiteaToken,
  giteaConnectionStatus,
  isCheckingGitea,
  projectPath,
  settings,
  setSettings
}: GiteaIntegrationProps) {
  const { t } = useTranslation('gitea');

  // Branch selection state
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [branchesError, setBranchesError] = useState<string | null>(null);

  debugLog('Render - projectPath:', projectPath);
  debugLog('Render - envConfig:', envConfig ? { giteaEnabled: envConfig.giteaEnabled, hasToken: !!envConfig.giteaToken, defaultBranch: envConfig.defaultBranch } : null);

  // Fetch branches when Gitea is enabled and project path is available
  useEffect(() => {
    debugLog(`useEffect[branches] - giteaEnabled: ${envConfig?.giteaEnabled}, projectPath: ${projectPath}`);
    if (envConfig?.giteaEnabled && projectPath) {
      debugLog('useEffect[branches] - Triggering fetchBranches');
      fetchBranches();
    } else {
      debugLog('useEffect[branches] - Skipping fetchBranches (conditions not met)');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envConfig?.giteaEnabled, projectPath]);

  /**
   * Handler for branch selection changes.
   * Updates BOTH project.settings.mainBranch (for Electron app) and envConfig.defaultBranch (for CLI backward compatibility).
   */
  const handleBranchChange = (branch: string) => {
    debugLog('handleBranchChange: Updating branch to:', branch);

    // Update project settings (primary source for Electron app)
    if (setSettings) {
      setSettings(prev => ({ ...prev, mainBranch: branch }));
      debugLog('handleBranchChange: Updated settings.mainBranch');
    }

    // Also update envConfig for CLI backward compatibility
    updateEnvConfig({ defaultBranch: branch });
    debugLog('handleBranchChange: Updated envConfig.defaultBranch');
  };

  const fetchBranches = async () => {
    if (!projectPath) {
      debugLog('fetchBranches: No projectPath, skipping');
      return;
    }

    debugLog('fetchBranches: Starting with projectPath:', projectPath);
    setIsLoadingBranches(true);
    setBranchesError(null);

    try {
      debugLog('fetchBranches: Calling getGitBranches...');
      const result = await window.electronAPI.getGitBranches(projectPath);
      debugLog('fetchBranches: getGitBranches result:', { success: result.success, dataType: typeof result.data, dataLength: Array.isArray(result.data) ? result.data.length : 'N/A', error: result.error });

      if (result.success && result.data) {
        setBranches(result.data);
        debugLog('fetchBranches: Loaded branches:', result.data.length);

        // Auto-detect default branch if not set in project settings
        // Priority: settings.mainBranch > envConfig.defaultBranch > auto-detect
        if (!settings?.mainBranch && !envConfig?.defaultBranch) {
          debugLog('fetchBranches: No branch set, auto-detecting...');
          const detectResult = await window.electronAPI.detectMainBranch(projectPath);
          debugLog('fetchBranches: detectMainBranch result:', detectResult);
          if (detectResult.success && detectResult.data) {
            debugLog('fetchBranches: Auto-detected default branch:', detectResult.data);
            handleBranchChange(detectResult.data);
          }
        }
      } else {
        debugLog('fetchBranches: Failed -', result.error || 'No data returned');
        setBranchesError(result.error || 'Failed to load branches');
      }
    } catch (err) {
      debugLog('fetchBranches: Exception:', err);
      setBranchesError(err instanceof Error ? err.message : 'Failed to load branches');
    } finally {
      setIsLoadingBranches(false);
    }
  };

  if (!envConfig) {
    debugLog('No envConfig, returning null');
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">{t('settings.enableIssues')}</Label>
          <p className="text-xs text-muted-foreground">
            {t('settings.enableIssuesDescription')}
          </p>
        </div>
        <Switch
          checked={envConfig.giteaEnabled || false}
          onCheckedChange={(checked) => updateEnvConfig({ giteaEnabled: checked })}
        />
      </div>

      {envConfig.giteaEnabled && (
        <>
          {/* Instance URL */}
          <InstanceUrlInput
            value={envConfig.giteaInstanceUrl || ''}
            onChange={(value) => updateEnvConfig({ giteaInstanceUrl: value })}
          />

          {/* Token Entry */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">{t('settings.personalAccessToken')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('settings.tokenScope')} <code className="px-1 bg-muted rounded">{t('settings.scopeRepo')}</code> {t('settings.scopeFrom')}{' '}
              <a
                href={`${envConfig.giteaInstanceUrl || 'https://gitea.example.com'}/user/settings/applications`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline"
              >
                {t('settings.giteaSettings')}
              </a>
            </p>
            <PasswordInput
              value={envConfig.giteaToken || ''}
              onChange={(value) => updateEnvConfig({ giteaToken: value })}
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </div>

          <ProjectInput
            value={envConfig.giteaProject || ''}
            onChange={(value) => updateEnvConfig({ giteaProject: value })}
          />

          {envConfig.giteaToken && envConfig.giteaProject && (
            <ConnectionStatus
              isChecking={isCheckingGitea}
              connectionStatus={giteaConnectionStatus}
            />
          )}

          {giteaConnectionStatus?.connected && <IssuesAvailableInfo />}

          <Separator />

          {/* Default Branch Selector */}
          {projectPath && (
            <BranchSelector
              branches={branches}
              selectedBranch={settings?.mainBranch || envConfig.defaultBranch || ''}
              isLoading={isLoadingBranches}
              error={branchesError}
              onSelect={handleBranchChange}
              onRefresh={fetchBranches}
            />
          )}

          <Separator />

          <AutoSyncToggle
            enabled={envConfig.giteaAutoSync || false}
            onToggle={(checked) => updateEnvConfig({ giteaAutoSync: checked })}
          />
        </>
      )}
    </div>
  );
}

interface InstanceUrlInputProps {
  value: string;
  onChange: (value: string) => void;
}

function InstanceUrlInput({ value, onChange }: InstanceUrlInputProps) {
  const { t } = useTranslation('gitea');

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Server className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium text-foreground">{t('settings.instance')}</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('settings.instanceDescription')}
      </p>
      <Input
        placeholder="https://gitea.example.com"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

interface ProjectInputProps {
  value: string;
  onChange: (value: string) => void;
}

function ProjectInput({ value, onChange }: ProjectInputProps) {
  const { t } = useTranslation('gitea');

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{t('settings.project')}</Label>
      <p className="text-xs text-muted-foreground">
        {t('settings.projectFormat')} <code className="px-1 bg-muted rounded">owner/repo</code> {t('settings.projectFormatExample')}
      </p>
      <Input
        placeholder="owner/repository"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

interface ConnectionStatusProps {
  isChecking: boolean;
  connectionStatus: GiteaConnectionStatus | null;
}

function ConnectionStatus({ isChecking, connectionStatus }: ConnectionStatusProps) {
  const { t } = useTranslation('gitea');

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{t('settings.connectionStatus')}</p>
          <p className="text-xs text-muted-foreground">
            {isChecking ? t('settings.checking') :
              connectionStatus?.connected
                ? `${t('settings.connectedTo')} ${connectionStatus.repoFullName}`
                : connectionStatus?.error || t('settings.notConnected')}
          </p>
          {connectionStatus?.connected && connectionStatus.repoDescription && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              {connectionStatus.repoDescription}
            </p>
          )}
        </div>
        {isChecking ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : connectionStatus?.connected ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <AlertCircle className="h-4 w-4 text-warning" />
        )}
      </div>
    </div>
  );
}

function IssuesAvailableInfo() {
  const { t } = useTranslation('gitea');

  // Gitea icon (cup of tea)
  return (
    <div className="rounded-lg border border-info/30 bg-info/5 p-3">
      <div className="flex items-start gap-3">
        <svg className="h-5 w-5 text-info mt-0.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.35 21.5v-1.5h5.3v1.5H9.35Zm-4.5-3v-6q0-2.075 1.175-3.775T9.1 6.1V3.5h5.8v2.6q1.9.925 3.075 2.625T19.15 12.5v6h-14.3Zm1.5-1.5h11.3v-4.5q0-2.075-1.325-3.538Q14.9 7.5 12.5 7.5q-2.4 0-3.725 1.463Q7.35 10.425 7.35 12.5v4.5Zm10.5 0H6.15h11.7Zm2.65-5.75v-1.5h2v1.5h-2Zm-4.25-5.2-1.05-1.1 1.4-1.4 1.05 1.1-1.4 1.4ZM11.5 5V2.5h1V5h-1Zm-5.75.95-1.4-1.4L5.4 3.5l1.4 1.4-1.05 1.05ZM1 11.25v-1.5h2v1.5H1Z"/>
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{t('settings.issuesAvailable')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('settings.issuesAvailableDescription')}
          </p>
        </div>
      </div>
    </div>
  );
}

interface AutoSyncToggleProps {
  enabled: boolean;
  onToggle: (checked: boolean) => void;
}

function AutoSyncToggle({ enabled, onToggle }: AutoSyncToggleProps) {
  const { t } = useTranslation('gitea');

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-info" />
          <Label className="font-normal text-foreground">{t('settings.autoSyncOnLoad')}</Label>
        </div>
        <p className="text-xs text-muted-foreground pl-6">
          {t('settings.autoSyncDescription')}
        </p>
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}

interface BranchSelectorProps {
  branches: string[];
  selectedBranch: string;
  isLoading: boolean;
  error: string | null;
  onSelect: (branch: string) => void;
  onRefresh: () => void;
}

function BranchSelector({
  branches,
  selectedBranch,
  isLoading,
  error,
  onSelect,
  onRefresh
}: BranchSelectorProps) {
  const { t } = useTranslation('gitea');
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const filteredBranches = branches.filter(branch =>
    branch.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-info" />
            <Label className="text-sm font-medium text-foreground">{t('settings.defaultBranch')}</Label>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            {t('settings.defaultBranchDescription')}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-7 px-2"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive pl-6">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      <div className="relative pl-6">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
          className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('settings.loadingBranches')}
            </span>
          ) : selectedBranch ? (
            <span className="flex items-center gap-2">
              <GitBranch className="h-3 w-3 text-muted-foreground" />
              {selectedBranch}
            </span>
          ) : (
            <span className="text-muted-foreground">{t('settings.autoDetect')}</span>
          )}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && !isLoading && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-hidden">
            <div className="p-2 border-b border-border">
              <Input
                placeholder={t('settings.searchBranches')}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-8 text-sm"
                autoFocus
              />
            </div>

            <button
              type="button"
              onClick={() => {
                onSelect('');
                setIsOpen(false);
                setFilter('');
              }}
              className={`w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2 ${
                !selectedBranch ? 'bg-accent' : ''
              }`}
            >
              <span className="text-sm text-muted-foreground italic">{t('settings.autoDetect')}</span>
            </button>

            <div className="max-h-40 overflow-y-auto border-t border-border">
              {filteredBranches.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  {filter ? t('settings.noMatchingBranches') : t('settings.noBranchesFound')}
                </div>
              ) : (
                filteredBranches.map((branch) => (
                  <button
                    key={branch}
                    type="button"
                    onClick={() => {
                      onSelect(branch);
                      setIsOpen(false);
                      setFilter('');
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2 ${
                      branch === selectedBranch ? 'bg-accent' : ''
                    }`}
                  >
                    <GitBranch className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{branch}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {selectedBranch && (
        <p className="text-xs text-muted-foreground pl-6">
          {t('settings.branchFromNote')} <code className="px-1 bg-muted rounded">{selectedBranch}</code>
        </p>
      )}
    </div>
  );
}
