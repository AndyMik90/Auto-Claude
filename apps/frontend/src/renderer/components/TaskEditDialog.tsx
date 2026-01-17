/**
 * TaskEditDialog - Dialog for editing task details
 *
 * Allows users to modify all task properties including title, description,
 * classification fields, images, and review settings.
 *
 * Now uses the shared TaskModalLayout for consistent styling with other task modals,
 * and TaskFormFields for the form content.
 *
 * Features:
 * - Pre-populates form with current task values
 * - Form validation (description required)
 * - Editable classification fields (category, priority, complexity, impact)
 * - Editable image attachments (add/remove images)
 * - Editable review settings (requireReviewBeforeCoding)
 * - Saves changes via persistUpdateTask (updates store + spec files)
 * - Prevents save when no changes have been made
 *
 * @example
 * ```tsx
 * <TaskEditDialog
 *   task={selectedTask}
 *   open={isEditDialogOpen}
 *   onOpenChange={setIsEditDialogOpen}
 *   onSaved={() => console.log('Task updated!')}
 * />
 * ```
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { TaskModalLayout } from './task-form/TaskModalLayout';
import { TaskFormFields } from './task-form/TaskFormFields';
import { type FileReferenceData } from './task-form/useImageUpload';
import { persistUpdateTask } from '../stores/task-store';
import type { Task, ImageAttachment, TaskCategory, TaskPriority, TaskComplexity, TaskImpact, ModelType, ThinkingLevel, IFlowConfig, PhaseConfig, PhaseModelConfig } from '../../shared/types';
import {
  DEFAULT_AGENT_PROFILES,
  DEFAULT_PHASE_MODELS,
  DEFAULT_PHASE_THINKING
} from '../../shared/constants';
import type { PhaseModelConfig as SettingsPhaseModelConfig, PhaseThinkingConfig } from '../../shared/types/settings';
import { useSettingsStore } from '../stores/settings-store';
import { useProjectStore } from '../stores/project-store';

/**
 * Props for the TaskEditDialog component
 */
interface TaskEditDialogProps {
  /** The task to edit */
  task: Task;
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when the dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Optional callback when task is successfully saved */
  onSaved?: () => void;
}

