import { useTranslation } from 'react-i18next';
import { Search, Sparkles } from 'lucide-react';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { SettingsSection } from './SettingsSection';
import type { AppSettings } from '../../../shared/types';

interface ZenModeSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

/**
 * Zen Mode settings component
 * Configure the minimalist interface for quick task creation
 */
export function ZenModeSettings({ settings, onSettingsChange }: ZenModeSettingsProps) {
  const { t } = useTranslation('settings');

  return (
    <div className="space-y-8">
      <SettingsSection
        title={t('zen.title')}
        description={t('zen.description')}
      >
        <div className="space-y-6">
          {/* Zen Mode by Default */}
          <div className="space-y-3">
            <div className="flex items-center justify-between max-w-md">
              <div className="space-y-1">
                <Label htmlFor="zenModeByDefault" className="text-sm font-medium text-foreground">
                  {t('zen.byDefault')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('zen.byDefaultDescription')}
                </p>
              </div>
              <Switch
                id="zenModeByDefault"
                checked={settings.zenModeByDefault ?? false}
                onCheckedChange={(checked) => onSettingsChange({ ...settings, zenModeByDefault: checked })}
              />
            </div>
          </div>

          {/* Stay in Zen After Create */}
          <div className="space-y-3">
            <div className="flex items-center justify-between max-w-md">
              <div className="space-y-1">
                <Label htmlFor="stayInZenAfterCreate" className="text-sm font-medium text-foreground">
                  {t('zen.stayInZen')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('zen.stayInZenDescription')}
                </p>
              </div>
              <Switch
                id="stayInZenAfterCreate"
                checked={settings.stayInZenAfterCreate ?? true}
                onCheckedChange={(checked) => onSettingsChange({ ...settings, stayInZenAfterCreate: checked })}
              />
            </div>
          </div>

          {/* Show Suggestions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between max-w-md">
              <div className="space-y-1">
                <Label htmlFor="zenModeSuggestions" className="text-sm font-medium text-foreground">
                  {t('zen.showSuggestions')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('zen.showSuggestionsDescription')}
                </p>
              </div>
              <Switch
                id="zenModeSuggestions"
                checked={settings.zenModeSuggestions ?? true}
                onCheckedChange={(checked) => onSettingsChange({ ...settings, zenModeSuggestions: checked })}
              />
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* How it works */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <Search className="h-5 w-5 text-primary mt-0.5" />
          <div className="space-y-2 text-sm">
            <h4 className="font-medium text-foreground">{t('zen.howItWorks.title')}</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>• {t('zen.howItWorks.step1')}</li>
              <li>• {t('zen.howItWorks.step2')}</li>
              <li>• {t('zen.howItWorks.step3')}</li>
            </ul>
            <div className="pt-2">
              <p className="font-medium text-foreground">{t('zen.keyboardShortcuts.title')}</p>
              <div className="flex gap-4 mt-1 text-muted-foreground">
                <span><kbd className="px-1.5 py-0.5 text-xs bg-background rounded border border-border">Esc</kbd> {t('zen.keyboardShortcuts.exit')}</span>
                <span><kbd className="px-1.5 py-0.5 text-xs bg-background rounded border border-border">Z</kbd> {t('zen.keyboardShortcuts.open')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
