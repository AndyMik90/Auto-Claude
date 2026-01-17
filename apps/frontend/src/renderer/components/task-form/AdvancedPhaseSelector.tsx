/**
 * AdvancedPhaseSelector - Per-phase provider and model configuration
 *
 * Allows configuring different providers (Claude/iFlow) and models for each task phase:
 * - Spec Creation
 * - Planning
 * - Coding
 * - QA Review
 */
import { useTranslation } from 'react-i18next';
import { FileText, ListTodo, Code, CheckCircle, Sparkles, ChevronDown } from 'lucide-react';
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
import { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import { cn } from '../../lib/utils';
import type {
  TaskProvider,
  ThinkingLevel,
  PhaseConfig,
  PhaseModelConfig,
  IFlowConfig,
} from '../../../shared/types';
import {
  TASK_MODEL_RECOMMENDATIONS,
  IFLOW_DEFAULT_MODELS,
} from '../../../shared/constants/iflow-models';

// Thinking levels for Claude
const THINKING_LEVELS: { value: ThinkingLevel; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'ultrathink', label: 'Ultrathink' },
];

// Claude models
const CLAUDE_MODELS = [
  { value: 'opus', label: 'Claude Opus 4.5' },
  { value: 'sonnet', label: 'Claude Sonnet 4.5' },
  { value: 'haiku', label: 'Claude Haiku 4.5' },
];

// Phase definitions
const PHASES = [
  {
    id: 'spec' as const,
    icon: FileText,
    taskType: 'spec_gathering',
  },
  {
    id: 'planning' as const,
    icon: ListTodo,
    taskType: 'planning',
  },
  {
    id: 'coding' as const,
    icon: Code,
    taskType: 'coding',
  },
  {
    id: 'qa' as const,
    icon: CheckCircle,
    taskType: 'qa_review',
  },
];

interface AdvancedPhaseSelectorProps {
  phaseConfig: PhaseModelConfig | undefined;
  onPhaseConfigChange: (config: PhaseModelConfig | undefined) => void;
  iflowConfig?: IFlowConfig;
  disabled?: boolean;
}

/**
 * Advanced per-phase configuration selector.
 * Allows setting provider/model/thinking for each task phase.
 */
export function AdvancedPhaseSelector({
  phaseConfig,
  onPhaseConfigChange,
  iflowConfig,
  disabled = false,
}: AdvancedPhaseSelectorProps) {
  const { t } = useTranslation(['tasks', 'settings']);

  const isIFlowEnabled = iflowConfig?.enabled;
  const iflowModels = iflowConfig?.models || IFLOW_DEFAULT_MODELS;

  // Track which phases are expanded (supports multiple open like Accordion type="multiple")
  const [openPhases, setOpenPhases] = useState<Set<string>>(new Set());
  const togglePhase = (phaseId: string) => {
    setOpenPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  // Default config for a phase
  const getDefaultConfig = (phaseId: string): PhaseConfig => ({
    provider: 'claude',
    model: 'sonnet',
    thinkingLevel: 'medium',
  });

  // Get config for a specific phase
  const getPhaseConfig = (phaseId: keyof PhaseModelConfig): PhaseConfig => {
    return phaseConfig?.[phaseId] || getDefaultConfig(phaseId);
  };

  // Update a specific phase config
  const updatePhase = (phaseId: keyof PhaseModelConfig, config: PhaseConfig) => {
    onPhaseConfigChange({
      ...phaseConfig,
      [phaseId]: config,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium text-foreground">
            {t('tasks:provider.perPhase.title')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t('tasks:provider.perPhase.description')}
          </p>
        </div>
        <Badge variant="outline">Advanced</Badge>
      </div>

      <div className="w-full space-y-1">
        {PHASES.map((phase) => {
          const config = getPhaseConfig(phase.id);
          const recommendation = TASK_MODEL_RECOMMENDATIONS[phase.taskType];
          const PhaseIcon = phase.icon;
          const isOpen = openPhases.has(phase.id);

          return (
            <Collapsible
              key={phase.id}
              open={isOpen}
              onOpenChange={() => togglePhase(phase.id)}
            >
              <div className="rounded-lg border border-border overflow-hidden">
                <CollapsibleTrigger
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-4 py-3 text-left',
                    'hover:bg-muted/50 transition-colors [&[data-state=open]>svg]:rotate-180'
                  )}
                  disabled={disabled}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <PhaseIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium">
                      {t(`tasks:provider.perPhase.${phase.id}`)}
                    </span>
                    <Badge variant="secondary" className="ml-2 text-xs shrink-0">
                      {config.provider === 'claude' ? 'Claude' : 'iFlow'} / {config.model}
                    </Badge>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-4 pt-2 pb-4 px-4 pl-6 border-t border-border">
                  {/* Phase description */}
                  <p className="text-xs text-muted-foreground">
                    {t(`tasks:provider.perPhase.${phase.id}Description`)}
                  </p>

                  {/* Provider Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm">{t('tasks:provider.perPhase.provider')}</Label>
                    <RadioGroup
                      value={config.provider}
                      onValueChange={(p) =>
                        updatePhase(phase.id, {
                          ...config,
                          provider: p as TaskProvider,
                          model: p === 'claude' ? 'sonnet' : 'deepseek-v3',
                        })
                      }
                      disabled={disabled}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="claude" id={`${phase.id}-claude`} />
                        <Label htmlFor={`${phase.id}-claude`} className="font-normal">
                          Claude
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="iflow"
                          id={`${phase.id}-iflow`}
                          disabled={!isIFlowEnabled}
                        />
                        <Label
                          htmlFor={`${phase.id}-iflow`}
                          className={`font-normal ${!isIFlowEnabled ? 'opacity-50' : ''}`}
                        >
                          iFlow
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Model Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm">{t('tasks:provider.perPhase.model')}</Label>

                    {config.provider === 'claude' ? (
                      <Select
                        value={config.model}
                        onValueChange={(m) => updatePhase(phase.id, { ...config, model: m })}
                        disabled={disabled}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CLAUDE_MODELS.map((model) => (
                            <SelectItem key={model.value} value={model.value}>
                              {model.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select
                        value={config.model}
                        onValueChange={(m) => updatePhase(phase.id, { ...config, model: m })}
                        disabled={disabled}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {iflowModels.map((model) => {
                            const isRecommended = recommendation?.model === model.id;
                            return (
                              <SelectItem key={model.id} value={model.id}>
                                <div className="flex items-center gap-2">
                                  <span>{model.name}</span>
                                  {isRecommended && (
                                    <Badge variant="default" className="text-xs">
                                      <Sparkles className="h-3 w-3 mr-1" />
                                      Recommended
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Recommendation hint for iFlow */}
                    {config.provider === 'iflow' && recommendation && (
                      <p className="text-xs text-muted-foreground">
                        {recommendation.reason}
                      </p>
                    )}
                  </div>

                  {/* Thinking Level (Claude only) */}
                  {config.provider === 'claude' && (
                    <div className="space-y-2">
                      <Label className="text-sm">
                        {t('tasks:provider.perPhase.thinkingLevel')}
                      </Label>
                      <Select
                        value={config.thinkingLevel || 'medium'}
                        onValueChange={(t) =>
                          updatePhase(phase.id, {
                            ...config,
                            thinkingLevel: t as ThinkingLevel,
                          })
                        }
                        disabled={disabled}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {THINKING_LEVELS.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

export default AdvancedPhaseSelector;
