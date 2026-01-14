/**
 * CondaSetupWizard - Stepper wizard dialog for Conda environment setup
 *
 * Displays a multi-step wizard with progress tracking for setting up
 * an isolated Python conda environment (either app-level or project-level).
 *
 * Features:
 * - Vertical stepper with step states (pending, in_progress, completed, error)
 * - Expandable log panels for each step
 * - Continue in background / Cancel / Retry actions
 * - i18n support via settings:condaSetup namespace
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, AlertCircle, ChevronDown, Circle, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { cn } from '../../lib/utils';
import { useCondaSetup, type CondaSetupLogEntry } from '../../hooks/useCondaSetup';

export interface CondaSetupWizardProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when the dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Type of setup: 'app' for app-level or 'project' for project-level */
  type: 'app' | 'project';
  /** Path to the project (required when type is 'project') */
  projectPath?: string;
  /** Display name for the project */
  projectName?: string;
  /** Python version to install (e.g., '3.12'). If not provided, auto-detects from project files */
  pythonVersion?: string;
  /** Callback when setup completes successfully */
  onComplete?: () => void;
}

type StepStatus = 'pending' | 'in_progress' | 'completed' | 'error';

interface StepInfo {
  id: string;
  labelKey: string;
  labelParams?: Record<string, string>;
}

// Base steps without dynamic parameters
const BASE_SETUP_STEPS: StepInfo[] = [
  { id: 'detecting', labelKey: 'settings:condaSetup.steps.detecting' },
  { id: 'analyzing', labelKey: 'settings:condaSetup.steps.analyzing' },
  { id: 'creating', labelKey: 'settings:condaSetup.steps.creating' },
  { id: 'installing-python', labelKey: 'settings:condaSetup.steps.installingPython' },
  { id: 'verifying-python', labelKey: 'settings:condaSetup.steps.verifyingPython' },
  { id: 'installing-deps', labelKey: 'settings:condaSetup.steps.installingDeps' },
  { id: 'generating-scripts', labelKey: 'settings:condaSetup.steps.generatingScripts' },
  { id: 'finalizing', labelKey: 'settings:condaSetup.steps.finalizing' },
  { id: 'complete', labelKey: 'settings:condaSetup.steps.complete' }
];

// Helper to build steps with dynamic Python version
function buildSetupSteps(version: string): StepInfo[] {
  return BASE_SETUP_STEPS.map(step =>
    step.id === 'installing-python'
      ? { ...step, labelParams: { version } }
      : step
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'in_progress':
      return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-destructive" />;
    default:
      return <Circle className="h-5 w-5 text-muted-foreground/50" />;
  }
}

function getStepStatus(stepIndex: number, currentStep: number, hasError: boolean, isComplete: boolean): StepStatus {
  if (hasError && stepIndex === currentStep) {
    return 'error';
  }
  // When setup is complete, all steps including the last one should show as completed
  if (isComplete) {
    return 'completed';
  }
  if (stepIndex < currentStep) {
    return 'completed';
  }
  if (stepIndex === currentStep) {
    return 'in_progress';
  }
  return 'pending';
}

