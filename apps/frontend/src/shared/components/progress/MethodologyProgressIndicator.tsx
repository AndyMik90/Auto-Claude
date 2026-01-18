/**
 * Methodology-Aware Progress Indicator Component
 *
 * Displays phase-based progress for different methodologies (Native, BMAD).
 * Adapts to show the correct phases based on the active methodology and complexity level.
 *
 * Features:
 * - Phase steps with status colors (pending, active, completed, skipped, failed)
 * - Animated progress bar with methodology-specific phases
 * - Support for Quick/Standard/Complex complexity levels
 * - Performance optimization with IntersectionObserver
 * - Full i18n support
 *
 * @module components/progress/MethodologyProgressIndicator
 */

import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { memo, useRef, useState, useEffect, useMemo } from 'react';
import { CheckIcon } from 'lucide-react';
import { cn } from '../../../renderer/lib/utils';
import {
  type MethodologyPhaseConfig,
  type MethodologyPhaseProgress,
  type MethodologyPhaseStatus,
  getMethodologyConfig,
  getEnabledPhases,
  calculateOverallProgress,
  getCurrentPhase,
  isMethodologyComplete,
  hasMethodologyFailed,
} from '../../types/methodology-phases';

/**
 * Props for MethodologyProgressIndicator
 */
export interface MethodologyProgressIndicatorProps {
  /** Methodology identifier ('native' or 'bmad') */
  methodologyId: string;
  /** Array of phase progress states */
  phaseProgress: MethodologyPhaseProgress[];
  /** Complexity level for phase filtering */
  complexity?: 'quick' | 'standard' | 'complex';
  /** Whether the task is currently running */
  isRunning?: boolean;
  /** Whether the task is stuck/interrupted */
  isStuck?: boolean;
  /** Show compact view (fewer details) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when overall progress changes */
  onProgressChange?: (progress: number) => void;
}

/**
 * Status color mapping for phase steps
 */
const STATUS_COLORS: Record<MethodologyPhaseStatus, { dot: string; bg: string; text: string }> = {
  pending: {
    dot: 'bg-muted-foreground/30',
    bg: 'bg-muted',
    text: 'text-muted-foreground',
  },
  active: {
    dot: 'bg-primary',
    bg: 'bg-primary/10',
    text: 'text-primary',
  },
  completed: {
    dot: 'bg-success',
    bg: 'bg-success/10',
    text: 'text-success',
  },
  skipped: {
    dot: 'bg-muted-foreground/50',
    bg: 'bg-muted/50',
    text: 'text-muted-foreground',
  },
  failed: {
    dot: 'bg-destructive',
    bg: 'bg-destructive/10',
    text: 'text-destructive',
  },
};

/**
 * Get the status of a phase from the progress array
 */
function getPhaseStatus(
  phaseId: string,
  phaseProgress: MethodologyPhaseProgress[],
  enabledPhases: MethodologyPhaseConfig[],
  isSkipped: boolean
): MethodologyPhaseStatus {
  if (isSkipped) return 'skipped';

  const progress = phaseProgress.find((pp) => pp.phaseId === phaseId);
  if (progress) return progress.status;

  // Check if any later phase is active/completed - means this phase is done
  const phaseConfig = enabledPhases.find((p) => p.id === phaseId);
  if (!phaseConfig) return 'pending';

  const laterActiveOrComplete = phaseProgress.some((pp) => {
    const otherConfig = enabledPhases.find((p) => p.id === pp.phaseId);
    return (
      otherConfig &&
      otherConfig.order > phaseConfig.order &&
      (pp.status === 'active' || pp.status === 'completed')
    );
  });

  return laterActiveOrComplete ? 'completed' : 'pending';
}

/**
 * Methodology-aware progress indicator that shows phase-specific progress
 *
 * @example
 * ```tsx
 * <MethodologyProgressIndicator
 *   methodologyId="bmad"
 *   phaseProgress={[
 *     { phaseId: 'analyze', status: 'completed', progress: 100 },
 *     { phaseId: 'prd', status: 'active', progress: 45 },
 *   ]}
 *   complexity="standard"
 *   isRunning
 * />
 * ```
 */
