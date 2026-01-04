import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Scale, Zap, Check, Sparkles, ChevronDown, ChevronUp, RotateCcw, Cloud, Server } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  DEFAULT_AGENT_PROFILES,
  OLLAMA_AGENT_PROFILES,
  CLAUDE_MODELS,
  OLLAMA_MODELS,
  AVAILABLE_MODELS,
  THINKING_LEVELS,
  DEFAULT_PHASE_MODELS,
  DEFAULT_PHASE_THINKING,
  isOllamaModel,
  getModelProvider,
} from '../../../shared/constants';
import { useSettingsStore, saveSettings } from '../../stores/settings-store';
import { SettingsSection } from './SettingsSection';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import type { AgentProfile, PhaseModelConfig, PhaseThinkingConfig, ModelTypeShort, ThinkingLevel } from '../../../shared/types/settings';

/**
 * Icon mapping for agent profile icons
 */
const iconMap: Record<string, React.ElementType> = {
  Brain,
  Scale,
  Zap,
  Sparkles,
  Server,
  Code: Brain, // Fallback for Code icon
};

const PHASE_KEYS: Array<keyof PhaseModelConfig> = ['spec', 'planning', 'coding', 'qa'];

/**
 * Agent Profile Settings component
 * Displays preset agent profiles for quick model/thinking level configuration
 * Supports both Claude (cloud) and Ollama (local) models
 */
