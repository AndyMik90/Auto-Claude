import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { SettingsSection } from './SettingsSection';
import { Badge } from '../ui/badge';
import { AlertCircle, CheckCircle2, TrendingUp, Activity } from 'lucide-react';
import type { RecoveryConfig, RecoveryStats } from '../../../main/task-recovery-service';

interface RecoverySettingsProps {
  // No settings prop needed - we manage recovery config separately via IPC
}

/**
 * Task Recovery settings component
 * Displays auto-recovery stats and allows configuration
 */
export function RecoverySettings({}: RecoverySettingsProps) {
  const { t } = useTranslation('settings');
  const [config, setConfig] = useState<RecoveryConfig | null>(null);
  const [stats, setStats] = useState<RecoveryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load config and stats on mount
  useEffect(() => {
    loadRecoveryData();
  }, []);

  const loadRecoveryData = async () => {
    setIsLoading(true);
    try {
      const [configRes, statsRes] = await Promise.all([
        window.electronAPI.getRecoveryConfig(),
        window.electronAPI.getRecoveryStats()
      ]);

      if (configRes.success && configRes.data) {
        setConfig(configRes.data);
      }

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (error) {
      console.error('[RecoverySettings] Failed to load recovery data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateConfig = async (updates: Partial<RecoveryConfig>) => {
    if (!config) return;

    setIsSaving(true);
    try {
      const result = await window.electronAPI.updateRecoveryConfig(updates);
      if (result.success && result.data) {
        setConfig(result.data);
      }
    } catch (error) {
      console.error('[RecoverySettings] Failed to update config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !config || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading recovery settings...</div>
      </div>
    );
  }

  const successRate = stats.totalAttempts > 0
    ? Math.round((stats.successfulRecoveries / stats.totalAttempts) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Statistics Section */}
      <SettingsSection
        title="Recovery Statistics"
        description="Real-time statistics about automatic task recovery"
      >
        <div className="grid grid-cols-2 gap-4">
          {/* Total Attempts */}
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Total Attempts</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalAttempts}</div>
          </div>

          {/* Success Rate */}
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Success Rate</span>
            </div>
            <div className="text-2xl font-bold">{successRate}%</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.successfulRecoveries} / {stats.totalAttempts} recovered
            </div>
          </div>

          {/* Currently Stuck */}
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Currently Stuck</span>
            </div>
            <div className="text-2xl font-bold">{stats.tasksCurrentlyStuck}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.tasksCurrentlyStuck === 0 ? 'All tasks healthy' : 'Pending recovery'}
            </div>
          </div>

          {/* Failed Recoveries */}
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium">Failed Recoveries</span>
            </div>
            <div className="text-2xl font-bold">{stats.failedRecoveries}</div>
            <div className="text-xs text-muted-foreground mt-1">
              May need manual intervention
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Configuration Section */}
      <SettingsSection
        title="Auto-Recovery Configuration"
        description="Configure automatic recovery behavior for stuck tasks"
      >
        <div className="space-y-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Auto-Recovery</Label>
              <div className="text-sm text-muted-foreground">
                Automatically detect and recover stuck tasks
              </div>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => updateConfig({ enabled: checked })}
              disabled={isSaving}
            />
          </div>

          {/* Cooldown Period */}
          <div className="space-y-2">
            <Label>Cooldown Period (minutes)</Label>
            <div className="text-sm text-muted-foreground mb-2">
              Time to wait before considering a task stuck
            </div>
            <Input
              type="number"
              min="1"
              max="60"
              value={Math.floor(config.cooldownPeriodMs / 60000)}
              onChange={(e) => {
                const minutes = parseInt(e.target.value) || 5;
                updateConfig({ cooldownPeriodMs: minutes * 60000 });
              }}
              disabled={isSaving || !config.enabled}
              className="w-32"
            />
          </div>

          {/* Max Recovery Attempts */}
          <div className="space-y-2">
            <Label>Max Recovery Attempts</Label>
            <div className="text-sm text-muted-foreground mb-2">
              Maximum retry attempts per task before giving up
            </div>
            <Input
              type="number"
              min="1"
              max="10"
              value={config.maxRecoveryAttempts}
              onChange={(e) => {
                const attempts = parseInt(e.target.value) || 3;
                updateConfig({ maxRecoveryAttempts: attempts });
              }}
              disabled={isSaving || !config.enabled}
              className="w-32"
            />
          </div>

          {/* Scan Interval */}
          <div className="space-y-2">
            <Label>Scan Interval (seconds)</Label>
            <div className="text-sm text-muted-foreground mb-2">
              How often to check for stuck tasks
            </div>
            <Input
              type="number"
              min="30"
              max="300"
              value={Math.floor(config.scanIntervalMs / 1000)}
              onChange={(e) => {
                const seconds = parseInt(e.target.value) || 60;
                updateConfig({ scanIntervalMs: seconds * 1000 });
              }}
              disabled={isSaving || !config.enabled}
              className="w-32"
            />
          </div>

          {/* Status Badge */}
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2">
              {config.enabled ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
                    Auto-Recovery Active
                  </Badge>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
                    Auto-Recovery Disabled
                  </Badge>
                </>
              )}
            </div>
            {config.enabled && (
              <div className="text-xs text-muted-foreground mt-2">
                Tasks stuck for more than {Math.floor(config.cooldownPeriodMs / 60000)} minutes will be automatically recovered
              </div>
            )}
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
