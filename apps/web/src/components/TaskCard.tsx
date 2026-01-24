import { useState, useMemo, memo } from 'react';
import { Clock, MoreVertical } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { cn, formatRelativeTime, sanitizeMarkdownForDisplay } from '../lib/utils';
import { PhaseProgressIndicator } from './PhaseProgressIndicator';
import { TASK_STATUS_COLUMNS, TASK_STATUS_LABELS } from '../constants/tasks';
import type { Task, TaskStatus } from '../types';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onStatusChange?: (newStatus: TaskStatus) => unknown;
}

// Custom comparator for React.memo - only re-render when relevant task data changes
function taskCardPropsAreEqual(prevProps: TaskCardProps, nextProps: TaskCardProps): boolean {
  const prevTask = prevProps.task;
  const nextTask = nextProps.task;

  // Fast path: same reference
  if (
    prevTask === nextTask &&
    prevProps.onClick === nextProps.onClick &&
    prevProps.onStatusChange === nextProps.onStatusChange
  ) {
    return true;
  }

  // Compare only the fields that affect rendering
  const isEqual = (
    prevTask.id === nextTask.id &&
    prevTask.status === nextTask.status &&
    prevTask.title === nextTask.title &&
    prevTask.description === nextTask.description &&
    prevTask.metadata.updatedAt === nextTask.metadata.updatedAt &&
    prevTask.reviewReason === nextTask.reviewReason &&
    prevTask.progress?.phase === nextTask.progress?.phase &&
    prevTask.progress?.completedSubtasks === nextTask.progress?.completedSubtasks &&
    prevTask.plan?.phases.length === nextTask.plan?.phases.length
  );

  return isEqual;
}

export const TaskCard = memo(function TaskCard({
  task,
  onClick,
  onStatusChange,
}: TaskCardProps) {
  const [isStuck] = useState(false);

  const isRunning = task.status === 'in_progress';
  const executionPhase = task.progress?.phase;
  const hasActiveExecution = executionPhase && ['executing', 'planning', 'testing'].includes(executionPhase);

  // Collect all subtasks from plan phases
  const subtasks = useMemo(() => {
    if (!task.plan?.phases) return [];
    return task.plan.phases.flatMap(phase => phase.subtasks || []);
  }, [task.plan?.phases]);

  // Truncate description for card display
  const sanitizedDescription = useMemo(() => {
    if (!task.description) return null;
    return sanitizeMarkdownForDisplay(task.description, 120);
  }, [task.description]);

  // Memoize relative time
  const relativeTime = useMemo(
    () => formatRelativeTime(task.metadata.updatedAt),
    [task.metadata.updatedAt]
  );

  // Memoize status menu items
  const statusMenuItems = useMemo(() => {
    if (!onStatusChange) return null;
    return TASK_STATUS_COLUMNS.filter(status => status !== task.status).map((status) => (
      <DropdownMenuItem
        key={status}
        onClick={() => onStatusChange(status)}
      >
        {TASK_STATUS_LABELS[status]}
      </DropdownMenuItem>
    ));
  }, [task.status, onStatusChange]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'info';
      case 'ai_review':
        return 'warning';
      case 'human_review':
        return 'purple';
      case 'done':
        return 'success';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'Running';
      case 'ai_review':
        return 'AI Review';
      case 'human_review':
        return 'Needs Review';
      case 'done':
        return 'Complete';
      case 'queue':
        return 'Queued';
      default:
        return 'Pending';
    }
  };

  const getReviewReasonLabel = (reason?: string): { label: string; variant: 'success' | 'destructive' | 'warning' } | null => {
    if (!reason) return null;
    switch (reason) {
      case 'needs_context':
        return { label: 'Needs Context', variant: 'warning' };
      case 'security_check':
        return { label: 'Security Check', variant: 'warning' };
      case 'breaking_change':
        return { label: 'Breaking Change', variant: 'destructive' };
      case 'manual_verification':
        return { label: 'Manual Verification', variant: 'warning' };
      case 'test_failures':
        return { label: 'Test Failures', variant: 'destructive' };
      default:
        return null;
    }
  };

  const reviewReasonInfo = task.status === 'human_review' ? getReviewReasonLabel(task.reviewReason) : null;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isRunning && !isStuck && 'ring-2 ring-primary border-primary',
        isStuck && 'ring-2 ring-warning border-warning'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Title */}
        <h3
          className="font-semibold text-sm text-foreground line-clamp-2 leading-snug"
          title={task.title}
        >
          {task.title}
        </h3>

        {/* Description */}
        {sanitizedDescription && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
            {sanitizedDescription}
          </p>
        )}

        {/* Metadata badges */}
        {(isStuck || hasActiveExecution || reviewReasonInfo) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {/* Status/Phase badge */}
            {!hasActiveExecution && (
              <Badge
                variant={getStatusBadgeVariant(task.status)}
                className="text-[10px] px-1.5 py-0.5"
              >
                {getStatusLabel(task.status)}
              </Badge>
            )}

            {/* Review reason badge */}
            {reviewReasonInfo && (
              <Badge
                variant={reviewReasonInfo.variant}
                className="text-[10px] px-1.5 py-0.5"
              >
                {reviewReasonInfo.label}
              </Badge>
            )}

            {/* Priority badge */}
            {task.metadata.priority && ['high', 'urgent'].includes(task.metadata.priority) && (
              <Badge
                variant="destructive"
                className="text-[10px] px-1.5 py-0.5"
              >
                {task.metadata.priority}
              </Badge>
            )}
          </div>
        )}

        {/* Progress section */}
        {(subtasks.length > 0 || hasActiveExecution || isRunning || isStuck) && (
          <div className="mt-4">
            <PhaseProgressIndicator
              phase={executionPhase}
              subtasks={subtasks}
              phaseProgress={task.progress?.completedSubtasks && task.progress?.totalSubtasks
                ? (task.progress.completedSubtasks / task.progress.totalSubtasks) * 100
                : 0}
              isStuck={isStuck}
              isRunning={isRunning}
            />
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{relativeTime}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Move to menu */}
            {statusMenuItems && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Task actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuLabel>Move to</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {statusMenuItems}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}, taskCardPropsAreEqual);
