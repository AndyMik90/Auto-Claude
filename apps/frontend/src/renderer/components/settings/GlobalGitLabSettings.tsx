/**
 * GlobalGitLabSettings - App-wide GitLab configuration
 *
 * Allows users to configure GitLab settings once for all projects.
 * Projects can still override these defaults if needed.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Eye,
  EyeOff,
  Server,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Info
} from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import type { AppSettings } from '../../../shared/types';

interface GlobalGitLabSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

/**
 * Global GitLab configuration component.
 * Sets default GitLab instance URL and token for all projects.
 */
export function GlobalGitLabSettings({ settings, onSettingsChange }: GlobalGitLabSettingsProps) {
  const { t } = useTranslation('settings');
  const [showToken, setShowToken] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    success: boolean;
    message: string;
    username?: string;
  } | null>(null);

  const instanceUrl = settings.globalGitlabInstanceUrl || '';
  const token = settings.globalGitlabToken || '';

  const handleInstanceUrlChange = (value: string) => {
    onSettingsChange({
      ...settings,
      globalGitlabInstanceUrl: value,
    });
    setConnectionStatus(null);
  };

  const handleTokenChange = (value: string) => {
    onSettingsChange({
      ...settings,
      globalGitlabToken: value,
    });
    setConnectionStatus(null);
  };

  const testConnection = async () => {
    if (!instanceUrl || !token) return;

    setIsTestingConnection(true);
    setConnectionStatus(null);

    try {
      // Normalize URL
      const baseUrl = instanceUrl.replace(/\/$/, '');

      // Use Electron IPC to test connection (avoids CORS issues)
      // The main process can make HTTP requests without CORS restrictions
      const result = await window.electronAPI.testGitLabConnection(baseUrl, token);

      if (result?.success) {
        setConnectionStatus({
          success: true,
          message: 'Connected successfully',
          username: result.data?.username,
        });
      } else {
        // Fallback: try direct fetch (works if CORS is configured on server)
        const response = await fetch(`${baseUrl}/api/v4/user`, {
          headers: {
            'PRIVATE-TOKEN': token,
          },
        });

        if (response.ok) {
          const user = await response.json();
          setConnectionStatus({
            success: true,
            message: 'Connected successfully',
            username: user.username,
          });
        } else if (response.status === 401) {
          setConnectionStatus({
            success: false,
            message: 'Invalid token or token expired',
          });
        } else {
          setConnectionStatus({
            success: false,
            message: result?.error || `Connection failed: ${response.statusText}`,
          });
        }
      }
    } catch (error) {
      setConnectionStatus({
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="rounded-lg border border-info/30 bg-info/5 p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-info mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Global GitLab Configuration
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Configure your GitLab instance URL and token here. These settings will be used as defaults for all projects,
              so you don't need to configure GitLab separately for each project.
            </p>
          </div>
        </div>
      </div>

      {/* Instance URL */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium text-foreground">
            GitLab Instance URL
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Your self-hosted GitLab URL (e.g., https://gitlab.yourcompany.com)
        </p>
        <Input
          placeholder="https://gitlab.yourcompany.com"
          value={instanceUrl}
          onChange={(e) => handleInstanceUrlChange(e.target.value)}
        />
      </div>

      {/* Personal Access Token */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Personal Access Token
        </Label>
        <p className="text-xs text-muted-foreground">
          Create a token with <code className="px-1 bg-muted rounded">api</code> scope from{' '}
          {instanceUrl ? (
            <a
              href={`${instanceUrl.replace(/\/$/, '')}/-/user_settings/personal_access_tokens`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-info hover:underline inline-flex items-center gap-1"
            >
              GitLab Settings
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="text-muted-foreground">GitLab Settings (enter instance URL first)</span>
          )}
        </p>
        <div className="relative">
          <Input
            type={showToken ? 'text' : 'password'}
            placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
            value={token}
            onChange={(e) => handleTokenChange(e.target.value)}
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

      {/* Test Connection Button */}
      {instanceUrl && token && (
        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={testConnection}
            disabled={isTestingConnection}
            className="gap-2"
          >
            {isTestingConnection ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Testing Connection...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>

          {/* Connection Status */}
          {connectionStatus && (
            <div
              className={`rounded-lg border p-3 ${
                connectionStatus.success
                  ? 'border-success/30 bg-success/10'
                  : 'border-destructive/30 bg-destructive/10'
              }`}
            >
              <div className="flex items-center gap-2">
                {connectionStatus.success ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                <div>
                  <p
                    className={`text-sm font-medium ${
                      connectionStatus.success ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {connectionStatus.success ? 'Connection Successful' : 'Connection Failed'}
                  </p>
                  {connectionStatus.username && (
                    <p className="text-xs text-success/80">
                      Authenticated as: {connectionStatus.username}
                    </p>
                  )}
                  {!connectionStatus.success && (
                    <p className="text-xs text-destructive/80">{connectionStatus.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Usage note */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> After saving these settings, go to any project's Settings → GitLab
          to enable GitLab integration. The instance URL and token will be pre-filled from these global settings.
        </p>
      </div>
    </div>
  );
}
