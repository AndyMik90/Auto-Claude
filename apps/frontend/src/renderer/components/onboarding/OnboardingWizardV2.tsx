/**
 * OnboardingWizard V2 - Schema-Based Auto-Discovery Wizard
 *
 * This wizard automatically adapts to new steps added to the registry.
 * When a new feature is added:
 * 1. Create the step component
 * 2. Add it to wizard-registry.ts
 * 3. The wizard automatically includes it - no other changes needed!
 *
 * Features:
 * - Auto-discovery of steps from registry
 * - Lazy loading of step components
 * - Condition-based step filtering
 * - Progress persistence
 * - Full i18n support
 */

import { useState, useCallback, Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Wand2, Loader2 } from 'lucide-react';
import {
  FullScreenDialog,
  FullScreenDialogContent,
  FullScreenDialogHeader,
  FullScreenDialogBody,
  FullScreenDialogTitle,
  FullScreenDialogDescription
} from '../ui/full-screen-dialog';
import { ScrollArea } from '../ui/scroll-area';
import { WizardProgress, WizardStep } from './WizardProgress';
import { useSettingsStore } from '../../stores/settings-store';
import { getActiveSteps, getProgressSteps } from './wizard-registry';
import type { WizardStepDefinition, StepConditionContext } from './wizard-step.schema';

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenTaskCreator?: () => void;
  onOpenSettings?: () => void;
  /** Optional feature flags for conditional steps */
  featureFlags?: Record<string, boolean>;
}

/**
 * Loading fallback for lazy-loaded step components
 */
function StepLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

/**
 * Main onboarding wizard component (V2 - Registry-based)
 *
 * This version automatically discovers and renders steps from the registry.
 * Adding new steps only requires adding them to wizard-registry.ts.
 */
