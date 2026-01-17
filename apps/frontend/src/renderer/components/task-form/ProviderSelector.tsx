/**
 * ProviderSelector - Component for selecting AI provider (Claude/iFlow)
 *
 * Used in task creation to choose between Claude SDK and iFlow alternative models.
 * Shows model recommendations based on task category.
 */
import { useTranslation } from 'react-i18next';
import { Lightbulb, Sparkles } from 'lucide-react';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import type { TaskProvider, IFlowConfig, IFlowModel, TaskCategory } from '../../../shared/types';
import {
  TASK_MODEL_RECOMMENDATIONS,
  MODEL_SPECIAL_BADGES,
  IFLOW_DEFAULT_MODELS,
} from '../../../shared/constants/iflow-models';

interface ProviderSelectorProps {
  provider: TaskProvider;
  iflowModel: string | undefined;
  taskCategory?: TaskCategory | '';
  onProviderChange: (provider: TaskProvider) => void;
  onModelChange: (model: string | undefined) => void;
  iflowConfig?: IFlowConfig;
  disabled?: boolean;
}

/**
 * Provider selector for task creation.
 * Allows choosing between Claude and iFlow providers.
 */
export function ProviderSelector({
  provider,
  iflowModel,
  taskCategory,
  onProviderChange,
  onModelChange,
  iflowConfig,
  disabled = false,
}: ProviderSelectorProps) {
  const { t } = useTranslation(['tasks', 'settings']);

  const isIFlowEnabled = iflowConfig?.enabled;
  const models = iflowConfig?.models || IFLOW_DEFAULT_MODELS;

  // Get recommendation based on task category
  const getRecommendation = () => {
    if (!taskCategory) return null;

    // Map task category to task type for recommendations
    const categoryToTaskType: Record<string, string> = {
      feature: 'coding',
      bug_fix: 'coding',
      refactoring: 'coding',
      documentation: 'research',
      security: 'qa_review',
    };

    const taskType = categoryToTaskType[taskCategory];
    if (!taskType) return null;

    return TASK_MODEL_RECOMMENDATIONS[taskType] || null;
  };

  const recommendation = getRecommendation();

  return (
    <div className="space-y-4">
      {/* Provider Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          {t('tasks:provider.label')}
        </Label>
        <p className="text-xs text-muted-foreground">{t('tasks:provider.description')}</p>

        <RadioGroup
          value={provider}
          onValueChange={(value) => onProviderChange(value as TaskProvider)}
          disabled={disabled}
          className="grid grid-cols-2 gap-4 pt-2"
        >
          {/* Claude Option */}
          <div className="relative">
            <RadioGroupItem
              value="claude"
              id="provider-claude"
              className="peer sr-only"
            />
            <label
              htmlFor="provider-claude"
              className="flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-all
                peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2
                peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5
                hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{t('tasks:provider.claude')}</span>
                <StatusDot connected={true} />
              </div>
              <span className="text-xs text-muted-foreground mt-1">
                {t('tasks:provider.claudeDescription')}
              </span>
            </label>
          </div>

          {/* iFlow Option */}
          <div className="relative">
            <RadioGroupItem
              value="iflow"
              id="provider-iflow"
              disabled={!isIFlowEnabled}
              className="peer sr-only"
            />
            <label
              htmlFor="provider-iflow"
              className={`flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-all
                peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2
                peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5
                hover:bg-muted/50
                ${!isIFlowEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{t('tasks:provider.iflow')}</span>
                <StatusDot connected={isIFlowEnabled} />
                {!isIFlowEnabled && (
                  <Badge variant="outline" className="text-xs">
                    Not configured
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground mt-1">
                {t('tasks:provider.iflowDescription')}
              </span>
            </label>
          </div>
        </RadioGroup>
      </div>

      {/* iFlow Model Selection */}
      {provider === 'iflow' && isIFlowEnabled && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            {t('tasks:provider.selectModel')}
          </Label>

          {/* Recommendation hint */}
          {recommendation && (
            <Alert className="bg-info/5 border-info/30">
              <Lightbulb className="h-4 w-4 text-info" />
              <AlertDescription className="text-sm">
                <span className="font-medium">{t('tasks:provider.recommended')}:</span>{' '}
                {recommendation.model}
                <br />
                <span className="text-xs text-muted-foreground">{recommendation.reason}</span>
              </AlertDescription>
            </Alert>
          )}

          <Select
            value={iflowModel || iflowConfig?.defaultModel || 'deepseek-v3'}
            onValueChange={onModelChange}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('tasks:provider.selectModel')} />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => {
                const isRecommended = recommendation?.model === model.id;
                const specialBadge = MODEL_SPECIAL_BADGES[model.id];

                return (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center gap-2">
                      <span>{model.name}</span>
                      {isRecommended && (
                        <Badge variant="default" className="text-xs">
                          <Sparkles className="h-3 w-3 mr-1" />
                          {t('tasks:provider.recommended')}
                        </Badge>
                      )}
                      {!isRecommended && specialBadge && (
                        <Badge variant="outline" className="text-xs">
                          {specialBadge}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

/**
 * Status dot indicator for provider connection status
 */
function StatusDot({ connected }: { connected?: boolean }) {
  return (
    <span
      className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-muted-foreground'}`}
    />
  );
}

export default ProviderSelector;