export function AgentProfileSettings() {
  const { t } = useTranslation('settings');
  const settings = useSettingsStore((state) => state.settings);
  const selectedProfileId = settings.selectedAgentProfile || 'auto';
  const [showPhaseConfig, setShowPhaseConfig] = useState(selectedProfileId === 'auto');
  const [showOllamaProfiles, setShowOllamaProfiles] = useState(false);

  // Get current phase config from settings or defaults
  const currentPhaseModels: PhaseModelConfig = settings.customPhaseModels || DEFAULT_PHASE_MODELS;
  const currentPhaseThinking: PhaseThinkingConfig = settings.customPhaseThinking || DEFAULT_PHASE_THINKING;

  const handleSelectProfile = async (profileId: string) => {
    const success = await saveSettings({ selectedAgentProfile: profileId });
    if (!success) {
      console.error('Failed to save agent profile selection');
      return;
    }
    // Auto-expand phase config when Auto profile is selected
    if (profileId === 'auto') {
      setShowPhaseConfig(true);
    }
  };

  const handlePhaseModelChange = async (phase: keyof PhaseModelConfig, value: ModelTypeShort) => {
    const newPhaseModels = { ...currentPhaseModels, [phase]: value };
    await saveSettings({ customPhaseModels: newPhaseModels });
  };

  const handlePhaseThinkingChange = async (phase: keyof PhaseThinkingConfig, value: ThinkingLevel) => {
    const newPhaseThinking = { ...currentPhaseThinking, [phase]: value };
    await saveSettings({ customPhaseThinking: newPhaseThinking });
  };

  const handleResetToDefaults = async () => {
    await saveSettings({
      customPhaseModels: DEFAULT_PHASE_MODELS,
      customPhaseThinking: DEFAULT_PHASE_THINKING
    });
  };

  /**
   * Get human-readable model label
   */
  const getModelLabel = (modelValue: string): string => {
    const model = AVAILABLE_MODELS.find((m) => m.value === modelValue);
    return model?.label || modelValue;
  };

  /**
   * Get human-readable thinking level label
   */
  const getThinkingLabel = (thinkingValue: string): string => {
    const level = THINKING_LEVELS.find((l) => l.value === thinkingValue);
    return level?.label || thinkingValue;
  };

  /**
   * Check if current phase config differs from defaults
   */
  const hasCustomConfig = (): boolean => {
    return PHASE_KEYS.some(
      phase =>
        currentPhaseModels[phase] !== DEFAULT_PHASE_MODELS[phase] ||
        currentPhaseThinking[phase] !== DEFAULT_PHASE_THINKING[phase]
    );
  };

  /**
   * Check if any phase uses Ollama models
   */
  const hasOllamaModels = (): boolean => {
    return PHASE_KEYS.some(phase => isOllamaModel(currentPhaseModels[phase]));
  };

  /**
   * Render provider badge for a model
   */
  const renderProviderBadge = (modelValue: string) => {
    const isOllama = isOllamaModel(modelValue);
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium",
        isOllama ? "bg-blue-500/10 text-blue-600" : "bg-orange-500/10 text-orange-600"
      )}>
        {isOllama ? <Server className="h-2.5 w-2.5" /> : <Cloud className="h-2.5 w-2.5" />}
        {isOllama ? 'Local' : 'Cloud'}
      </span>
    );
  };

  /**
   * Render a single profile card
   */
  const renderProfileCard = (profile: AgentProfile, isOllamaProfile: boolean = false) => {
    const isSelected = selectedProfileId === profile.id;
    const Icon = iconMap[profile.icon || 'Brain'] || Brain;

    return (
      <button
        key={profile.id}
        onClick={() => handleSelectProfile(profile.id)}
        className={cn(
          'relative w-full rounded-lg border p-4 text-left transition-all duration-200',
          'hover:border-primary/50 hover:shadow-sm',
          isSelected
            ? 'border-primary bg-primary/5'
            : 'border-border bg-card',
          isOllamaProfile && 'border-blue-500/20'
        )}
      >
        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}

        {/* Provider badge */}
        <div className="absolute right-3 top-3">
          {!isSelected && renderProviderBadge(profile.model)}
        </div>

        {/* Profile content */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg shrink-0',
              isSelected ? 'bg-primary/10' : isOllamaProfile ? 'bg-blue-500/10' : 'bg-muted'
            )}
          >
            <Icon
              className={cn(
                'h-5 w-5',
                isSelected ? 'text-primary' : isOllamaProfile ? 'text-blue-500' : 'text-muted-foreground'
              )}
            />
          </div>

          <div className="flex-1 min-w-0 pr-8">
            <h3 className="font-medium text-sm text-foreground">{profile.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {profile.description}
            </p>

            {/* Model and thinking level badges */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {getModelLabel(profile.model)}
              </span>
              <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {getThinkingLabel(profile.thinkingLevel)} {t('agentProfile.thinking')}
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  };

  /**
   * Render model select with grouped Claude and Ollama options
   */
  const renderModelSelect = (
    phase: keyof PhaseModelConfig,
    value: string,
    onChange: (value: ModelTypeShort) => void
  ) => {
    const currentProvider = getModelProvider(value);

    return (
      <Select
        value={value}
        onValueChange={(v) => onChange(v as ModelTypeShort)}
      >
        <SelectTrigger className="h-9">
          <div className="flex items-center gap-2">
            {currentProvider === 'ollama' ? (
              <Server className="h-3 w-3 text-blue-500" />
            ) : (
              <Cloud className="h-3 w-3 text-orange-500" />
            )}
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {/* Claude Models Group */}
          <SelectGroup>
            <SelectLabel className="flex items-center gap-2 text-orange-600">
              <Cloud className="h-3 w-3" />
              Claude (Cloud)
            </SelectLabel>
            {CLAUDE_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectGroup>

          <SelectSeparator />

          {/* Ollama Models Group */}
          <SelectGroup>
            <SelectLabel className="flex items-center gap-2 text-blue-600">
              <Server className="h-3 w-3" />
              Ollama (Local)
            </SelectLabel>
            {OLLAMA_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  };

  return (
    <SettingsSection
      title={t('agentProfile.title')}
      description={t('agentProfile.sectionDescription')}
    >
      <div className="space-y-4">
        {/* Description */}
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">
            {t('agentProfile.profilesInfo')}
          </p>
        </div>

        {/* Claude Profile cards - 2 column grid on larger screens */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Cloud className="h-4 w-4 text-orange-500" />
            <h4 className="text-sm font-medium">Claude Profiles (Cloud)</h4>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {DEFAULT_AGENT_PROFILES.map((profile) => renderProfileCard(profile, false))}
          </div>
        </div>

        {/* Ollama Profile cards */}
        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setShowOllamaProfiles(!showOllamaProfiles)}
            className="flex w-full items-center justify-between mb-3"
          >
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-500" />
              <h4 className="text-sm font-medium">Ollama Profiles (Local)</h4>
              <span className="text-xs text-muted-foreground">(requires Ollama running)</span>
            </div>
            {showOllamaProfiles ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {showOllamaProfiles && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {OLLAMA_AGENT_PROFILES.map((profile) => renderProfileCard(profile, true))}
            </div>
          )}
        </div>

        {/* Phase Configuration (only for Auto profile) */}
        {selectedProfileId === 'auto' && (
          <div className="mt-6 rounded-lg border border-border bg-card">
            {/* Header - Collapsible */}
            <button
              type="button"
              onClick={() => setShowPhaseConfig(!showPhaseConfig)}
              className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors rounded-t-lg"
            >
              <div>
                <h4 className="font-medium text-sm text-foreground">{t('agentProfile.phaseConfiguration')}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('agentProfile.phaseConfigurationDescription')}
                </p>
                {hasOllamaModels() && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-blue-600">
                    <Server className="h-3 w-3" />
                    Using local models for some phases
                  </span>
                )}
              </div>
              {showPhaseConfig ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {/* Phase Configuration Content */}
            {showPhaseConfig && (
              <div className="border-t border-border p-4 space-y-4">
                {/* Reset button */}
                {hasCustomConfig() && (
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetToDefaults}
                      className="text-xs h-7"
                    >
                      <RotateCcw className="h-3 w-3 mr-1.5" />
                      {t('agentProfile.resetToDefaults')}
                    </Button>
                  </div>
                )}

                {/* Phase Configuration Grid */}
                <div className="space-y-4">
                  {PHASE_KEYS.map((phase) => (
                    <div key={phase} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium text-foreground">
                          {t(`agentProfile.phases.${phase}.label`)}
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          {t(`agentProfile.phases.${phase}.description`)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Model Select with Provider Groups */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t('agentProfile.model')}</Label>
                          {renderModelSelect(
                            phase,
                            currentPhaseModels[phase],
                            (value) => handlePhaseModelChange(phase, value)
                          )}
                        </div>
                        {/* Thinking Level Select */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t('agentProfile.thinkingLevel')}</Label>
                          <Select
                            value={currentPhaseThinking[phase]}
                            onValueChange={(value) => handlePhaseThinkingChange(phase, value as ThinkingLevel)}
                          >
                            <SelectTrigger className="h-9">
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
                      </div>
                    </div>
                  ))}
                </div>

                {/* Info note */}
                <div className="mt-4 pt-3 border-t border-border space-y-2">
                  <p className="text-[10px] text-muted-foreground">
                    {t('agentProfile.phaseConfigNote')}
                  </p>
                  <div className="flex items-center gap-4 text-[10px]">
                    <span className="flex items-center gap-1 text-orange-600">
                      <Cloud className="h-3 w-3" />
                      Cloud = Claude API (requires internet)
                    </span>
                    <span className="flex items-center gap-1 text-blue-600">
                      <Server className="h-3 w-3" />
                      Local = Ollama (runs on your hardware)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </SettingsSection>
  );
}