export function OnboardingWizardV2({
  open,
  onOpenChange,
  onOpenTaskCreator,
  onOpenSettings,
  featureFlags = {}
}: OnboardingWizardProps) {
  const { t } = useTranslation('onboarding');
  const { updateSettings, ...settings } = useSettingsStore();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  // Build condition context from current state
  const conditionContext: Partial<StepConditionContext> = useMemo(() => ({
    settings: settings as Record<string, unknown>,
    features: featureFlags,
    isDev: import.meta.env?.DEV ?? false,
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown'
  }), [settings, featureFlags]);

  // Get active steps from registry (filtered by conditions)
  const activeSteps = useMemo(
    () => getActiveSteps(conditionContext),
    [conditionContext]
  );

  // Get steps for progress indicator
  const progressSteps = useMemo(
    () => getProgressSteps(conditionContext),
    [conditionContext]
  );

  // Current step
  const currentStep: WizardStepDefinition | undefined = activeSteps[currentStepIndex];
  const currentStepId = currentStep?.id ?? 'unknown';

  // Check if current step should show in progress
  const showProgress = currentStep?.showInProgress ?? false;

  // Build step data for progress indicator
  const wizardProgressSteps: WizardStep[] = useMemo(() => {
    // Find current step's index in progress steps
    const currentProgressIndex = progressSteps.findIndex(s => s.id === currentStepId);

    return progressSteps.map((step, index) => ({
      id: step.id,
      label: t(step.translationKey),
      completed: completedSteps.has(step.id) || index < currentProgressIndex
    }));
  }, [progressSteps, currentStepId, completedSteps, t]);

  // Current progress step index (for the progress bar)
  const currentProgressStepIndex = progressSteps.findIndex(s => s.id === currentStepId);

  // Navigation handlers
  const goToNextStep = useCallback(() => {
    // Mark current step as completed
    setCompletedSteps(prev => new Set(prev).add(currentStepId));

    if (currentStepIndex < activeSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [currentStepIndex, currentStepId, activeSteps.length]);

  const goToPreviousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  // Reset wizard state
  const resetWizard = useCallback(() => {
    setCurrentStepIndex(0);
    setCompletedSteps(new Set());
  }, []);

  const skipWizard = useCallback(async () => {
    try {
      const result = await window.electronAPI.saveSettings({ onboardingCompleted: true });
      if (!result?.success) {
        console.error('Failed to save onboarding completion:', result?.error);
      }
    } catch (err) {
      console.error('Error saving onboarding completion:', err);
    }
    updateSettings({ onboardingCompleted: true });
    onOpenChange(false);
    resetWizard();
  }, [updateSettings, onOpenChange, resetWizard]);

  const finishWizard = useCallback(async () => {
    try {
      const result = await window.electronAPI.saveSettings({ onboardingCompleted: true });
      if (!result?.success) {
        console.error('Failed to save onboarding completion:', result?.error);
      }
    } catch (err) {
      console.error('Error saving onboarding completion:', err);
    }
    updateSettings({ onboardingCompleted: true });
    onOpenChange(false);
    resetWizard();
  }, [updateSettings, onOpenChange, resetWizard]);

  // Handle opening task creator
  const handleOpenTaskCreator = useCallback(() => {
    if (onOpenTaskCreator) {
      onOpenChange(false);
      onOpenTaskCreator();
    }
  }, [onOpenTaskCreator, onOpenChange]);

  // Handle opening settings
  const handleOpenSettings = useCallback(() => {
    if (onOpenSettings) {
      finishWizard();
      onOpenSettings();
    }
  }, [onOpenSettings, finishWizard]);

  // Render current step content using lazy loading
  const renderStepContent = () => {
    if (!currentStep) {
      return (
        <div className="text-center text-muted-foreground">
          {t('wizard.noSteps', 'No steps available')}
        </div>
      );
    }

    const StepComponent = currentStep.component;
    const isFirstStep = currentStepIndex === 0;
    const isLastStep = currentStepIndex === activeSteps.length - 1;

    // Build props based on step category
    const stepProps = {
      onNext: goToNextStep,
      onBack: goToPreviousStep,
      onSkip: currentStep.skippable !== false ? skipWizard : undefined,
      onFinish: isLastStep ? finishWizard : undefined,
      onOpenTaskCreator: handleOpenTaskCreator,
      onOpenSettings: handleOpenSettings,
      isFirstStep,
      isLastStep
    };

    // Special handling for welcome step (uses onGetStarted instead of onNext)
    if (currentStep.category === 'welcome') {
      return (
        <Suspense fallback={<StepLoadingFallback />}>
          <StepComponent
            {...stepProps}
            // WelcomeStep expects onGetStarted
            {...({ onGetStarted: goToNextStep } as any)}
          />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<StepLoadingFallback />}>
        <StepComponent {...stepProps} />
      </Suspense>
    );
  };

  // Handle dialog close
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      skipWizard();
    } else {
      onOpenChange(newOpen);
    }
  }, [skipWizard, onOpenChange]);

  return (
    <FullScreenDialog open={open} onOpenChange={handleOpenChange}>
      <FullScreenDialogContent>
        <FullScreenDialogHeader>
          <FullScreenDialogTitle className="flex items-center gap-3">
            <Wand2 className="h-6 w-6" />
            {t('wizard.title')}
          </FullScreenDialogTitle>
          <FullScreenDialogDescription>
            {t('wizard.description')}
          </FullScreenDialogDescription>

          {/* Progress indicator - only show for steps marked showInProgress */}
          {showProgress && wizardProgressSteps.length > 0 && (
            <div className="mt-6">
              <WizardProgress
                currentStep={currentProgressStepIndex >= 0 ? currentProgressStepIndex : 0}
                steps={wizardProgressSteps}
              />
            </div>
          )}
        </FullScreenDialogHeader>

        <FullScreenDialogBody>
          <ScrollArea className="h-full">
            {renderStepContent()}
          </ScrollArea>
        </FullScreenDialogBody>
      </FullScreenDialogContent>
    </FullScreenDialog>
  );
}

// Re-export as default for easy migration
export default OnboardingWizardV2;