export function CondaSetupWizard({
  open,
  onOpenChange,
  type,
  projectPath,
  projectName,
  pythonVersion,
  onComplete
}: CondaSetupWizardProps) {
  const { t } = useTranslation(['settings', 'common']);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  // Build steps with the selected Python version
  const setupSteps = useMemo(
    () => buildSetupSteps(pythonVersion || '3.12'),
    [pythonVersion]
  );

  const {
    step,
    progress,
    logs,
    isRunning,
    error,
    startSetup,
    cancelSetup
  } = useCondaSetup({ type, projectPath, projectName, pythonVersion });

  // Convert step string to index
  const stepIndex = setupSteps.findIndex(s => s.id === step);
  const currentStepIndex = stepIndex >= 0 ? stepIndex : 0;

  // Auto-start setup when dialog opens
  useEffect(() => {
    if (open && !isRunning && step === 'detecting' && !error) {
      startSetup();
    }
  }, [open, isRunning, step, error, startSetup]);

  // Call onComplete when setup finishes successfully
  useEffect(() => {
    if (step === 'complete' && !error && !isRunning) {
      onComplete?.();
    }
  }, [step, error, isRunning, onComplete]);

  // Auto-expand current step
  useEffect(() => {
    if (isRunning && step) {
      setExpandedSteps(prev => new Set(prev).add(step));
    }
  }, [step, isRunning]);

  const toggleStepExpanded = useCallback((stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }, []);

  const handleContinueInBackground = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleCancel = useCallback(() => {
    cancelSetup();
    onOpenChange(false);
  }, [cancelSetup, onOpenChange]);

  const handleRetry = useCallback(() => {
    startSetup();
  }, [startSetup]);

  const handleClose = useCallback((openState: boolean) => {
    // Only allow closing if not running or if explicitly requested
    if (!isRunning || !openState) {
      onOpenChange(openState);
    }
  }, [isRunning, onOpenChange]);

  // Determine which steps to show (hide deps step if no requirements file)
  const visibleSteps = setupSteps.filter(_stepInfo => {
    // Always show all steps for now; the hook will skip steps internally if needed
    return true;
  });

  const isComplete = step === 'complete' && !error;
  const hasError = !!error;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="w-[min(92vw,560px)] max-h-[85vh] overflow-hidden flex flex-col"
        data-testid="conda-setup-wizard"
      >
        <DialogHeader>
          <DialogTitle>
            {t('settings:condaSetup.title')}
            {projectName && (
              <span className="text-muted-foreground font-normal ml-2">
                - {projectName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Stepper Container */}
        <div className="flex-1 overflow-y-auto py-4 -mx-2 px-2">
          <div className="space-y-1">
            {visibleSteps.map((stepInfo, index) => {
              const status = getStepStatus(index, currentStepIndex, hasError, isComplete);
              // Filter logs for this step
              const stepLogs = logs.filter(log => log.step === stepInfo.id);
              const hasLogs = stepLogs.length > 0;
              const isExpanded = expandedSteps.has(stepInfo.id);
              const isCurrentStep = stepInfo.id === step;

              // Get label with interpolation
              const label = stepInfo.labelParams
                ? t(stepInfo.labelKey, stepInfo.labelParams)
                : t(stepInfo.labelKey);

              return (
                <div
                  key={stepInfo.id}
                  className={cn(
                    'rounded-lg transition-all duration-200',
                    isCurrentStep && !hasError && 'bg-accent/50',
                    status === 'error' && 'bg-destructive/10'
                  )}
                >
                  <Collapsible
                    open={isExpanded && hasLogs}
                    onOpenChange={() => hasLogs && toggleStepExpanded(stepInfo.id)}
                  >
                    {/* Step Header */}
                    <div
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5',
                        hasLogs && 'cursor-pointer hover:bg-accent/30 rounded-lg'
                      )}
                      onClick={() => hasLogs && toggleStepExpanded(stepInfo.id)}
                    >
                      {/* Step indicator line connector */}
                      <div className="flex flex-col items-center">
                        <StepIcon status={status} />
                        {index < visibleSteps.length - 1 && (
                          <div
                            className={cn(
                              'w-0.5 h-4 mt-1 transition-colors duration-200',
                              status === 'completed' ? 'bg-green-500/50' : 'bg-muted-foreground/20'
                            )}
                          />
                        )}
                      </div>

                      {/* Step label */}
                      <div className="flex-1 min-w-0">
                        <span
                          className={cn(
                            'text-sm font-medium transition-colors duration-200',
                            status === 'completed' && 'text-muted-foreground',
                            status === 'in_progress' && 'text-foreground',
                            status === 'error' && 'text-destructive',
                            status === 'pending' && 'text-muted-foreground/60'
                          )}
                        >
                          {label}
                        </span>
                        {status === 'error' && error && (
                          <p className="text-xs text-destructive mt-0.5 line-clamp-2">
                            {error}
                          </p>
                        )}
                      </div>

                      {/* Expand/collapse indicator */}
                      {hasLogs && (
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-transparent"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStepExpanded(stepInfo.id);
                            }}
                          >
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 text-muted-foreground transition-transform duration-200',
                                isExpanded && 'rotate-180'
                              )}
                            />
                            <span className="sr-only">
                              {isExpanded
                                ? t('settings:condaSetup.hideLogs')
                                : t('settings:condaSetup.showLogs')}
                            </span>
                          </Button>
                        </CollapsibleTrigger>
                      )}
                    </div>

                    {/* Collapsible Log Panel */}
                    <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                      <div className="ml-8 mr-3 mb-2 mt-1">
                        <div
                          className={cn(
                            'bg-muted/50 rounded-md p-2 max-h-32 overflow-y-auto',
                            'font-mono text-xs leading-relaxed',
                            'border border-border/50'
                          )}
                        >
                          {stepLogs.map((log: CondaSetupLogEntry, logIndex: number) => (
                            <div
                              key={logIndex}
                              className="whitespace-pre-wrap break-all text-muted-foreground"
                            >
                              {log.message}
                              {log.detail && (
                                <span className="block mt-0.5 text-xs opacity-70">{log.detail}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress bar */}
        {isRunning && (
          <div className="h-1 bg-muted rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          {hasError ? (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
              >
                {t('settings:condaSetup.cancel')}
              </Button>
              <Button
                variant="default"
                onClick={handleRetry}
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                {t('settings:condaSetup.retry')}
              </Button>
            </>
          ) : isComplete ? (
            <Button
              variant="default"
              onClick={() => onOpenChange(false)}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {t('common:downloads.done')}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={!isRunning}
              >
                {t('settings:condaSetup.cancel')}
              </Button>
              <Button
                variant="secondary"
                onClick={handleContinueInBackground}
                disabled={!isRunning}
              >
                {t('settings:condaSetup.continueInBackground')}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
