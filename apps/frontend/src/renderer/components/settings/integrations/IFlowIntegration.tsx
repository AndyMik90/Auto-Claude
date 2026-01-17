import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import type { ProjectEnvConfig, IFlowSyncStatus, IFlowModel, IFlowConfig } from '../../../../shared/types';
import {
  IFLOW_DEFAULT_MODELS,
  MODEL_CAPABILITY_BADGES,
  MODEL_SPECIAL_BADGES,
  getModelById,
} from '../../../../shared/constants/iflow-models';

interface IFlowIntegrationProps {
  envConfig: ProjectEnvConfig | null;
  updateEnvConfig: (updates: Partial<ProjectEnvConfig>) => void;
  iflowConnectionStatus: IFlowSyncStatus | null;
  isCheckingIFlow: boolean;
  onTestConnection: () => void;
  onDiscoverModels?: () => Promise<IFlowModel[]>;
}

/**
 * iFlow integration settings component.
 * Manages iFlow API configuration, connection status, and model selection.
 */
export function IFlowIntegration({
  envConfig,
  updateEnvConfig,
  iflowConnectionStatus,
  isCheckingIFlow,
  onTestConnection,
  onDiscoverModels,
}: IFlowIntegrationProps) {
  const { t } = useTranslation(['settings', 'common']);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [addModelDialogOpen, setAddModelDialogOpen] = useState(false);

  if (!envConfig) return null;

  const iflowConfig = envConfig.iflowConfig || { enabled: false };
  const models = iflowConfig.models || IFLOW_DEFAULT_MODELS;

  const updateIFlowConfig = (updates: Partial<IFlowConfig>) => {
    updateEnvConfig({
      iflowConfig: {
        ...iflowConfig,
        ...updates,
      },
    });
  };

  const handleDiscoverModels = async () => {
    if (!onDiscoverModels) return;

    setIsDiscovering(true);
    try {
      const discoveredModels = await onDiscoverModels();
      const existingIds = new Set(models.map((m) => m.id));
      const newModels = discoveredModels.filter((m) => !existingIds.has(m.id));

      if (newModels.length > 0) {
        updateIFlowConfig({
          models: [...models, ...newModels],
        });
      }
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleAddModel = (model: IFlowModel) => {
    updateIFlowConfig({
      models: [...models, model],
    });
    setAddModelDialogOpen(false);
  };

  const handleRemoveModel = (modelId: string) => {
    updateIFlowConfig({
      models: models.filter((m) => m.id !== modelId),
    });
  };

  return (
    <div className="space-y-4">
      {/* Enable Toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">{t('settings:iflow.enable')}</Label>
          <p className="text-xs text-muted-foreground">{t('settings:iflow.enableDescription')}</p>
        </div>
        <Switch
          checked={iflowConfig.enabled}
          onCheckedChange={(checked) => updateIFlowConfig({ enabled: checked })}
        />
      </div>

      {iflowConfig.enabled && (
        <>
          {/* API Key */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              {t('settings:iflow.apiKey')}
            </Label>
            <p className="text-xs text-muted-foreground">{t('settings:iflow.apiKeyDescription')}</p>
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                placeholder={t('settings:iflow.apiKeyPlaceholder')}
                value={iflowConfig.apiKey || ''}
                onChange={(e) => updateIFlowConfig({ apiKey: e.target.value })}
                className="pr-10"
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

          {/* Base URL */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              {t('settings:iflow.baseUrl')}
            </Label>
            <p className="text-xs text-muted-foreground">{t('settings:iflow.baseUrlDescription')}</p>
            <Input
              placeholder={t('settings:iflow.baseUrlPlaceholder')}
              value={iflowConfig.baseUrl || ''}
              onChange={(e) => updateIFlowConfig({ baseUrl: e.target.value })}
            />
          </div>

          {/* Connection Status */}
          {iflowConfig.apiKey && (
            <ConnectionStatus
              isChecking={isCheckingIFlow}
              connectionStatus={iflowConnectionStatus}
              onTestConnection={onTestConnection}
              t={t}
            />
          )}

          <Separator />

          {/* Default Model */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              {t('settings:iflow.defaultModel')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('settings:iflow.defaultModelDescription')}
            </p>
            <Select
              value={iflowConfig.defaultModel || 'deepseek-v3'}
              onValueChange={(value) => updateIFlowConfig({ defaultModel: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center gap-2">
                      <span>{model.name}</span>
                      {MODEL_SPECIAL_BADGES[model.id] && (
                        <Badge variant="secondary" className="text-xs">
                          {MODEL_SPECIAL_BADGES[model.id]}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Available Models */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-foreground">
                  {t('settings:iflow.models.title')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('settings:iflow.models.description')}
                </p>
              </div>
              <div className="flex gap-2">
                {onDiscoverModels && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDiscoverModels}
                    disabled={isDiscovering || !iflowConfig.apiKey}
                  >
                    {isDiscovering ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {isDiscovering
                      ? t('settings:iflow.models.discovering')
                      : t('settings:iflow.models.discover')}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setAddModelDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('settings:iflow.models.add')}
                </Button>
              </div>
            </div>

            <IFlowModelList
              models={models}
              onRemoveModel={handleRemoveModel}
              t={t}
            />
          </div>
        </>
      )}

      {/* Add Model Dialog */}
      <AddModelDialog
        open={addModelDialogOpen}
        onOpenChange={setAddModelDialogOpen}
        onAddModel={handleAddModel}
        existingModelIds={models.map((m) => m.id)}
        t={t}
      />
    </div>
  );
}

interface ConnectionStatusProps {
  isChecking: boolean;
  connectionStatus: IFlowSyncStatus | null;
  onTestConnection: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function ConnectionStatus({
  isChecking,
  connectionStatus,
  onTestConnection,
  t,
}: ConnectionStatusProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            {t('settings:iflow.status.connected', { defaultValue: 'Connection Status' })}
          </p>
          <p className="text-xs text-muted-foreground">
            {isChecking
              ? t('settings:iflow.status.checking')
              : connectionStatus?.connected
                ? t('settings:iflow.status.modelCount', { count: connectionStatus.modelCount || 0 })
                : connectionStatus?.error || t('settings:iflow.status.disconnected')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isChecking ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : connectionStatus?.connected ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <AlertCircle className="h-4 w-4 text-warning" />
          )}
          <Button variant="outline" size="sm" onClick={onTestConnection} disabled={isChecking}>
            {t('settings:iflow.testConnection')}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface IFlowModelListProps {
  models: IFlowModel[];
  onRemoveModel: (modelId: string) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function IFlowModelList({ models, onRemoveModel, t }: IFlowModelListProps) {
  if (models.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center">
        <p className="text-sm text-muted-foreground">{t('settings:iflow.models.empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {models.map((model) => {
        const specialBadge = MODEL_SPECIAL_BADGES[model.id];

        return (
          <div
            key={model.id}
            className="flex items-center justify-between rounded-lg border border-border p-3 bg-background"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{model.name}</span>
                {specialBadge && (
                  <Badge variant="default" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {specialBadge}
                  </Badge>
                )}
              </div>
              {model.description && (
                <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
              )}
              <div className="flex gap-1 mt-2">
                {model.capabilities?.map((cap) => {
                  const badge = MODEL_CAPABILITY_BADGES[cap];
                  return (
                    <Badge key={cap} variant={badge?.variant || 'outline'} className="text-xs">
                      {badge?.label || cap}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemoveModel(model.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

interface AddModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddModel: (model: IFlowModel) => void;
  existingModelIds: string[];
  t: ReturnType<typeof useTranslation>['t'];
}

function AddModelDialog({
  open,
  onOpenChange,
  onAddModel,
  existingModelIds,
  t,
}: AddModelDialogProps) {
  const [modelId, setModelId] = useState('');
  const [modelName, setModelName] = useState('');
  const [capability, setCapability] = useState('general');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!modelId.trim()) {
      setError('Model ID is required');
      return;
    }
    if (existingModelIds.includes(modelId)) {
      setError('A model with this ID already exists');
      return;
    }

    onAddModel({
      id: modelId.trim(),
      name: modelName.trim() || modelId.trim(),
      capabilities: [capability],
      addedAt: new Date().toISOString(),
    });

    // Reset form
    setModelId('');
    setModelName('');
    setCapability('general');
    setError('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settings:iflow.models.addManual')}</DialogTitle>
          <DialogDescription>
            {t('settings:iflow.models.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('settings:iflow.models.modelId')}</Label>
            <Input
              placeholder={t('settings:iflow.models.modelIdPlaceholder')}
              value={modelId}
              onChange={(e) => {
                setModelId(e.target.value);
                setError('');
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('settings:iflow.models.displayName')}</Label>
            <Input
              placeholder={t('settings:iflow.models.displayNamePlaceholder')}
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('settings:iflow.models.capability')}</Label>
            <Select value={capability} onValueChange={setCapability}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="code">
                  {t('settings:iflow.models.capabilities.code')}
                </SelectItem>
                <SelectItem value="reasoning">
                  {t('settings:iflow.models.capabilities.reasoning')}
                </SelectItem>
                <SelectItem value="general">
                  {t('settings:iflow.models.capabilities.general')}
                </SelectItem>
                <SelectItem value="chinese">
                  {t('settings:iflow.models.capabilities.chinese')}
                </SelectItem>
                <SelectItem value="translation">
                  {t('settings:iflow.models.capabilities.translation')}
                </SelectItem>
                <SelectItem value="creativity">
                  {t('settings:iflow.models.capabilities.creativity')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:buttons.cancel')}
          </Button>
          <Button onClick={handleSubmit}>{t('common:buttons.add')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
