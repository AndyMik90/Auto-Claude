import { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Loader2,
  Moon,
  Sun,
  Monitor,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  CloudDownload,
  Key,
  Eye,
  EyeOff,
  Info,
  Palette,
  Bot,
  FolderOpen,
  Bell,
  Package
} from 'lucide-react';
import {
  FullScreenDialog,
  FullScreenDialogContent,
  FullScreenDialogHeader,
  FullScreenDialogBody,
  FullScreenDialogFooter,
  FullScreenDialogTitle,
  FullScreenDialogDescription
} from './ui/full-screen-dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { ScrollArea } from './ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import { Separator } from './ui/separator';
import { cn } from '../lib/utils';
import { useSettingsStore, saveSettings, loadSettings } from '../stores/settings-store';
import { AVAILABLE_MODELS } from '../../shared/constants';
import type {
  AppSettings as AppSettingsType,
  AutoBuildSourceUpdateCheck,
  AutoBuildSourceUpdateProgress
} from '../../shared/types';
import { Progress } from './ui/progress';

interface AppSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsSection = 'appearance' | 'agent' | 'paths' | 'api-keys' | 'framework' | 'notifications';

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
  description: string;
}

const navItems: NavItem[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme and visual preferences' },
  { id: 'agent', label: 'Agent Settings', icon: Bot, description: 'Default model and parallelism' },
  { id: 'paths', label: 'Paths', icon: FolderOpen, description: 'Python and framework paths' },
  { id: 'api-keys', label: 'API Keys', icon: Key, description: 'Global API credentials' },
  { id: 'framework', label: 'Framework', icon: Package, description: 'Auto Claude updates' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Alert preferences' }
];

export function AppSettingsDialog({ open, onOpenChange }: AppSettingsDialogProps) {
  const currentSettings = useSettingsStore((state) => state.settings);
  const [settings, setSettings] = useState<AppSettingsType>(currentSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<string>('');
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');

  // Auto Claude source update state
  const [sourceUpdateCheck, setSourceUpdateCheck] = useState<AutoBuildSourceUpdateCheck | null>(null);
  const [isCheckingSourceUpdate, setIsCheckingSourceUpdate] = useState(false);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<AutoBuildSourceUpdateProgress | null>(null);

  // Password visibility toggles for global API keys
  const [showGlobalClaudeToken, setShowGlobalClaudeToken] = useState(false);
  const [showGlobalOpenAIKey, setShowGlobalOpenAIKey] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    window.electronAPI.getAppVersion().then(setVersion);

    // Check for auto-claude source updates
    checkForSourceUpdates();
  }, []);

  // Listen for download progress
  useEffect(() => {
    const cleanup = window.electronAPI.onAutoBuildSourceUpdateProgress((progress) => {
      setDownloadProgress(progress);
      if (progress.stage === 'complete') {
        setIsDownloadingUpdate(false);
        // Refresh the update check
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

  // Sync with store
  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const success = await saveSettings(settings);
      if (success) {
        // Apply theme immediately
        applyTheme(settings.theme);
        onOpenChange(false);
      } else {
        setError('Failed to save settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  };

  const applyTheme = (theme: 'light' | 'dark' | 'system') => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // System preference
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const getThemeIcon = (theme: string) => {
    switch (theme) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'appearance':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Appearance</h3>
              <p className="text-sm text-muted-foreground">Customize how Auto Claude looks</p>
            </div>
            <Separator />
            <div className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="theme" className="text-sm font-medium text-foreground">Theme</Label>
                <p className="text-sm text-muted-foreground">Choose your preferred color scheme</p>
                <div className="grid grid-cols-3 gap-3">
                  {(['system', 'light', 'dark'] as const).map((theme) => (
                    <button
                      key={theme}
                      onClick={() => setSettings({ ...settings, theme })}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                        settings.theme === theme
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-accent/50'
                      )}
                    >
                      {getThemeIcon(theme)}
                      <span className="text-sm font-medium capitalize">{theme}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'agent':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Default Agent Settings</h3>
              <p className="text-sm text-muted-foreground">Configure defaults for new projects</p>
            </div>
            <Separator />
            <div className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="defaultModel" className="text-sm font-medium text-foreground">Default Model</Label>
                <p className="text-sm text-muted-foreground">The AI model used for agent tasks</p>
                <Select
                  value={settings.defaultModel}
                  onValueChange={(value) => setSettings({ ...settings, defaultModel: value })}
                >
                  <SelectTrigger id="defaultModel" className="w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_MODELS.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="defaultParallelism" className="text-sm font-medium text-foreground">Default Parallelism</Label>
                <p className="text-sm text-muted-foreground">Number of concurrent agent workers (1-8)</p>
                <Input
                  id="defaultParallelism"
                  type="number"
                  min={1}
                  max={8}
                  className="w-full max-w-md"
                  value={settings.defaultParallelism}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      defaultParallelism: parseInt(e.target.value) || 1
                    })
                  }
                />
              </div>
            </div>
          </div>
        );

      case 'paths':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Paths</h3>
              <p className="text-sm text-muted-foreground">Configure executable and framework paths</p>
            </div>
            <Separator />
            <div className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="pythonPath" className="text-sm font-medium text-foreground">Python Path</Label>
                <p className="text-sm text-muted-foreground">Path to Python executable (leave empty for default)</p>
                <Input
                  id="pythonPath"
                  placeholder="python3 (default)"
                  className="w-full max-w-lg"
                  value={settings.pythonPath || ''}
                  onChange={(e) => setSettings({ ...settings, pythonPath: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="autoBuildPath" className="text-sm font-medium text-foreground">Auto Claude Path</Label>
                <p className="text-sm text-muted-foreground">Relative path to auto-claude directory in projects</p>
                <Input
                  id="autoBuildPath"
                  placeholder="auto-claude (default)"
                  className="w-full max-w-lg"
                  value={settings.autoBuildPath || ''}
                  onChange={(e) => setSettings({ ...settings, autoBuildPath: e.target.value })}
                />
              </div>
            </div>
          </div>
        );

      case 'api-keys':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Global API Keys</h3>
              <p className="text-sm text-muted-foreground">Set API keys to use across all projects</p>
            </div>
            <Separator />
            <div className="rounded-lg bg-info/10 border border-info/30 p-4 mb-6">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  Keys set here will be used as defaults. Individual projects can override these in their settings.
                </p>
              </div>
            </div>
            <div className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="globalClaudeToken" className="text-sm font-medium text-foreground">
                  Claude OAuth Token
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get your token by running <code className="px-1.5 py-0.5 bg-muted rounded font-mono text-xs">claude setup-token</code>
                </p>
                <div className="relative max-w-lg">
                  <Input
                    id="globalClaudeToken"
                    type={showGlobalClaudeToken ? 'text' : 'password'}
                    placeholder="Enter your Claude OAuth token..."
                    value={settings.globalClaudeOAuthToken || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, globalClaudeOAuthToken: e.target.value || undefined })
                    }
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGlobalClaudeToken(!showGlobalClaudeToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showGlobalClaudeToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="globalOpenAIKey" className="text-sm font-medium text-foreground">
                  OpenAI API Key
                </Label>
                <p className="text-sm text-muted-foreground">
                  Required for Graphiti memory backend (embeddings)
                </p>
                <div className="relative max-w-lg">
                  <Input
                    id="globalOpenAIKey"
                    type={showGlobalOpenAIKey ? 'text' : 'password'}
                    placeholder="sk-..."
                    value={settings.globalOpenAIApiKey || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, globalOpenAIApiKey: e.target.value || undefined })
                    }
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGlobalOpenAIKey(!showGlobalOpenAIKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showGlobalOpenAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'framework':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Auto Claude Framework</h3>
              <p className="text-sm text-muted-foreground">Manage framework updates and settings</p>
            </div>
            <Separator />
            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-muted/50 p-5 space-y-4">
                {isCheckingSourceUpdate ? (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Checking for updates...
                  </div>
                ) : sourceUpdateCheck ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-base font-medium text-foreground">
                          Version {sourceUpdateCheck.currentVersion}
                        </p>
                        {sourceUpdateCheck.latestVersion && sourceUpdateCheck.updateAvailable && (
                          <p className="text-sm text-info mt-1">
                            New version available: {sourceUpdateCheck.latestVersion}
                          </p>
                        )}
                      </div>
                      {sourceUpdateCheck.updateAvailable ? (
                        <AlertCircle className="h-6 w-6 text-info" />
                      ) : (
                        <CheckCircle2 className="h-6 w-6 text-success" />
                      )}
                    </div>

                    {sourceUpdateCheck.error && (
                      <p className="text-sm text-destructive">{sourceUpdateCheck.error}</p>
                    )}

                    {!sourceUpdateCheck.updateAvailable && !sourceUpdateCheck.error && (
                      <p className="text-sm text-muted-foreground">
                        You're running the latest version of the Auto Claude framework.
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
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <AlertCircle className="h-5 w-5" />
                    Unable to check for updates
                  </div>
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
                    setSettings({ ...settings, autoUpdateAutoBuild: checked })
                  }
                />
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Notifications</h3>
              <p className="text-sm text-muted-foreground">Configure default notification preferences</p>
            </div>
            <Separator />
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
                      setSettings({
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
          </div>
        );
    }
  };

  return (
    <FullScreenDialog open={open} onOpenChange={onOpenChange}>
      <FullScreenDialogContent>
        <FullScreenDialogHeader>
          <FullScreenDialogTitle className="flex items-center gap-3">
            <Settings className="h-6 w-6" />
            Settings
          </FullScreenDialogTitle>
          <FullScreenDialogDescription>
            Configure application-wide settings and preferences
          </FullScreenDialogDescription>
        </FullScreenDialogHeader>

        <FullScreenDialogBody>
          <div className="flex h-full">
            {/* Navigation sidebar */}
            <nav className="w-64 border-r border-border bg-muted/30 p-4">
              <ScrollArea className="h-full">
                <div className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={cn(
                          'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all',
                          activeSection === item.id
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-sm">{item.label}</div>
                          <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Version at bottom */}
                {version && (
                  <div className="mt-8 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center">
                      Version {version}
                    </p>
                  </div>
                )}
              </ScrollArea>
            </nav>

            {/* Main content */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-8 max-w-2xl">
                  {renderSection()}
                </div>
              </ScrollArea>
            </div>
          </div>
        </FullScreenDialogBody>

        <FullScreenDialogFooter>
          {error && (
            <div className="flex-1 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </FullScreenDialogFooter>
      </FullScreenDialogContent>
    </FullScreenDialog>
  );
}
