import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Database,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Globe
} from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import { Separator } from '../ui/separator';
import { OllamaModelSelector } from '../onboarding/OllamaModelSelector';
import type { ProjectEnvConfig, ProjectSettings as ProjectSettingsType, GraphitiEmbeddingProvider } from '../../../shared/types';

interface SecuritySettingsProps {
  envConfig: ProjectEnvConfig | null;
  settings: ProjectSettingsType;
  setSettings: React.Dispatch<React.SetStateAction<ProjectSettingsType>>;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;

  // Password visibility
  showOpenAIKey: boolean;
  setShowOpenAIKey: React.Dispatch<React.SetStateAction<boolean>>;

  // Collapsible section
  expanded: boolean;
  onToggle: () => void;
}

export function SecuritySettings({
  envConfig,
  settings,
  setSettings,
  updateEnvConfig,
  showOpenAIKey,
  setShowOpenAIKey,
  expanded,
  onToggle
}: SecuritySettingsProps) {
  const { t: tIntegrations } = useTranslation('integrations');
  const { t: tCommon } = useTranslation('common');

  // Password visibility for multiple providers
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({
    openai: showOpenAIKey,
    voyage: false,
    google: false,
    azure: false
  });

  // Sync parent's showOpenAIKey prop to local state
  useEffect(() => {
    setShowApiKey(prev => ({ ...prev, openai: showOpenAIKey }));
  }, [showOpenAIKey]);

  const embeddingProvider = envConfig?.graphitiProviderConfig?.embeddingProvider || 'ollama';

  // Toggle API key visibility
  const toggleShowApiKey = (key: string) => {
    const newValue = !showApiKey[key];
    setShowApiKey(prev => ({ ...prev, [key]: newValue }));
    // Sync with parent for OpenAI
    if (key === 'openai') {
      setShowOpenAIKey(newValue);
    }
  };

  // Handle Ollama model selection
  const handleOllamaModelSelect = (modelName: string, dim: number) => {
    updateEnvConfig({
      graphitiProviderConfig: {
        ...envConfig?.graphitiProviderConfig,
        embeddingProvider: 'ollama',
        ollamaEmbeddingModel: modelName,
        ollamaEmbeddingDim: dim,
      }
    });
  };

  if (!envConfig) return null;

  // Render provider-specific configuration fields
  const renderProviderFields = () => {
    // OpenAI
    if (embeddingProvider === 'openai') {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-foreground">
              {tIntegrations('memory.openAI.apiKey')} {envConfig.openaiKeyIsGlobal ? tIntegrations('memory.openAI.override') : ''}
            </Label>
            {envConfig.openaiKeyIsGlobal && (
              <span className="flex items-center gap-1 text-xs text-info">
                <Globe className="h-3 w-3" />
                {tIntegrations('memory.openAI.usingGlobal')}
              </span>
            )}
          </div>
          {envConfig.openaiKeyIsGlobal ? (
            <p className="text-xs text-muted-foreground">
              {tIntegrations('memory.openAI.globalDescription')}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {tIntegrations('memory.openAI.description')}
            </p>
          )}
          <div className="relative">
            <Input
              type={showApiKey['openai'] ? 'text' : 'password'}
              placeholder={envConfig.openaiKeyIsGlobal ? tIntegrations('memory.openAI.placeholder') : 'sk-xxxxxxxx'}
              value={envConfig.openaiKeyIsGlobal ? '' : (envConfig.openaiApiKey || '')}
              onChange={(e) => updateEnvConfig({ openaiApiKey: e.target.value || undefined })}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => toggleShowApiKey('openai')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showApiKey['openai'] ? tCommon('accessibility.hidePassword') : tCommon('accessibility.showPassword')}
            >
              {showApiKey['openai'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {tCommon('getApiKeyFrom')}{' '}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
              {tIntegrations('memory.openAI.linkText')}
            </a>
          </p>
        </div>
      );
    }

    // Voyage AI
    if (embeddingProvider === 'voyage') {
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">{tIntegrations('memory.voyage.apiKey')}</Label>
          <p className="text-xs text-muted-foreground">
            {tIntegrations('memory.voyage.description')}
          </p>
          <div className="relative">
            <Input
              type={showApiKey['voyage'] ? 'text' : 'password'}
              value={envConfig.graphitiProviderConfig?.voyageApiKey || ''}
              onChange={(e) => updateEnvConfig({
                graphitiProviderConfig: {
                  ...envConfig.graphitiProviderConfig,
                  embeddingProvider: 'voyage',
                  voyageApiKey: e.target.value || undefined,
                }
              })}
              placeholder="pa-xxxxxxxx"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => toggleShowApiKey('voyage')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showApiKey['voyage'] ? tCommon('accessibility.hidePassword') : tCommon('accessibility.showPassword')}
            >
              {showApiKey['voyage'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {tCommon('getApiKeyFrom')}{' '}
            <a href="https://dash.voyageai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
              {tIntegrations('memory.voyage.linkText')}
            </a>
          </p>
          <div className="space-y-1 mt-3">
            <Label className="text-xs text-muted-foreground">{tIntegrations('memory.voyage.model')}</Label>
            <Input
              placeholder="voyage-3"
              value={envConfig.graphitiProviderConfig?.voyageEmbeddingModel || ''}
              onChange={(e) => updateEnvConfig({
                graphitiProviderConfig: {
                  ...envConfig.graphitiProviderConfig,
                  embeddingProvider: 'voyage',
                  voyageEmbeddingModel: e.target.value || undefined,
                }
              })}
            />
          </div>
        </div>
      );
    }

    // Google AI
    if (embeddingProvider === 'google') {
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">{tIntegrations('memory.google.apiKey')}</Label>
          <p className="text-xs text-muted-foreground">
            {tIntegrations('memory.google.description')}
          </p>
          <div className="relative">
            <Input
              type={showApiKey['google'] ? 'text' : 'password'}
              value={envConfig.graphitiProviderConfig?.googleApiKey || ''}
              onChange={(e) => updateEnvConfig({
                graphitiProviderConfig: {
                  ...envConfig.graphitiProviderConfig,
                  embeddingProvider: 'google',
                  googleApiKey: e.target.value || undefined,
                }
              })}
              placeholder="AIzaSy..."
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => toggleShowApiKey('google')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showApiKey['google'] ? tCommon('accessibility.hidePassword') : tCommon('accessibility.showPassword')}
            >
              {showApiKey['google'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {tCommon('getApiKeyFrom')}{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
              {tIntegrations('memory.google.linkText')}
            </a>
          </p>
        </div>
      );
    }

    // Azure OpenAI
    if (embeddingProvider === 'azure_openai') {
      return (
        <div className="space-y-3 p-3 rounded-md bg-muted/50">
          <Label className="text-sm font-medium text-foreground">{tIntegrations('memory.azure.title')}</Label>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{tIntegrations('memory.azure.apiKey')}</Label>
            <div className="relative">
              <Input
                type={showApiKey['azure'] ? 'text' : 'password'}
                value={envConfig.graphitiProviderConfig?.azureOpenaiApiKey || ''}
                onChange={(e) => updateEnvConfig({
                  graphitiProviderConfig: {
                    ...envConfig.graphitiProviderConfig,
                    embeddingProvider: 'azure_openai',
                    azureOpenaiApiKey: e.target.value || undefined,
                  }
                })}
                placeholder="Azure API Key"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => toggleShowApiKey('azure')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showApiKey['azure'] ? tCommon('accessibility.hidePassword') : tCommon('accessibility.showPassword')}
              >
                {showApiKey['azure'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{tIntegrations('memory.azure.baseUrl')}</Label>
            <Input
              placeholder="https://your-resource.openai.azure.com"
              value={envConfig.graphitiProviderConfig?.azureOpenaiBaseUrl || ''}
              onChange={(e) => updateEnvConfig({
                graphitiProviderConfig: {
                  ...envConfig.graphitiProviderConfig,
                  embeddingProvider: 'azure_openai',
                  azureOpenaiBaseUrl: e.target.value || undefined,
                }
              })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{tIntegrations('memory.azure.deployment')}</Label>
            <Input
              placeholder="text-embedding-ada-002"
              value={envConfig.graphitiProviderConfig?.azureOpenaiEmbeddingDeployment || ''}
              onChange={(e) => updateEnvConfig({
                graphitiProviderConfig: {
                  ...envConfig.graphitiProviderConfig,
                  embeddingProvider: 'azure_openai',
                  azureOpenaiEmbeddingDeployment: e.target.value || undefined,
                }
              })}
            />
          </div>
        </div>
      );
    }

    // Ollama (Local) - uses OllamaModelSelector component
    if (embeddingProvider === 'ollama') {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{tIntegrations('memory.ollama.baseUrl')}</Label>
            <Input
              placeholder="http://localhost:11434"
              value={envConfig.graphitiProviderConfig?.ollamaBaseUrl || 'http://localhost:11434'}
              onChange={(e) => updateEnvConfig({
                graphitiProviderConfig: {
                  ...envConfig.graphitiProviderConfig,
                  embeddingProvider: 'ollama',
                  ollamaBaseUrl: e.target.value,
                }
              })}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">{tIntegrations('memory.ollama.selectModel')}</Label>
            <OllamaModelSelector
              selectedModel={envConfig.graphitiProviderConfig?.ollamaEmbeddingModel || ''}
              baseUrl={envConfig.graphitiProviderConfig?.ollamaBaseUrl}
              onModelSelect={handleOllamaModelSelect}
            />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <section className="space-y-3">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-sm font-semibold text-foreground hover:text-foreground/80"
      >
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          {tIntegrations('memory.title')}
          <span className={`px-2 py-0.5 text-xs rounded-full ${envConfig.graphitiEnabled
            ? 'bg-success/10 text-success'
            : 'bg-muted text-muted-foreground'
            }`}>
            {envConfig.graphitiEnabled ? tIntegrations('memory.enabled') : tIntegrations('memory.disabled')}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div className="space-y-4 pl-6 pt-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-normal text-foreground">{tIntegrations('memory.enableMemory')}</Label>
              <p className="text-xs text-muted-foreground">
                {tIntegrations('memory.enableMemoryDescription')}
              </p>
            </div>
            <Switch
              checked={envConfig.graphitiEnabled}
              onCheckedChange={(checked) => {
                updateEnvConfig({ graphitiEnabled: checked });
                setSettings({ ...settings, memoryBackend: checked ? 'graphiti' : 'file' });
              }}
            />
          </div>

          {!envConfig.graphitiEnabled && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                {tIntegrations('memory.fileBasedFallback')}
              </p>
            </div>
          )}

          {envConfig.graphitiEnabled && (
            <>
              {/* Graphiti MCP Server Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="font-normal text-foreground">{tIntegrations('memory.agentMemoryAccess')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {tIntegrations('memory.agentMemoryAccessDescription')}
                  </p>
                </div>
                <Switch
                  checked={settings.graphitiMcpEnabled}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, graphitiMcpEnabled: checked })
                  }
                />
              </div>

              {settings.graphitiMcpEnabled && (
                <div className="space-y-2 ml-6">
                  <Label className="text-sm font-medium text-foreground">{tIntegrations('memory.graphitiMcpUrl')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {tIntegrations('memory.graphitiMcpUrlDescription')}
                  </p>
                  <Input
                    placeholder="http://localhost:8000/mcp/"
                    value={settings.graphitiMcpUrl || ''}
                    onChange={(e) => setSettings({ ...settings, graphitiMcpUrl: e.target.value || undefined })}
                  />
                </div>
              )}

              <Separator />

              {/* Embedding Provider Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{tIntegrations('memory.embeddingProvider')}</Label>
                <p className="text-xs text-muted-foreground">
                  {tIntegrations('memory.embeddingProviderDescription')}
                </p>
                <Select
                  value={embeddingProvider}
                  onValueChange={(value: GraphitiEmbeddingProvider) => {
                    updateEnvConfig({
                      graphitiProviderConfig: {
                        ...envConfig.graphitiProviderConfig,
                        embeddingProvider: value,
                      }
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tIntegrations('memory.selectProvider')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ollama">{tIntegrations('memory.providers.ollama')}</SelectItem>
                    <SelectItem value="openai">{tIntegrations('memory.providers.openai')}</SelectItem>
                    <SelectItem value="voyage">{tIntegrations('memory.providers.voyage')}</SelectItem>
                    <SelectItem value="google">{tIntegrations('memory.providers.google')}</SelectItem>
                    <SelectItem value="azure_openai">{tIntegrations('memory.providers.azure')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Provider-specific fields */}
              {renderProviderFields()}

              <Separator />

              {/* Database Settings */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{tIntegrations('memory.databaseName')}</Label>
                <p className="text-xs text-muted-foreground">
                  {tIntegrations('memory.databaseNameDescription')}
                </p>
                <Input
                  placeholder="auto_claude_memory"
                  value={envConfig.graphitiDatabase || ''}
                  onChange={(e) => updateEnvConfig({ graphitiDatabase: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{tIntegrations('memory.databasePath')}</Label>
                <p className="text-xs text-muted-foreground">
                  {tIntegrations('memory.databasePathDescription')}
                </p>
                <Input
                  placeholder="~/.auto-claude/memories"
                  value={envConfig.graphitiDbPath || ''}
                  onChange={(e) => updateEnvConfig({ graphitiDbPath: e.target.value || undefined })}
                />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