export const MethodologyProgressIndicator = memo(function MethodologyProgressIndicator({
  methodologyId,
  phaseProgress,
  complexity = 'standard',
  isRunning = false,
  isStuck = false,
  compact = false,
  className,
  onProgressChange,
}: MethodologyProgressIndicatorProps) {
  const { t } = useTranslation(['tasks', 'artifacts']);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const prevVisibleRef = useRef(true);

  // Get methodology configuration
  const methodologyConfig = useMemo(
    () => getMethodologyConfig(methodologyId),
    [methodologyId]
  );

  // Get enabled phases for current complexity
  const enabledPhases = useMemo(
    () => getEnabledPhases(methodologyId, complexity),
    [methodologyId, complexity]
  );

  // Get all phases to determine which are skipped
  const allPhases = methodologyConfig?.phases || [];
  const skippedPhaseIds = useMemo(() => {
    const skips = methodologyConfig?.complexitySkips?.[complexity] || [];
    return new Set(skips);
  }, [methodologyConfig, complexity]);

  // Calculate overall progress
  const overallProgress = useMemo(
    () => calculateOverallProgress(methodologyId, phaseProgress, complexity),
    [methodologyId, phaseProgress, complexity]
  );

  // Get current active phase
  const currentPhase = useMemo(() => getCurrentPhase(phaseProgress), [phaseProgress]);

  // Check completion/failure states
  const isComplete = useMemo(
    () => isMethodologyComplete(methodologyId, phaseProgress, complexity),
    [methodologyId, phaseProgress, complexity]
  );
  const hasFailed = useMemo(() => hasMethodologyFailed(phaseProgress), [phaseProgress]);

  // Notify parent of progress changes
  useEffect(() => {
    onProgressChange?.(overallProgress);
  }, [overallProgress, onProgressChange]);

  // Use IntersectionObserver to pause animations when not visible
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const nowVisible = entry.isIntersecting;

        if (prevVisibleRef.current !== nowVisible && window.DEBUG) {
          console.log(
            `[MethodologyProgress] Visibility changed: ${prevVisibleRef.current} -> ${nowVisible}, animations ${nowVisible ? 'resumed' : 'paused'}`
          );
        }

        prevVisibleRef.current = nowVisible;
        setIsVisible(nowVisible);
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Only animate when visible and running
  const shouldAnimate = isVisible && isRunning && !isStuck;

  // Fallback if methodology not found
  if (!methodologyConfig) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        {t('common:errors.unknownMethodology', { id: methodologyId })}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('space-y-2', className)}>
      {/* Progress header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {isStuck
              ? t('tasks:execution.labels.interrupted')
              : currentPhase
                ? t(
                    enabledPhases.find((p) => p.id === currentPhase.phaseId)?.labelKey ||
                      'tasks:execution.labels.progress'
                  )
                : isComplete
                  ? t('tasks:execution.phases.complete')
                  : hasFailed
                    ? t('tasks:execution.phases.failed')
                    : t('tasks:execution.labels.progress')}
          </span>
          {/* Activity indicator dot */}
          {isRunning && !isStuck && !isComplete && !hasFailed && (
            <motion.div
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                currentPhase
                  ? enabledPhases.find((p) => p.id === currentPhase.phaseId)?.color || 'bg-primary'
                  : 'bg-primary'
              )}
              animate={
                shouldAnimate
                  ? {
                      scale: [1, 1.5, 1],
                      opacity: [1, 0.5, 1],
                    }
                  : { scale: 1, opacity: 1 }
              }
              transition={
                shouldAnimate
                  ? {
                      duration: 1,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }
                  : undefined
              }
            />
          )}
        </div>
        <span className="text-xs font-medium text-foreground">{overallProgress}%</span>
      </div>

      {/* Progress bar */}
      <div
        className={cn(
          'relative h-1.5 w-full overflow-hidden rounded-full',
          isStuck ? 'bg-warning/20' : hasFailed ? 'bg-destructive/20' : 'bg-border'
        )}
      >
        <AnimatePresence mode="wait">
          {isStuck ? (
            // Stuck/Interrupted state - pulsing warning bar
            <motion.div
              key="stuck"
              className="absolute inset-0 bg-warning/40"
              initial={{ opacity: 0 }}
              animate={isVisible ? { opacity: [0.3, 0.6, 0.3] } : { opacity: 0.45 }}
              transition={
                isVisible ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : undefined
              }
            />
          ) : hasFailed ? (
            // Failed state - static destructive bar at failure point
            <motion.div
              key="failed"
              className="h-full rounded-full bg-destructive"
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          ) : (
            // Normal progress bar
            <motion.div
              key="progress"
              className={cn(
                'h-full rounded-full',
                isComplete
                  ? 'bg-success'
                  : currentPhase
                    ? enabledPhases.find((p) => p.id === currentPhase.phaseId)?.color ||
                      'bg-primary'
                    : 'bg-primary'
              )}
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Phase steps indicator */}
      {!compact && (
        <MethodologyPhaseSteps
          phases={allPhases}
          enabledPhases={enabledPhases}
          phaseProgress={phaseProgress}
          skippedPhaseIds={skippedPhaseIds}
          isStuck={isStuck}
          isVisible={isVisible}
          shouldAnimate={shouldAnimate}
        />
      )}
    </div>
  );
});

