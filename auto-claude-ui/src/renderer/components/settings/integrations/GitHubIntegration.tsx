import { Github, RefreshCw, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Separator } from '../../ui/separator';
import type { ProjectEnvConfig, GitHubSyncStatus } from '../../../../shared/types';

interface GitHubIntegrationProps {
  envConfig: ProjectEnvConfig | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;
  showGitHubToken: boolean;
  setShowGitHubToken: React.Dispatch<React.SetStateAction<boolean>>;
  gitHubConnectionStatus: GitHubSyncStatus | null;
  isCheckingGitHub: boolean;
}

/**
 * GitHub integration settings component.
 * Manages GitHub token, repository configuration, and connection status.
 */
export function GitHubIntegration({
  envConfig,
  updateEnvConfig,
  showGitHubToken,
  setShowGitHubToken,
  gitHubConnectionStatus,
  isCheckingGitHub
}: GitHubIntegrationProps) {
  if (!envConfig) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">Enable GitHub Issues</Label>
          <p className="text-xs text-muted-foreground">
            Sync issues from GitHub and create tasks automatically
          </p>
        </div>
        <Switch
          checked={envConfig.githubEnabled}
          onCheckedChange={(checked) => updateEnvConfig({ githubEnabled: checked })}
        />
      </div>

      {envConfig.githubEnabled && (
        <>
          <TokenInput
            value={envConfig.githubToken || ''}
            showToken={showGitHubToken}
            onToggleVisibility={() => setShowGitHubToken(!showGitHubToken)}
            onChange={(value) => updateEnvConfig({ githubToken: value })}
          />

          <RepositoryInput
            value={envConfig.githubRepo || ''}
            onChange={(value) => updateEnvConfig({ githubRepo: value })}
          />

          {envConfig.githubToken && envConfig.githubRepo && (
            <ConnectionStatus
              isChecking={isCheckingGitHub}
              connectionStatus={gitHubConnectionStatus}
            />
          )}

          {gitHubConnectionStatus?.connected && <IssuesAvailableInfo />}

          <Separator />

          <AutoSyncToggle
            enabled={envConfig.githubAutoSync || false}
            onToggle={(checked) => updateEnvConfig({ githubAutoSync: checked })}
          />
        </>
      )}
    </div>
  );
}

interface TokenInputProps {
  value: string;
  showToken: boolean;
  onToggleVisibility: () => void;
  onChange: (value: string) => void;
}

function TokenInput({ value, showToken, onToggleVisibility, onChange }: TokenInputProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">Personal Access Token</Label>
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
      <div className="relative">
        <Input
          type={showToken ? 'text' : 'password'}
          placeholder="ghp_xxxxxxxx or github_pat_xxxxxxxx"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

interface RepositoryInputProps {
  value: string;
  onChange: (value: string) => void;
}

function RepositoryInput({ value, onChange }: RepositoryInputProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">Repository</Label>
      <p className="text-xs text-muted-foreground">
        Format: <code className="px-1 bg-muted rounded">owner/repo</code> (e.g., facebook/react)
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
  connectionStatus: GitHubSyncStatus | null;
}

function ConnectionStatus({ isChecking, connectionStatus }: ConnectionStatusProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Connection Status</p>
          <p className="text-xs text-muted-foreground">
            {isChecking ? 'Checking...' :
              connectionStatus?.connected
                ? `Connected to ${connectionStatus.repoFullName}`
                : connectionStatus?.error || 'Not connected'}
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
  return (
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
  );
}

interface AutoSyncToggleProps {
  enabled: boolean;
  onToggle: (checked: boolean) => void;
}

function AutoSyncToggle({ enabled, onToggle }: AutoSyncToggleProps) {
  return (
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
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}
