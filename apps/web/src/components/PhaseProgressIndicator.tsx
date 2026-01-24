import { memo } from 'react';
import { cn } from '../lib/utils';
import type { ExecutionPhase, Subtask } from '../types';

interface PhaseProgressIndicatorProps {
  phase?: ExecutionPhase;
  subtasks: Subtask[];
  phaseProgress?: number;
  isStuck?: boolean;
  isRunning?: boolean;
  className?: string;
}

/**
 * Simple progress indicator for task execution
 */
export const PhaseProgressIndicator = memo(function PhaseProgressIndicator({
  phase = 'initializing',
  subtasks,
  phaseProgress,
  isStuck = false,
  isRunning = false,
  className,
}: PhaseProgressIndicatorProps) {
  // Calculate subtask-based progress
  const completedSubtasks = subtasks.filter((s) => s.status === 'completed').length;
  const totalSubtasks = subtasks.length;
  const subtaskProgress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  const showSubtaskProgress = totalSubtasks > 0;
  const progress = showSubtaskProgress ? subtaskProgress : (phaseProgress ?? 0);

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Progress label row */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {isStuck ? 'Interrupted' : showSubtaskProgress ? 'Progress' : phase}
        </span>
        <span className="text-xs font-medium text-foreground">
          {showSubtaskProgress ? `${progress}%` : progress > 0 ? `${Math.round(progress)}%` : '—'}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className={cn(
          'relative h-1.5 w-full overflow-hidden rounded-full',
          isStuck ? 'bg-warning/20' : 'bg-border'
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isStuck ? 'bg-warning' : 'bg-primary'
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Subtask indicators */}
      {totalSubtasks > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {subtasks.slice(0, 10).map((subtask, index) => (
            <div
              key={subtask.id || `subtask-${index}`}
              className={cn(
                'h-2 w-2 rounded-full',
                subtask.status === 'completed' && 'bg-emerald-500',
                subtask.status === 'in_progress' && 'bg-cyan-500',
                subtask.status === 'failed' && 'bg-red-500',
                subtask.status === 'pending' && 'bg-muted-foreground/30'
              )}
              title={`${subtask.description || subtask.id}: ${subtask.status}`}
            />
          ))}
          {totalSubtasks > 10 && (
            <span className="text-[10px] text-muted-foreground font-medium ml-0.5">
              +{totalSubtasks - 10}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
