import { useState, useEffect } from 'react';
import { Settings, Save, Loader2, Palette, Bot, FolderOpen, Key, Package, Bell } from 'lucide-react';
import {
  FullScreenDialog,
  FullScreenDialogContent,
  FullScreenDialogHeader,
  FullScreenDialogBody,
  FullScreenDialogFooter,
  FullScreenDialogTitle,
  FullScreenDialogDescription
} from '../ui/full-screen-dialog';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';
import { useSettings } from './hooks/useSettings';
import { ThemeSettings } from './ThemeSettings';
import { GeneralSettings } from './GeneralSettings';
import { IntegrationSettings } from './IntegrationSettings';
import { AdvancedSettings } from './AdvancedSettings';

interface AppSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsSection = 'appearance' | 'agent' | 'paths' | 'integrations' | 'updates' | 'notifications';

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
  description: string;
}

const navItems: NavItem[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme and visual preferences' },
  { id: 'agent', label: 'Agent Settings', icon: Bot, description: 'Default model and framework' },
  { id: 'paths', label: 'Paths', icon: FolderOpen, description: 'Python and framework paths' },
  { id: 'integrations', label: 'Integrations', icon: Key, description: 'API keys & Claude accounts' },
  { id: 'updates', label: 'Updates', icon: Package, description: 'Auto Claude updates' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Alert preferences' }
];

/**
 * Main application settings dialog container
 * Coordinates different settings sections and manages state
 */
export function AppSettingsDialog({ open, onOpenChange }: AppSettingsDialogProps) {
  const { settings, setSettings, isSaving, error, saveSettings } = useSettings();
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');
  const [version, setVersion] = useState<string>('');

  // Load app version on mount
  useEffect(() => {
    window.electronAPI.getAppVersion().then(setVersion);
  }, []);

  const handleSave = async () => {
    const success = await saveSettings();
    if (success) {
      onOpenChange(false);
    }
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'appearance':
        return <ThemeSettings settings={settings} onSettingsChange={setSettings} />;

      case 'agent':
        return <GeneralSettings settings={settings} onSettingsChange={setSettings} section="agent" />;

      case 'paths':
        return <GeneralSettings settings={settings} onSettingsChange={setSettings} section="paths" />;

      case 'integrations':
        return <IntegrationSettings settings={settings} onSettingsChange={setSettings} isOpen={open} />;

      case 'updates':
        return <AdvancedSettings settings={settings} onSettingsChange={setSettings} section="updates" version={version} />;

      case 'notifications':
        return <AdvancedSettings settings={settings} onSettingsChange={setSettings} section="notifications" version={version} />;

      default:
        return null;
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
