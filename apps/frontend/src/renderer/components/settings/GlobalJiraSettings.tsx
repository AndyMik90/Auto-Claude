/**
 * GlobalJiraSettings - App-wide JIRA configuration
 *
 * Allows users to configure JIRA settings once for all projects.
 * Projects can still override these defaults if needed.
 */
import { useState } from 'react';
import {
  Eye,
  EyeOff,
  Server,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Info,
  Mail,
  ListTodo
} from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import type { AppSettings } from '../../../shared/types';

interface GlobalJiraSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

/**
 * Global JIRA configuration component.
 * Sets default JIRA instance, credentials, and project for all projects.
 */
export function GlobalJiraSettings({ settings, onSettingsChange }: GlobalJiraSettingsProps) {
  const [showToken, setShowToken] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    success: boolean;
    message: string;
    displayName?: string;
  } | null>(null);

  const host = settings.globalJiraHost || '';
  const email = settings.globalJiraEmail || '';
  const token = settings.globalJiraToken || '';
  const defaultProject = settings.globalJiraDefaultProject || '';
  const issueTrackerProvider = settings.issueTrackerProvider || '';

  const handleIssueTrackerChange = (value: string) => {
    onSettingsChange({
      ...settings,
      // Empty string means auto-detect (undefined in settings)
      issueTrackerProvider: value === '' ? undefined : value as 'gitlab' | 'jira' | 'github' | 'linear',
    });
  };

  const handleHostChange = (value: string) => {
    onSettingsChange({
      ...settings,
      globalJiraHost: value,
    });
    setConnectionStatus(null);
  };

  const handleEmailChange = (value: string) => {
    onSettingsChange({
      ...settings,
      globalJiraEmail: value,
    });
    setConnectionStatus(null);
  };

  const handleTokenChange = (value: string) => {
    onSettingsChange({
      ...settings,
      globalJiraToken: value,
    });
    setConnectionStatus(null);
  };

  const handleDefaultProjectChange = (value: string) => {
    onSettingsChange({
      ...settings,
      globalJiraDefaultProject: value.toUpperCase(),
    });
  };

  const testConnection = async () => {
    if (!host || !email || !token) return;

    setIsTestingConnection(true);
    setConnectionStatus(null);

    try {
      // Use IPC to test connection (avoids CORS issues)
      const result = await window.electronAPI.testJiraConnection(host, email, token);
      if (result.success && result.data) {
        setConnectionStatus({
          success: true,
          message: 'Connected successfully',
          displayName: result.data.displayName,
        });
      } else {
        setConnectionStatus({
          success: false,
          message: result.error || 'Connection failed',
        });
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
      {/* Issue Tracker Provider Selection */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium text-foreground">
            Issue Tracker Provider
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Select where you manage your issues. This controls which issue tracking features are shown in the sidebar.
        </p>
        <Select value={issueTrackerProvider || 'auto'} onValueChange={(v) => handleIssueTrackerChange(v === 'auto' ? '' : v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Auto-detect (based on configured integrations)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto-detect (based on configured integrations)</SelectItem>
            <SelectItem value="jira">JIRA</SelectItem>
            <SelectItem value="gitlab">GitLab</SelectItem>
            <SelectItem value="github">GitHub</SelectItem>
            <SelectItem value="linear">Linear</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          When set to JIRA, GitLab Issues and Merge Requests sidebar items will be hidden (GitLab code management remains available).
        </p>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-info/30 bg-info/5 p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-info mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Global JIRA Configuration
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Configure your JIRA instance and credentials here. These settings will be used as defaults for all projects.
              This integrates with your existing JIRA setup for issue tracking.
            </p>
          </div>
        </div>
      </div>

      {/* JIRA Host URL */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium text-foreground">
            JIRA Instance URL
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Your JIRA Cloud or Server URL (e.g., https://company.atlassian.net)
        </p>
        <Input
          placeholder="https://company.atlassian.net"
          value={host}
          onChange={(e) => handleHostChange(e.target.value)}
        />
      </div>

      {/* Email */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium text-foreground">
            Email Address
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          The email address associated with your JIRA account
        </p>
        <Input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => handleEmailChange(e.target.value)}
        />
      </div>

      {/* API Token */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          API Token
        </Label>
        <p className="text-xs text-muted-foreground">
          Create an API token from{' '}
          <a
            href="https://id.atlassian.com/manage-profile/security/api-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-info hover:underline inline-flex items-center gap-1"
          >
            Atlassian Account Settings
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
        <div className="relative">
          <Input
            type={showToken ? 'text' : 'password'}
            placeholder="ATATT3xFfGF0..."
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

      {/* Default Project */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Default Project Key (Optional)
        </Label>
        <p className="text-xs text-muted-foreground">
          The default JIRA project key for creating issues (e.g., CAP, PROJ)
        </p>
        <Input
          placeholder="CAP"
          value={defaultProject}
          onChange={(e) => handleDefaultProjectChange(e.target.value)}
          className="uppercase"
        />
      </div>

      {/* Test Connection Button */}
      {host && email && token && (
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
                  {connectionStatus.displayName && (
                    <p className="text-xs text-success/80">
                      Authenticated as: {connectionStatus.displayName}
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
          <strong>Note:</strong> JIRA integration allows you to create, view, and update issues directly from Auto-Claude.
          If you use GitLab for code but JIRA for issue tracking, configure both integrations.
        </p>
      </div>
    </div>
  );
}
