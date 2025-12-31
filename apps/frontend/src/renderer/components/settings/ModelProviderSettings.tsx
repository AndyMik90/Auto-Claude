import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, Zap, Sparkles, Info, ExternalLink, Check, Key } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { SettingsSection } from './SettingsSection';
import { cn } from '../../lib/utils';
import { MODEL_PROVIDERS, PROVIDER_MODELS } from '../../../shared/constants/models';
import type { AppSettings, ModelProvider } from '../../../shared/types';

interface ModelProviderSettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

/**
 * Model Provider Settings component
 * Allows configuration of alternative model providers (OpenRouter, Z.AI)
 * with support for both direct replacement and explicit model selection
 */
export function ModelProviderSettings({ settings, onSettingsChange }: ModelProviderSettingsProps) {
  const { t } = useTranslation('settings');

  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const useDirectReplacement = settings.useDirectReplacement ?? true;
  const currentProvider = settings.modelProvider ?? 'anthropic';
  const providerConfigs = settings.providerConfigs ?? {};

  const handleProviderChange = async (provider: ModelProvider) => {
    onSettingsChange({ ...settings, modelProvider: provider });
  };

  const handleApiKeyChange = async (provider: ModelProvider, apiKey: string) => {
    onSettingsChange({
      ...settings,
      providerConfigs: {
        ...providerConfigs,
        [provider]: {
          ...providerConfigs[provider],
          apiKey
        }
      }
    });
  };

  const handleBaseUrlChange = async (provider: ModelProvider, baseUrl: string) => {
    onSettingsChange({
      ...settings,
      providerConfigs: {
        ...providerConfigs,
        [provider]: {
          ...providerConfigs[provider],
          baseUrl
        }
      }
    });
  };

  const toggleDirectReplacement = async (enabled: boolean) => {
    onSettingsChange({ ...settings, useDirectReplacement: enabled });
  };

  const getProviderIcon = (provider: ModelProvider) => {
    switch (provider) {
      case 'anthropic': return Cpu;
      case 'openrouter': return Zap;
      case 'zai': return Sparkles;
    }
  };

  return (
    <SettingsSection
      title={t('modelProvider.title')}
      description={t('modelProvider.description')}
    >
      <div className="space-y-6">
        {/* Provider Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">{t('modelProvider.selectProvider')}</Label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {MODEL_PROVIDERS.map((provider) => {
              const Icon = getProviderIcon(provider.value);
              const isSelected = currentProvider === provider.value;

              return (
                <button
                  key={provider.value}
                  onClick={() => handleProviderChange(provider.value)}
                  className={cn(
                    'relative rounded-lg border p-4 text-left transition-all',
                    'hover:border-primary/50',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card'
                  )}
                >
                  {isSelected && (
                    <div className="absolute right-2 top-2">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={cn(
                      'h-5 w-5',
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    )} />
                    <span className="font-medium text-sm">{provider.label}</span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {provider.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Direct Replacement Mode Toggle */}
        {currentProvider !== 'anthropic' && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">
                  {t('modelProvider.directReplacementMode')}
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('modelProvider.directReplacementDescription')}
                </p>
              </div>
              <Switch
                checked={useDirectReplacement}
                onCheckedChange={toggleDirectReplacement}
              />
            </div>
          </div>
        )}

        {/* Provider-Specific Configuration */}
        {currentProvider !== 'anthropic' && (
          <div className="space-y-4 pt-4 border-t border-border">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              {t('modelProvider.providerConfiguration')}
            </h4>

            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor={`${currentProvider}-apiKey`} className="text-sm">
                {t('modelProvider.apiKey')}
              </Label>
              <div className="relative max-w-md">
                <Input
                  id={`${currentProvider}-apiKey`}
                  type={showApiKeys[currentProvider] ? 'text' : 'password'}
                  placeholder={t('modelProvider.apiKeyPlaceholder')}
                  value={providerConfigs[currentProvider]?.apiKey ||
                         (currentProvider === 'openrouter' ? settings.globalOpenRouterApiKey || '' :
                          currentProvider === 'zai' ? settings.globalZaiApiKey || '' : '')}
                  onChange={(e) => handleApiKeyChange(currentProvider, e.target.value)}
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKeys({
                    ...showApiKeys,
                    [currentProvider]: !showApiKeys[currentProvider]
                  })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKeys[currentProvider] ? (
                    <span className="text-xs">Hide</span>
                  ) : (
                    <span className="text-xs">Show</span>
                  )}
                </button>
              </div>
            </div>

            {/* Custom Base URL */}
            <div className="space-y-2">
              <Label htmlFor={`${currentProvider}-baseUrl`} className="text-sm">
                {t('modelProvider.customBaseUrl')}
              </Label>
              <Input
                id={`${currentProvider}-baseUrl`}
                placeholder={MODEL_PROVIDERS.find(p => p.value === currentProvider)?.baseUrl}
                value={providerConfigs[currentProvider]?.baseUrl || ''}
                onChange={(e) => handleBaseUrlChange(currentProvider, e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="rounded-lg bg-muted/50 border border-border p-4">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-muted-foreground space-y-2">
              <p>{t('modelProvider.infoText')}</p>

              {currentProvider === 'openrouter' && (
                <>
                  <p className="font-medium text-foreground">
                    Available GLM Models on OpenRouter:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>GLM-4 Plus (Opus tier)</li>
                    <li>GLM-4 (Sonnet tier)</li>
                    <li>GLM-4 Air / Flash (Haiku tier)</li>
                  </ul>
                  <a
                    href="https://openrouter.ai/models?order=newest&q=glm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    View all OpenRouter GLM models
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}

              {currentProvider === 'zai' && (
                <>
                  <p className="font-medium text-foreground">
                    Available GLM Models on Z.AI:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>GLM-4.7 (Latest)</li>
                    <li>GLM-4 Plus</li>
                    <li>GLM-4 Air / Flash</li>
                  </ul>
                  <a
                    href="https://open.bigmodel.cn/usercenter/apikeys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Get Z.AI API key
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
