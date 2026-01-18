import { Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SettingsSection } from '../SettingsSection';
import { useTerminalFontSettingsStore } from '../../../stores/terminal-font-settings-store';

// Child components will be imported here
// TODO: Import child components once created
// import { FontConfigPanel } from './FontConfigPanel';
// import { CursorConfigPanel } from './CursorConfigPanel';
// import { PerformanceConfigPanel } from './PerformanceConfigPanel';
// import { PresetsPanel } from './PresetsPanel';
// import { LivePreviewTerminal } from './LivePreviewTerminal';

/**
 * Terminal font settings main container component
 * Orchestrates all terminal font customization panels:
 * - Font configuration (family, size, weight, line height, letter spacing)
 * - Cursor configuration (style, blink, accent color)
 * - Performance settings (scrollback limit)
 * - Quick presets (VS Code, IntelliJ, macOS, Ubuntu)
 * - Live preview terminal (real-time updates, 300ms debounced)
 *
 * All settings persist via localStorage through the Zustand store
 * Changes apply immediately to all active terminal instances
 */
export function TerminalFontSettings() {
  const { t } = useTranslation('settings');

  // Get current settings from store (triggers re-render on changes)
  const settings = useTerminalFontSettingsStore();

  // Get action methods from store
  const updateSettings = useTerminalFontSettingsStore((state) => state.applySettings);
  const resetToDefaults = useTerminalFontSettingsStore((state) => state.resetToDefaults);
  const applyPreset = useTerminalFontSettingsStore((state) => state.applyPreset);
  const exportSettings = useTerminalFontSettingsStore((state) => state.exportSettings);
  const importSettings = useTerminalFontSettingsStore((state) => state.importSettings);

  /**
   * Handle individual setting updates
   * This wrapper ensures type safety and could add validation/logging in future
   */
  const handleSettingChange = <K extends keyof typeof settings>(
    key: K,
    value: typeof settings[K]
  ) => {
    updateSettings({ [key]: value });
  };

  /**
   * Handle preset application
   */
  const handlePresetApply = (presetName: string) => {
    applyPreset(presetName);
  };

  /**
   * Handle reset to OS defaults
   */
  const handleReset = () => {
    resetToDefaults();
  };

  /**
   * Handle export configuration to JSON file
   */
  const handleExport = () => {
    try {
      const json = exportSettings();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'terminal-font-settings.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export settings:', error);
    }
  };

  /**
   * Handle import configuration from JSON file
   */
  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const success = importSettings(json);
        if (!success) {
          console.error('Failed to import settings: Invalid JSON format');
        }
      } catch (error) {
        console.error('Failed to import settings:', error);
      }
    };
    reader.readAsText(file);
  };

  /**
   * Handle copy configuration to clipboard
   */
  const handleCopyToClipboard = async () => {
    try {
      const json = exportSettings();
      await navigator.clipboard.writeText(json);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section with title and description */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Terminal className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-foreground">
            {t('terminalFonts.title', { defaultValue: 'Terminal Fonts' })}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('terminalFonts.description', {
              defaultValue: 'Customize terminal font appearance, cursor behavior, and performance settings. Changes apply immediately to all active terminals.',
            })}
          </p>
        </div>
      </div>

      {/* Import/Export Actions */}
      <div className="flex items-center gap-2 p-4 rounded-lg border bg-card">
        <span className="text-sm font-medium text-foreground">
          {t('terminalFonts.configActions', { defaultValue: 'Configuration:' })}
        </span>
        <button
          type="button"
          onClick={handleExport}
          className="px-3 py-1.5 text-sm rounded-md transition-colors hover:bg-accent text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('terminalFonts.export', { defaultValue: 'Export JSON' })}
        </button>
        <label className="px-3 py-1.5 text-sm rounded-md transition-colors hover:bg-accent text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {t('terminalFonts.import', { defaultValue: 'Import JSON' })}
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleImport(file);
              }
            }}
          />
        </label>
        <button
          type="button"
          onClick={handleCopyToClipboard}
          className="px-3 py-1.5 text-sm rounded-md transition-colors hover:bg-accent text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('terminalFonts.copy', { defaultValue: 'Copy to Clipboard' })}
        </button>
      </div>

      {/* Font Configuration Panel */}
      {/* TODO: Uncomment once FontConfigPanel is implemented */}
      {/* <SettingsSection
        title={t('terminalFonts.fontConfig.title', { defaultValue: 'Font Configuration' })}
        description={t('terminalFonts.fontConfig.description', {
          defaultValue: 'Customize font family, size, weight, line height, and letter spacing',
        })}
      >
        <FontConfigPanel
          settings={settings}
          onSettingChange={handleSettingChange}
        />
      </SettingsSection> */}

      {/* Cursor Configuration Panel */}
      {/* TODO: Uncomment once CursorConfigPanel is implemented */}
      {/* <SettingsSection
        title={t('terminalFonts.cursorConfig.title', { defaultValue: 'Cursor Configuration' })}
        description={t('terminalFonts.cursorConfig.description', {
          defaultValue: 'Customize cursor style, blinking behavior, and accent color',
        })}
      >
        <CursorConfigPanel
          settings={settings}
          onSettingChange={handleSettingChange}
        />
      </SettingsSection> */}

      {/* Performance Configuration Panel */}
      {/* TODO: Uncomment once PerformanceConfigPanel is implemented */}
      {/* <SettingsSection
        title={t('terminalFonts.performanceConfig.title', { defaultValue: 'Performance Settings' })}
        description={t('terminalFonts.performanceConfig.description', {
          defaultValue: 'Adjust scrollback limit and other performance-related settings',
        })}
      >
        <PerformanceConfigPanel
          settings={settings}
          onSettingChange={handleSettingChange}
        />
      </SettingsSection> */}

      {/* Presets Panel */}
      {/* TODO: Uncomment once PresetsPanel is implemented */}
      {/* <SettingsSection
        title={t('terminalFonts.presets.title', { defaultValue: 'Quick Presets' })}
        description={t('terminalFonts.presets.description', {
          defaultValue: 'Apply pre-configured presets from popular IDEs and terminals',
        })}
      >
        <PresetsPanel
          onPresetApply={handlePresetApply}
          onReset={handleReset}
          currentSettings={settings}
        />
      </SettingsSection> */}

      {/* Live Preview Terminal */}
      {/* TODO: Uncomment once LivePreviewTerminal is implemented */}
      {/* <SettingsSection
        title={t('terminalFonts.preview.title', { defaultValue: 'Live Preview' })}
        description={t('terminalFonts.preview.description', {
          defaultValue: 'Preview your terminal settings in real-time (updates within 300ms)',
        })}
      >
        <LivePreviewTerminal settings={settings} />
      </SettingsSection> */}
    </div>
  );
}
