/**
 * GlobalVaultSettings - App-wide Vault (Obsidian) configuration
 *
 * Allows users to configure an external vault for context, learnings, and agents.
 * The vault follows an Obsidian-compatible structure with markdown files.
 */
import { useState, useEffect } from 'react';
import {
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
  BookOpen,
  Brain,
  Users,
  Shield,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import type { AppSettings } from '../../../shared/types';
import type { VaultConnectionResult } from '../../../shared/types/vault';

interface GlobalVaultSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

/**
 * Global Vault configuration component.
 * Configures external vault path and integration options.
 */
export function GlobalVaultSettings({ settings, onSettingsChange }: GlobalVaultSettingsProps) {
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<VaultConnectionResult | null>(null);

  const vaultPath = settings.globalVaultPath || '';
  const vaultEnabled = settings.vaultEnabled ?? false;
  const vaultSyncLearnings = settings.vaultSyncLearnings ?? false;
  const vaultAutoLoad = settings.vaultAutoLoad ?? true;
  const vaultWriteEnabled = settings.vaultWriteEnabled ?? false;

  // Auto-test connection when path changes and is not empty
  useEffect(() => {
    if (vaultPath && vaultPath.length > 3) {
      const timer = setTimeout(() => {
        testConnection();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setConnectionStatus(null);
    }
  }, [vaultPath]);

  const handlePathChange = (value: string) => {
    onSettingsChange({
      ...settings,
      globalVaultPath: value,
    });
    setConnectionStatus(null);
  };

  const handleEnabledChange = (enabled: boolean) => {
    onSettingsChange({
      ...settings,
      vaultEnabled: enabled,
    });
  };

  const handleSyncLearningsChange = (enabled: boolean) => {
    onSettingsChange({
      ...settings,
      vaultSyncLearnings: enabled,
    });
  };

  const handleAutoLoadChange = (enabled: boolean) => {
    onSettingsChange({
      ...settings,
      vaultAutoLoad: enabled,
    });
  };

  const handleWriteEnabledChange = (enabled: boolean) => {
    onSettingsChange({
      ...settings,
      vaultWriteEnabled: enabled,
    });
  };

  const testConnection = async () => {
    if (!vaultPath) return;

    setIsTestingConnection(true);
    setConnectionStatus(null);

    try {
      const result = await window.electronAPI.testVaultConnection(vaultPath);
      if (result.success && result.data) {
        setConnectionStatus(result.data);
      } else {
        setConnectionStatus({
          success: false,
          error: result.error || 'Connection failed',
        });
      }
    } catch (error) {
      setConnectionStatus({
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleBrowse = async () => {
    const path = await window.electronAPI.selectDirectory();
    if (path) {
      handlePathChange(path);
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
              External Vault Integration
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Connect an Obsidian-compatible vault for context, learnings, and agent definitions.
              The vault can contain a CLAUDE.md file for session context, preferences, and accumulated knowledge.
            </p>
          </div>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Enable Vault Integration</Label>
          <p className="text-xs text-muted-foreground">
            Allow access to external vault for context and learnings
          </p>
        </div>
        <Switch
          checked={vaultEnabled}
          onCheckedChange={handleEnabledChange}
        />
      </div>

      {/* Vault Path */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium text-foreground">
            Vault Path
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Path to your vault directory (e.g., ~/vaults/my-vault or /Users/name/vaults/work)
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="~/vaults/my-vault"
            value={vaultPath}
            onChange={(e) => handlePathChange(e.target.value)}
            className="flex-1"
          />
          <Button
            variant="outline"
            onClick={handleBrowse}
            className="shrink-0"
          >
            Browse
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      {(isTestingConnection || connectionStatus) && (
        <div
          className={`rounded-lg border p-4 ${
            isTestingConnection
              ? 'border-border bg-muted/30'
              : connectionStatus?.success
              ? 'border-success/30 bg-success/10'
              : 'border-destructive/30 bg-destructive/10'
          }`}
        >
          {isTestingConnection ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Testing connection...</span>
            </div>
          ) : connectionStatus?.success ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm font-medium text-success">Vault Connected</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {connectionStatus.hasClaudeMd && (
                  <span className="inline-flex items-center gap-1 text-xs bg-success/20 text-success px-2 py-0.5 rounded">
                    <BookOpen className="h-3 w-3" />
                    CLAUDE.md
                  </span>
                )}
                {connectionStatus.hasMemoryDir && (
                  <span className="inline-flex items-center gap-1 text-xs bg-success/20 text-success px-2 py-0.5 rounded">
                    <Brain className="h-3 w-3" />
                    Memory
                  </span>
                )}
                {connectionStatus.hasAgentsDir && (
                  <span className="inline-flex items-center gap-1 text-xs bg-success/20 text-success px-2 py-0.5 rounded">
                    <Users className="h-3 w-3" />
                    Agents
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">Connection Failed</p>
                <p className="text-xs text-destructive/80">{connectionStatus?.error}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Test Button */}
      {vaultPath && !isTestingConnection && (
        <Button
          variant="outline"
          onClick={testConnection}
          className="gap-2"
          size="sm"
        >
          <RefreshCw className="h-4 w-4" />
          Test Connection
        </Button>
      )}

      {/* Additional Options (only show when vault is configured) */}
      {vaultPath && connectionStatus?.success && (
        <div className="space-y-4 pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-foreground">Vault Options</h4>

          {/* Auto-load Context */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Auto-load Context</Label>
              <p className="text-xs text-muted-foreground">
                Load CLAUDE.md and preferences automatically on session start
              </p>
            </div>
            <Switch
              checked={vaultAutoLoad}
              onCheckedChange={handleAutoLoadChange}
            />
          </div>

          {/* Sync Learnings */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Sync Learnings</Label>
              <p className="text-xs text-muted-foreground">
                Save learnings to vault (memory/learnings/)
              </p>
            </div>
            <Switch
              checked={vaultSyncLearnings}
              onCheckedChange={handleSyncLearningsChange}
              disabled={!vaultWriteEnabled}
            />
          </div>

          {/* Write Access Warning */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Enable Write Access
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow writing to memory/learnings/, memory/auto-claude/, and sessions/
                </p>
              </div>
              <Switch
                checked={vaultWriteEnabled}
                onCheckedChange={handleWriteEnabledChange}
              />
            </div>

            {vaultWriteEnabled && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <p className="text-xs text-warning">
                    Write access is enabled. Auto-Claude can create and modify files in specific vault directories.
                    Writes are restricted to: memory/learnings/, memory/auto-claude/, sessions/
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vault Structure Info */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-medium text-foreground">Expected Vault Structure:</p>
        <pre className="text-xs text-muted-foreground font-mono">
{`your-vault/
├── .claude/
│   └── CLAUDE.md           # Session context (auto-loaded)
├── memory/
│   ├── context/
│   │   └── preferences.md  # User preferences
│   └── learnings/
│       └── *.md            # Accumulated knowledge
├── agents/                  # Agent definitions
│   └── *.md
└── sessions/                # Session logs (if write enabled)`}
        </pre>
      </div>
    </div>
  );
}