/**
 * Props for MethodologyPhaseSteps
 */
interface MethodologyPhaseStepsProps {
  phases: MethodologyPhaseConfig[];
  enabledPhases: MethodologyPhaseConfig[];
  phaseProgress: MethodologyPhaseProgress[];
  skippedPhaseIds: Set<string>;
  isStuck: boolean;
  isVisible: boolean;
  shouldAnimate: boolean;
}

/**
 * Phase steps indicator showing the methodology flow
 */
const MethodologyPhaseSteps = memo(function MethodologyPhaseSteps({
  phases,
  enabledPhases,
  phaseProgress,
  skippedPhaseIds,
  isStuck,
  isVisible,
  shouldAnimate,
}: MethodologyPhaseStepsProps) {
  const { t } = useTranslation(['tasks', 'artifacts']);

  // Filter out special phases like 'idle', 'complete', 'failed' for Native methodology
  const displayPhases = phases.filter(
    (p) => !['idle', 'complete', 'failed'].includes(p.id)
  );

  return (
    <div className="flex flex-wrap items-center gap-1 mt-2">
      {displayPhases.map((phase, index) => {
        const isSkipped = skippedPhaseIds.has(phase.id);
        const status = getPhaseStatus(phase.id, phaseProgress, enabledPhases, isSkipped);
        const colors = STATUS_COLORS[status];
        const progress = phaseProgress.find((pp) => pp.phaseId === phase.id);
        const isActive = status === 'active';
        const shouldPulse = isActive && !isStuck && shouldAnimate;

        return (
          <div key={phase.id} className="flex items-center">
            <motion.div
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium',
                colors.bg,
                colors.text,
                isSkipped && 'opacity-50 line-through'
              )}
              animate={shouldPulse ? { opacity: [1, 0.6, 1] } : { opacity: isSkipped ? 0.5 : 1 }}
              transition={
                shouldPulse ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : undefined
              }
              title={
                isSkipped
                  ? t('common:status.skipped')
                  : progress?.message || t(phase.descriptionKey || phase.labelKey)
              }
            >
              {status === 'completed' && (
                <CheckIcon className="h-2.5 w-2.5" strokeWidth={3} />
              )}
              {t(phase.labelKey)}
              {isActive && progress && progress.progress > 0 && progress.progress < 100 && (
                <span className="ml-0.5 opacity-70">{progress.progress}%</span>
              )}
            </motion.div>
            {index < displayPhases.length - 1 && (
              <div
                className={cn(
                  'w-2 h-px mx-0.5',
                  (() => {
                    const nextPhase = displayPhases[index + 1];
                    const nextIsSkipped = skippedPhaseIds.has(nextPhase.id);
                    const nextStatus = getPhaseStatus(
                      nextPhase.id,
                      phaseProgress,
                      enabledPhases,
                      nextIsSkipped
                    );
                    return nextStatus === 'completed' || nextStatus === 'active'
                      ? 'bg-success/50'
                      : 'bg-border';
                  })()
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
});

/**
 * Hook to get methodology progress information
 *
 * @example
 * ```tsx
 * const { progress, currentPhase, isComplete, hasFailed } = useMethodologyProgress(
 *   'bmad',
 *   phaseProgress,
 *   'standard'
 * );
 * ```
 */
export function useMethodologyProgress(
  methodologyId: string,
  phaseProgress: MethodologyPhaseProgress[],
  complexity: 'quick' | 'standard' | 'complex' = 'standard'
) {
  const enabledPhases = useMemo(
    () => getEnabledPhases(methodologyId, complexity),
    [methodologyId, complexity]
  );

  const progress = useMemo(
    () => calculateOverallProgress(methodologyId, phaseProgress, complexity),
    [methodologyId, phaseProgress, complexity]
  );

  const currentPhase = useMemo(() => getCurrentPhase(phaseProgress), [phaseProgress]);

  const isComplete = useMemo(
    () => isMethodologyComplete(methodologyId, phaseProgress, complexity),
    [methodologyId, phaseProgress, complexity]
  );

  const hasFailed = useMemo(() => hasMethodologyFailed(phaseProgress), [phaseProgress]);

  return {
    enabledPhases,
    progress,
    currentPhase,
    isComplete,
    hasFailed,
  };
}

export default MethodologyProgressIndicator;
