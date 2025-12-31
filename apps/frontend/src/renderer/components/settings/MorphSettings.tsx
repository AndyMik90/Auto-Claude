import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Zap,
  Eye,
  EyeOff,
  Info,
  ExternalLink
} from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { SettingsSection } from './SettingsSection';
import type { AppSettings } from '../../../shared/types';

interface MorphSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

/**
 * Morph Fast Apply settings for enabling AI-powered code application
 */
export function MorphSettings({ settings, onSettingsChange }: MorphSettingsProps) {
  const { t } = useTranslation('settings');

  // Password visibility toggle for API key
  const [showApiKey, setShowApiKey] = useState(false);

  const handleEnableChange = (enabled: boolean) => {
    onSettingsChange({ ...settings, morphEnabled: enabled });
  };

  const handleApiKeyChange = (apiKey: string) => {
    onSettingsChange({ ...settings, morphApiKey: apiKey || undefined });
  };

  return (
    <SettingsSection
      title={t('morph.title')}
      description={t('morph.description')}
    >
      <div className="space-y-6">
        {/* Info banner */}
        <div className="rounded-lg bg-info/10 border border-info/30 p-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {t('morph.info')}
              </p>
              <button
                type="button"
                onClick={() => window.electronAPI?.openExternal('https://morph.so')}
                className="inline-flex items-center gap-1 text-xs text-info hover:text-info/80 hover:underline transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                {t('morph.learnMore')}
              </button>
            </div>
          </div>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-1">
              <Label className="font-medium text-foreground">{t('morph.enableLabel')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('morph.enableDescription')}
              </p>
            </div>
          </div>
          <Switch
            checked={settings.morphEnabled ?? false}
            onCheckedChange={handleEnableChange}
          />
        </div>

        {/* API Key input - only show when enabled */}
        {settings.morphEnabled && (
          <div className="space-y-4 pl-4 border-l-2 border-primary/20">
            <div className="space-y-2">
              <Label htmlFor="morphApiKey" className="text-sm font-medium text-foreground">
                {t('morph.apiKeyLabel')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('morph.apiKeyDescription')}
              </p>
              <div className="relative max-w-lg">
                <Input
                  id="morphApiKey"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder={t('morph.apiKeyPlaceholder')}
                  value={settings.morphApiKey || ''}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Warning if enabled but no API key */}
            {settings.morphEnabled && !settings.morphApiKey && (
              <div className="rounded-lg bg-warning/10 border border-warning/30 p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    {t('morph.noApiKeyWarning')}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
