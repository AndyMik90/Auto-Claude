import { useState } from 'react';
import { Github, RefreshCw, KeyRound, Info, CheckCircle2, GitFork, Loader2, Search, AlertCircle, AlertTriangle } from 'lucide-react';
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
  projectId?: string;
}

export function GitHubIntegrationSection({
  isExpanded,
  onToggle,
  envConfig,
  onUpdateConfig,
  gitHubConnectionStatus,
  isCheckingGitHub,
  projectName,
  projectId,
}: GitHubIntegrationSectionProps) {
  // Show OAuth flow if user previously used OAuth, or if there's no token yet
  const [showOAuthFlow, setShowOAuthFlow] = useState(
    envConfig.githubAuthMethod === 'oauth' || (!envConfig.githubToken && !envConfig.githubAuthMethod)
  );

  // Fork detection state
  const [isDetectingFork, setIsDetectingFork] = useState(false);
  const [forkDetectionError, setForkDetectionError] = useState<string | null>(null);

  // Parent repo validation state
  const [parentRepoValidationError, setParentRepoValidationError] = useState<string | null>(null);

  /**
   * Validate parent repository format
   * Accepts: owner/repo, GitHub URLs, or empty string
   * Returns error message or null if valid
   */
  const validateParentRepo = (value: string): string | null => {
    if (!value || value.trim() === '') {
      return null; // Empty is valid (optional field)
    }

    let normalized = value.trim();

    // Remove trailing .git if present
    normalized = normalized.replace(/\.git$/, '');

    // Handle full GitHub URLs
    if (normalized.startsWith('https://github.com/')) {
      normalized = normalized.replace('https://github.com/', '');
    } else if (normalized.startsWith('http://github.com/')) {
      normalized = normalized.replace('http://github.com/', '');
    } else if (normalized.startsWith('git@github.com:')) {
      normalized = normalized.replace('git@github.com:', '');
    }

    normalized = normalized.trim();

    // Check if the normalized value matches owner/repo format
    // Valid format: alphanumeric, hyphens, underscores, dots, with exactly one slash
    const ownerRepoPattern = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

    if (!ownerRepoPattern.test(normalized)) {
      return 'Invalid format. Use owner/repo format (e.g., facebook/react) or a GitHub URL.';
    }

    return null;
  };

  /**
   * Handle parent repo input change with validation
   */
  const handleParentRepoChange = (value: string) => {
    const error = validateParentRepo(value);
    setParentRepoValidationError(error);
    // Always update the value, but show error if invalid
    onUpdateConfig({ githubParentRepo: value || undefined });
  };

  // Handle fork detection
  const handleDetectFork = async () => {
    if (!projectId) return;

    setIsDetectingFork(true);
    setForkDetectionError(null);

    try {
      const result = await window.electronAPI.detectFork(projectId);
      if (result.success && result.data) {
        if (result.data.isFork && result.data.parentRepository) {
          // Auto-populate the parent repo field with detected value
          onUpdateConfig({ githubParentRepo: result.data.parentRepository.fullName });
        }
      } else {
        setForkDetectionError(result.error || 'Failed to detect fork status');
      }
    } catch (err) {
      setForkDetectionError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsDetectingFork(false);
    }
  };

  // Build badges: "Enabled" when GitHub is enabled, "Fork" when connected to a fork
  const badges = envConfig.githubEnabled ? (
    <>
      <StatusBadge status="success" label="Enabled" />
      {gitHubConnectionStatus?.connected && gitHubConnectionStatus?.isFork && (
        <StatusBadge status="info" label="Fork" />
      )}
    </>
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
      title="GitHub Integration"
      icon={<Github className="h-4 w-4" />}
      isExpanded={isExpanded}
      onToggle={onToggle}
      badge={badges}
    >
      {/* Project-Specific Configuration Notice */}
      {projectName && (
        <div className="rounded-lg border border-info/30 bg-info/5 p-3 mb-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-info mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Project-Specific Configuration</p>
              <p className="text-xs text-muted-foreground mt-1">
                This GitHub repository is configured only for <span className="font-semibold text-foreground">{projectName}</span>.
                Each project can have its own GitHub repository.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">Enable GitHub Issues</Label>
          <p className="text-xs text-muted-foreground">
            Sync issues from GitHub and create tasks automatically
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
                <Label className="text-sm font-medium text-foreground">GitHub Authentication</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdateConfig({ githubToken: '', githubAuthMethod: undefined })}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Use Manual Token
                </Button>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border border-success/30 bg-success/5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm text-foreground">Authenticated via GitHub OAuth (gh CLI)</span>
              </div>
            </div>
          ) : showOAuthFlow ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">GitHub Authentication</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOAuthFlow(false)}
                >
                  Use Manual Token
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
                <Label className="text-sm font-medium text-foreground">Personal Access Token</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOAuthFlow(true)}
                  className="gap-2"
                >
                  <KeyRound className="h-3 w-3" />
                  Use OAuth Instead
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Create a token with <code className="px-1 bg-muted rounded">repo</code> scope from{' '}
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=Auto-Build-UI"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info hover:underline"
                >
                  GitHub Settings
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
            <Label className="text-sm font-medium text-foreground">Repository</Label>
            <p className="text-xs text-muted-foreground">
              Format: <code className="px-1 bg-muted rounded">owner/repo</code> (e.g., facebook/react)
            </p>
            <Input
              placeholder="owner/repository"
              value={envConfig.githubRepo || ''}
              onChange={(e) => onUpdateConfig({ githubRepo: e.target.value })}
            />
          </div>

          {/* Connection Status */}
          {envConfig.githubToken && envConfig.githubRepo && (
            <ConnectionStatus
              isChecking={isCheckingGitHub}
              isConnected={gitHubConnectionStatus?.connected || false}
              title="Connection Status"
              successMessage={`Connected to ${gitHubConnectionStatus?.repoFullName}`}
              errorMessage={gitHubConnectionStatus?.error || 'Not connected'}
              additionalInfo={gitHubConnectionStatus?.repoDescription}
            />
          )}

          {/* Fork Repository Info */}
          {gitHubConnectionStatus?.connected && gitHubConnectionStatus?.isFork && gitHubConnectionStatus?.parentRepository && (
            <div className="rounded-lg border border-info/30 bg-info/5 p-3">
              <div className="flex items-start gap-3">
                <GitFork className="h-5 w-5 text-info mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Fork Repository</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This is a fork of{' '}
                    <a
                      href={gitHubConnectionStatus.parentRepository.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-info hover:underline font-medium"
                    >
                      {gitHubConnectionStatus.parentRepository.fullName}
                    </a>
                    . Issues from the parent repository are available.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Warning: Fork detected but parent inaccessible */}
          {gitHubConnectionStatus?.connected && gitHubConnectionStatus?.isFork && !gitHubConnectionStatus?.parentRepository && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Parent Repository Inaccessible</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This repository is a fork, but the parent repository could not be accessed.
                    This may be due to permissions or the parent being private.
                    You can manually specify the parent repository below to enable issue syncing from the upstream repository.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Fork Detection Button */}
          {envConfig.githubToken && envConfig.githubRepo && gitHubConnectionStatus?.connected && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Fork Detection</p>
                  <p className="text-xs text-muted-foreground">
                    Check if this repository is a fork and detect its parent repository
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDetectFork}
                  disabled={isDetectingFork || !projectId}
                  className="gap-2"
                >
                  {isDetectingFork ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Detecting...
                    </>
                  ) : (
                    <>
                      <Search className="h-3 w-3" />
                      Detect Fork
                    </>
                  )}
                </Button>
              </div>
              {forkDetectionError && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">Fork Detection Failed</p>
                    <p className="text-xs mt-1 opacity-90">{forkDetectionError}</p>
                  </div>
                </div>
              )}
              {!gitHubConnectionStatus?.isFork && !isDetectingFork && !forkDetectionError && (
                <p className="text-xs text-muted-foreground">
                  Click &quot;Detect Fork&quot; to check if this is a forked repository.
                </p>
              )}
            </div>
          )}

          {/* Manual Parent Repository Override */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <GitFork className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium text-foreground">Parent Repository Override</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {gitHubConnectionStatus?.isFork
                ? 'Override the auto-detected parent repository, or clear to use the detected value.'
                : 'If your repository is a fork, you can manually specify the parent repository for issue syncing.'}
            </p>
            <Input
              placeholder={
                gitHubConnectionStatus?.parentRepository?.fullName
                  ? `Auto-detected: ${gitHubConnectionStatus.parentRepository.fullName}`
                  : 'owner/repository (e.g., facebook/react)'
              }
              value={envConfig.githubParentRepo || ''}
              onChange={(e) => handleParentRepoChange(e.target.value)}
              className={parentRepoValidationError ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {parentRepoValidationError && (
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-xs">{parentRepoValidationError}</p>
              </div>
            )}
            {envConfig.githubParentRepo && !parentRepoValidationError && (
              <p className="text-xs text-muted-foreground">
                Issues and pull requests will be loaded from{' '}
                <span className="font-medium text-foreground">{envConfig.githubParentRepo}</span>
                {' '}instead of the configured repository.
              </p>
            )}
          </div>

          {/* Info about accessing issues */}
          {gitHubConnectionStatus?.connected && (
            <div className="rounded-lg border border-info/30 bg-info/5 p-3">
              <div className="flex items-start gap-3">
                <Github className="h-5 w-5 text-info mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Issues Available</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Access GitHub Issues from the sidebar to view, investigate, and create tasks from issues.
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
                <Label className="font-normal text-foreground">Auto-Sync on Load</Label>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                Automatically fetch issues when the project loads
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