export function TaskEditDialog({ task, open, onOpenChange, onSaved }: TaskEditDialogProps) {
  const { t } = useTranslation(['tasks', 'common']);
  // Get selected agent profile from settings for defaults
  const { settings } = useSettingsStore();
  const selectedProfile = DEFAULT_AGENT_PROFILES.find(
    p => p.id === settings.selectedAgentProfile
  ) || DEFAULT_AGENT_PROFILES.find(p => p.id === 'auto')!;

  // Form state
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClassification, setShowClassification] = useState(false);

  // Classification fields
  const [category, setCategory] = useState<TaskCategory | ''>(task.metadata?.category || '');
  const [priority, setPriority] = useState<TaskPriority | ''>(task.metadata?.priority || '');
  const [complexity, setComplexity] = useState<TaskComplexity | ''>(task.metadata?.complexity || '');
  const [impact, setImpact] = useState<TaskImpact | ''>(task.metadata?.impact || '');

  // Agent profile / model configuration
  const [profileId, setProfileId] = useState<string>(() => {
    if (task.metadata?.isAutoProfile) {
      return 'auto';
    }
    const taskModel = task.metadata?.model;
    const taskThinking = task.metadata?.thinkingLevel;
    if (taskModel && taskThinking) {
      const matchingProfile = DEFAULT_AGENT_PROFILES.find(
        p => p.model === taskModel && p.thinkingLevel === taskThinking && !p.isAutoProfile
      );
      return matchingProfile?.id || 'custom';
    }
    return settings.selectedAgentProfile || 'auto';
  });
  const [model, setModel] = useState<ModelType | ''>(task.metadata?.model || selectedProfile.model);
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel | ''>(
    task.metadata?.thinkingLevel || selectedProfile.thinkingLevel
  );
  const [phaseModels, setPhaseModels] = useState<SettingsPhaseModelConfig | undefined>(() => {
    // task.metadata?.phaseModels can be either SettingsPhaseModelConfig or PhaseModelConfig
    // Only use it if it's SettingsPhaseModelConfig (legacy format)
    const taskPhaseModels = task.metadata?.phaseModels;
    if (taskPhaseModels && typeof taskPhaseModels === 'object') {
      const firstPhase = (taskPhaseModels as any).spec || (taskPhaseModels as any).planning || (taskPhaseModels as any).coding || (taskPhaseModels as any).qa;
      if (!firstPhase || typeof firstPhase === 'string' || !('provider' in firstPhase)) {
        // Legacy format (SettingsPhaseModelConfig)
        return taskPhaseModels as SettingsPhaseModelConfig;
      }
    }
    return selectedProfile.phaseModels || DEFAULT_PHASE_MODELS;
  });
  const [phaseThinking, setPhaseThinking] = useState<PhaseThinkingConfig | undefined>(
    task.metadata?.phaseThinking || selectedProfile.phaseThinking || DEFAULT_PHASE_THINKING
  );

  // iFlow configuration
  const [iflowConfig, setIflowConfig] = useState<IFlowConfig | undefined>(undefined);
  // Advanced phase configuration with provider support
  // Extract from task.metadata.phaseModels if it has provider field (PhaseConfig format)
  const [phaseConfig, setPhaseConfig] = useState<PhaseModelConfig | undefined>(() => {
    const taskPhaseModels = task.metadata?.phaseModels;
    if (taskPhaseModels && typeof taskPhaseModels === 'object') {
      // Check if it's PhaseConfig format (has provider field) or legacy format (just model strings)
      const firstPhase = (taskPhaseModels as any).spec || (taskPhaseModels as any).planning || (taskPhaseModels as any).coding || (taskPhaseModels as any).qa;
      if (firstPhase && typeof firstPhase === 'object' && 'provider' in firstPhase) {
        return taskPhaseModels as unknown as PhaseModelConfig;
      }
    }
    return undefined;
  });

  // Load iflowConfig when dialog opens
  useEffect(() => {
    const loadIFlowConfig = async () => {
      if (open && task.projectId) {
        try {
          const result = await window.electronAPI.getProjectEnv(task.projectId);
          if (result.success && result.data?.iflowConfig) {
            setIflowConfig(result.data.iflowConfig);
          }
        } catch (err) {
          console.error('Failed to load iFlow config:', err);
        }
      }
    };
    loadIFlowConfig();
  }, [open, task.projectId]);

  // Image attachments
  const [images, setImages] = useState<ImageAttachment[]>(task.metadata?.attachedImages || []);

  // Review setting
  const [requireReviewBeforeCoding, setRequireReviewBeforeCoding] = useState(
    task.metadata?.requireReviewBeforeCoding ?? false
  );

  // Reset form when task changes or dialog opens
  useEffect(() => {
    if (open) {
      setTitle(task.title);
      setDescription(task.description);
      setCategory(task.metadata?.category || '');
      setPriority(task.metadata?.priority || '');
      setComplexity(task.metadata?.complexity || '');
      setImpact(task.metadata?.impact || '');

      // Reset model configuration
      const taskModel = task.metadata?.model;
      const taskThinking = task.metadata?.thinkingLevel;
      const isAutoProfile = task.metadata?.isAutoProfile;

      if (isAutoProfile) {
        setProfileId('auto');
        setModel(taskModel || selectedProfile.model);
        setThinkingLevel(taskThinking || selectedProfile.thinkingLevel);
        // task.metadata?.phaseModels can be either SettingsPhaseModelConfig or PhaseModelConfig
        // Only use it if it's SettingsPhaseModelConfig (legacy format)
        const taskPhaseModels1 = task.metadata?.phaseModels;
        if (taskPhaseModels1 && typeof taskPhaseModels1 === 'object') {
          const firstPhase1 = (taskPhaseModels1 as any).spec || (taskPhaseModels1 as any).planning || (taskPhaseModels1 as any).coding || (taskPhaseModels1 as any).qa;
          if (!firstPhase1 || typeof firstPhase1 === 'string' || !('provider' in firstPhase1)) {
            // Legacy format (SettingsPhaseModelConfig)
            setPhaseModels(taskPhaseModels1 as SettingsPhaseModelConfig);
          } else {
            setPhaseModels(DEFAULT_PHASE_MODELS);
          }
        } else {
          setPhaseModels(DEFAULT_PHASE_MODELS);
        }
        setPhaseThinking(task.metadata?.phaseThinking || DEFAULT_PHASE_THINKING);
      } else if (taskModel && taskThinking) {
        const matchingProfile = DEFAULT_AGENT_PROFILES.find(
          p => p.model === taskModel && p.thinkingLevel === taskThinking && !p.isAutoProfile
        );
        setProfileId(matchingProfile?.id || 'custom');
        setModel(taskModel);
        setThinkingLevel(taskThinking);
        // task.metadata?.phaseModels can be either SettingsPhaseModelConfig or PhaseModelConfig
        // Only use it if it's SettingsPhaseModelConfig (legacy format)
        const taskPhaseModels2 = task.metadata?.phaseModels;
        if (taskPhaseModels2 && typeof taskPhaseModels2 === 'object') {
          const firstPhase2 = (taskPhaseModels2 as any).spec || (taskPhaseModels2 as any).planning || (taskPhaseModels2 as any).coding || (taskPhaseModels2 as any).qa;
          if (!firstPhase2 || typeof firstPhase2 === 'string' || !('provider' in firstPhase2)) {
            // Legacy format (SettingsPhaseModelConfig)
            setPhaseModels(taskPhaseModels2 as SettingsPhaseModelConfig);
          } else {
            setPhaseModels(DEFAULT_PHASE_MODELS);
          }
        } else {
          setPhaseModels(DEFAULT_PHASE_MODELS);
        }
        setPhaseThinking(task.metadata?.phaseThinking || DEFAULT_PHASE_THINKING);
      } else {
        setProfileId(settings.selectedAgentProfile || 'auto');
        setModel(selectedProfile.model);
        setThinkingLevel(selectedProfile.thinkingLevel);
        setPhaseModels(selectedProfile.phaseModels || DEFAULT_PHASE_MODELS);
        setPhaseThinking(selectedProfile.phaseThinking || DEFAULT_PHASE_THINKING);
      }

      setImages(task.metadata?.attachedImages || []);
      setRequireReviewBeforeCoding(task.metadata?.requireReviewBeforeCoding ?? false);
      setError(null);

      // Auto-expand classification if it has content
      if (task.metadata?.category || task.metadata?.priority || task.metadata?.complexity || task.metadata?.impact) {
        setShowClassification(true);
      } else {
        setShowClassification(false);
      }
    }
  }, [open, task, settings.selectedAgentProfile, selectedProfile.model, selectedProfile.thinkingLevel, selectedProfile.phaseModels, selectedProfile.phaseThinking]);

  /**
   * Handle file reference drop from FileTreeItem drag
   * Appends @filename to the end of the description (no textarea ref in edit dialog)
   */
  const handleFileReferenceDrop = useCallback((reference: string, _data: FileReferenceData) => {
    // Append to description using functional update to ensure latest state
    // This prevents stale closure issues with rapid consecutive drops
    setDescription(prev => {
      const separator = prev.endsWith(' ') || prev === '' ? '' : ' ';
      return prev + separator + reference + ' ';
    });
  }, []);

  const handleSave = async () => {
    // Validate input
    if (!description.trim()) {
      setError(t('tasks:form.errors.descriptionRequired'));
      return;
    }

    // Check if anything changed
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const hasChanges =
      trimmedTitle !== task.title ||
      trimmedDescription !== task.description ||
      category !== (task.metadata?.category || '') ||
      priority !== (task.metadata?.priority || '') ||
      complexity !== (task.metadata?.complexity || '') ||
      impact !== (task.metadata?.impact || '') ||
      model !== (task.metadata?.model || '') ||
      thinkingLevel !== (task.metadata?.thinkingLevel || '') ||
      requireReviewBeforeCoding !== (task.metadata?.requireReviewBeforeCoding ?? false) ||
      JSON.stringify(images) !== JSON.stringify(task.metadata?.attachedImages || []) ||
      JSON.stringify(phaseModels) !== JSON.stringify(task.metadata?.phaseModels || DEFAULT_PHASE_MODELS) ||
      JSON.stringify(phaseThinking) !== JSON.stringify(task.metadata?.phaseThinking || DEFAULT_PHASE_THINKING) ||
      JSON.stringify(phaseConfig) !== JSON.stringify(task.metadata?.phaseModels);

    if (!hasChanges) {
      onOpenChange(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    // Build metadata updates
    const metadataUpdates: Partial<typeof task.metadata> = {};
    if (category) metadataUpdates.category = category;
    if (priority) metadataUpdates.priority = priority;
    if (complexity) metadataUpdates.complexity = complexity;
    if (impact) metadataUpdates.impact = impact;
    
    // Use phaseConfig if provided (advanced mode with provider support)
    // Otherwise use legacy phaseModels/phaseThinking (Claude only)
    if (phaseConfig) {
      metadataUpdates.isAutoProfile = profileId === 'auto';
      metadataUpdates.phaseModels = phaseConfig;
      // Extract thinking levels from phaseConfig for backward compatibility
      const phaseThinkingFromConfig: Partial<PhaseThinkingConfig> = {};
      if (phaseConfig.spec?.thinkingLevel) phaseThinkingFromConfig.spec = phaseConfig.spec.thinkingLevel;
      if (phaseConfig.planning?.thinkingLevel) phaseThinkingFromConfig.planning = phaseConfig.planning.thinkingLevel;
      if (phaseConfig.coding?.thinkingLevel) phaseThinkingFromConfig.coding = phaseConfig.coding.thinkingLevel;
      if (phaseConfig.qa?.thinkingLevel) phaseThinkingFromConfig.qa = phaseConfig.qa.thinkingLevel;
      if (Object.keys(phaseThinkingFromConfig).length > 0) {
        metadataUpdates.phaseThinking = phaseThinkingFromConfig as PhaseThinkingConfig;
      }
    } else if (phaseModels && phaseThinking) {
      // Legacy mode: convert SettingsPhaseModelConfig (Claude models only) to PhaseModelConfig format
      metadataUpdates.isAutoProfile = profileId === 'auto';
      const convertedPhaseConfig: PhaseModelConfig = {};
      if (phaseModels.spec) {
        convertedPhaseConfig.spec = { provider: 'claude', model: phaseModels.spec, thinkingLevel: phaseThinking.spec };
      }
      if (phaseModels.planning) {
        convertedPhaseConfig.planning = { provider: 'claude', model: phaseModels.planning, thinkingLevel: phaseThinking.planning };
      }
      if (phaseModels.coding) {
        convertedPhaseConfig.coding = { provider: 'claude', model: phaseModels.coding, thinkingLevel: phaseThinking.coding };
      }
      if (phaseModels.qa) {
        convertedPhaseConfig.qa = { provider: 'claude', model: phaseModels.qa, thinkingLevel: phaseThinking.qa };
      }
      metadataUpdates.phaseModels = convertedPhaseConfig;
      metadataUpdates.phaseThinking = phaseThinking;
    } else {
      // Simple mode: single model/thinking level
      if (model) metadataUpdates.model = model as ModelType;
      if (thinkingLevel) metadataUpdates.thinkingLevel = thinkingLevel as ThinkingLevel;
    }
    // Always set attachedImages to persist removal when all images are deleted
    metadataUpdates.attachedImages = images.length > 0 ? images : [];
    metadataUpdates.requireReviewBeforeCoding = requireReviewBeforeCoding;

    const success = await persistUpdateTask(task.id, {
      title: trimmedTitle,
      description: trimmedDescription,
      metadata: metadataUpdates
    });

    if (success) {
      onOpenChange(false);
      onSaved?.();
    } else {
      setError(t('tasks:edit.errors.updateFailed'));
    }

    setIsSaving(false);
  };

  const isValid = description.trim().length > 0;

  return (
    <TaskModalLayout
      open={open}
      onOpenChange={onOpenChange}
      title={t('tasks:edit.title')}
      description={t('tasks:edit.description')}
      disabled={isSaving}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t('common:buttons.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !isValid}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('common:buttons.saving')}
              </>
            ) : (
              t('tasks:edit.saveChanges')
            )}
          </Button>
        </div>
      }
    >
      <TaskFormFields
        description={description}
        onDescriptionChange={setDescription}
        title={title}
        onTitleChange={setTitle}
        profileId={profileId}
        model={model}
        thinkingLevel={thinkingLevel}
        phaseModels={phaseModels}
        phaseThinking={phaseThinking}
        onProfileChange={(newProfileId, newModel, newThinkingLevel) => {
          setProfileId(newProfileId);
          setModel(newModel);
          setThinkingLevel(newThinkingLevel);
        }}
        onModelChange={setModel}
        onThinkingLevelChange={setThinkingLevel}
        onPhaseModelsChange={setPhaseModels}
        onPhaseThinkingChange={setPhaseThinking}
        iflowConfig={iflowConfig}
        phaseConfig={phaseConfig}
        onPhaseConfigChange={setPhaseConfig}
        category={category}
        priority={priority}
        complexity={complexity}
        impact={impact}
        onCategoryChange={setCategory}
        onPriorityChange={setPriority}
        onComplexityChange={setComplexity}
        onImpactChange={setImpact}
        showClassification={showClassification}
        onShowClassificationChange={setShowClassification}
        images={images}
        onImagesChange={setImages}
        requireReviewBeforeCoding={requireReviewBeforeCoding}
        onRequireReviewChange={setRequireReviewBeforeCoding}
        disabled={isSaving}
        error={error}
        onError={setError}
        onFileReferenceDrop={handleFileReferenceDrop}
        idPrefix="edit"
      />
    </TaskModalLayout>
  );
}
