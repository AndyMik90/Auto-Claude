import { useState, useEffect } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  CloudDownload,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Progress } from '../ui/progress';
import { cn } from '../../lib/utils';
import { SettingsSection } from './SettingsSection';
import type { AppSettings, AutoBuildSourceUpdateCheck, AutoBuildSourceUpdateProgress } from '../../../shared/types';

interface AdvancedSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  section: 'updates' | 'notifications';
  version: string;
}

/**
 * Advanced settings for updates and notifications
 */
export function AdvancedSettings({ settings, onSettingsChange, section, version }: AdvancedSettingsProps) {
  // Auto Claude source update state
  const [sourceUpdateCheck, setSourceUpdateCheck] = useState<AutoBuildSourceUpdateCheck | null>(null);
  const [isCheckingSourceUpdate, setIsCheckingSourceUpdate] = useState(false);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<AutoBuildSourceUpdateProgress | null>(null);

  // Check for updates on mount
  useEffect(() => {
    if (section === 'updates') {
      checkForSourceUpdates();
    }
  }, [section]);

  // Listen for download progress
  useEffect(() => {
    const cleanup = window.electronAPI.onAutoBuildSourceUpdateProgress((progress) => {
      setDownloadProgress(progress);
      if (progress.stage === 'complete') {
        setIsDownloadingUpdate(false);
        checkForSourceUpdates();
      } else if (progress.stage === 'error') {
        setIsDownloadingUpdate(false);
      }
    });

    return cleanup;
  }, []);

  const checkForSourceUpdates = async () => {
    setIsCheckingSourceUpdate(true);
    try {
      const result = await window.electronAPI.checkAutoBuildSourceUpdate();
      if (result.success && result.data) {
        setSourceUpdateCheck(result.data);
      }
    } catch (err) {
      console.error('Failed to check for source updates:', err);
    } finally {
      setIsCheckingSourceUpdate(false);
    }
  };

  const handleDownloadSourceUpdate = () => {
    setIsDownloadingUpdate(true);
    setDownloadProgress(null);
    window.electronAPI.downloadAutoBuildSourceUpdate();
  };

  if (section === 'updates') {
    return (
      <SettingsSection
        title="Updates"
        description="Manage Auto Claude updates"
      >
        <div className="space-y-6">
          {/* Unified Version Display with Update Check */}
          <div className="rounded-lg border border-border bg-muted/50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Version</p>
                <p className="text-base font-medium text-foreground">
                  {version || 'Loading...'}
                </p>
              </div>
              {isCheckingSourceUpdate ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : sourceUpdateCheck?.updateAvailable ? (
                <AlertCircle className="h-6 w-6 text-info" />
              ) : (
                <CheckCircle2 className="h-6 w-6 text-success" />
              )}
            </div>

            {/* Update status */}
            {isCheckingSourceUpdate ? (
              <p className="text-sm text-muted-foreground">
                Checking for updates...
              </p>
            ) : sourceUpdateCheck ? (
              <>
                {sourceUpdateCheck.latestVersion && sourceUpdateCheck.updateAvailable && (
                  <p className="text-sm text-info">
                    New version available: {sourceUpdateCheck.latestVersion}
                  </p>
                )}

                {sourceUpdateCheck.error && (
                  <p className="text-sm text-destructive">{sourceUpdateCheck.error}</p>
                )}

                {!sourceUpdateCheck.updateAvailable && !sourceUpdateCheck.error && (
                  <p className="text-sm text-muted-foreground">
                    You&apos;re running the latest version.
                  </p>
                )}

                {sourceUpdateCheck.updateAvailable && (
                  <div className="space-y-4 pt-2">
                    {sourceUpdateCheck.releaseNotes && (
                      <div className="text-sm text-muted-foreground bg-background rounded-lg p-3 max-h-32 overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-sans">
                          {sourceUpdateCheck.releaseNotes}
                        </pre>
                      </div>
                    )}

                    {isDownloadingUpdate ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>{downloadProgress?.message || 'Downloading...'}</span>
                        </div>
                        {downloadProgress?.percent !== undefined && (
                          <Progress value={downloadProgress.percent} className="h-2" />
                        )}
                      </div>
                    ) : downloadProgress?.stage === 'complete' ? (
                      <div className="flex items-center gap-3 text-sm text-success">
                        <CheckCircle2 className="h-5 w-5" />
                        <span>{downloadProgress.message}</span>
                      </div>
                    ) : downloadProgress?.stage === 'error' ? (
                      <div className="flex items-center gap-3 text-sm text-destructive">
                        <AlertCircle className="h-5 w-5" />
                        <span>{downloadProgress.message}</span>
                      </div>
                    ) : (
                      <Button onClick={handleDownloadSourceUpdate}>
                        <CloudDownload className="mr-2 h-4 w-4" />
                        Download Update
                      </Button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Unable to check for updates
              </p>
            )}

            <div className="pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={checkForSourceUpdates}
                disabled={isCheckingSourceUpdate}
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', isCheckingSourceUpdate && 'animate-spin')} />
                Check for Updates
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-border">
            <div className="space-y-1">
              <Label className="font-medium text-foreground">Auto-Update Projects</Label>
              <p className="text-sm text-muted-foreground">
                Automatically update Auto Claude in projects when a new version is available
              </p>
            </div>
            <Switch
              checked={settings.autoUpdateAutoBuild}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, autoUpdateAutoBuild: checked })
              }
            />
          </div>
        </div>
      </SettingsSection>
    );
  }

  // notifications section
  return (
    <SettingsSection
      title="Notifications"
      description="Configure default notification preferences"
    >
      <div className="space-y-4">
        {[
          { key: 'onTaskComplete', label: 'On Task Complete', description: 'Notify when a task finishes successfully' },
          { key: 'onTaskFailed', label: 'On Task Failed', description: 'Notify when a task encounters an error' },
          { key: 'onReviewNeeded', label: 'On Review Needed', description: 'Notify when QA requires your review' },
          { key: 'sound', label: 'Sound', description: 'Play sound with notifications' }
        ].map((item) => (
          <div key={item.key} className="flex items-center justify-between p-4 rounded-lg border border-border">
            <div className="space-y-1">
              <Label className="font-medium text-foreground">{item.label}</Label>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
            <Switch
              checked={settings.notifications[item.key as keyof typeof settings.notifications]}
              onCheckedChange={(checked) =>
                onSettingsChange({
                  ...settings,
                  notifications: {
                    ...settings.notifications,
                    [item.key]: checked
                  }
                })
              }
            />
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}
