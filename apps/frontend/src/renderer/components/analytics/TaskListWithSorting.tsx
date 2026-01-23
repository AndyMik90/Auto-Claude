import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Coins,
  Timer,
  Calendar,
  DollarSign
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import { cn } from '../../lib/utils';
import type { TaskAnalytics } from '../../../shared/types';

// ============================================
// Types
// ============================================

export type SortField = 'date' | 'tokens' | 'duration' | 'cost';
export type SortDirection = 'asc' | 'desc';

export interface SortOption {
  field: SortField;
  direction: SortDirection;
}

interface TaskListWithSortingProps {
  tasks: TaskAnalytics[];
  title?: string;
  showCard?: boolean;
  className?: string;
}

// ============================================
// Utility Functions
// ============================================

function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return '< 1s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

// ============================================
// Sort Options Configuration
// ============================================

const SORT_OPTIONS: { value: string; field: SortField; direction: SortDirection; labelKey: string }[] = [
  { value: 'date-desc', field: 'date', direction: 'desc', labelKey: 'analytics:sorting.dateNewest' },
  { value: 'date-asc', field: 'date', direction: 'asc', labelKey: 'analytics:sorting.dateOldest' },
  { value: 'tokens-desc', field: 'tokens', direction: 'desc', labelKey: 'analytics:sorting.tokensHighest' },
  { value: 'tokens-asc', field: 'tokens', direction: 'asc', labelKey: 'analytics:sorting.tokensLowest' },
  { value: 'duration-desc', field: 'duration', direction: 'desc', labelKey: 'analytics:sorting.durationSlowest' },
  { value: 'duration-asc', field: 'duration', direction: 'asc', labelKey: 'analytics:sorting.durationFastest' },
  { value: 'cost-desc', field: 'cost', direction: 'desc', labelKey: 'analytics:sorting.costHighest' },
  { value: 'cost-asc', field: 'cost', direction: 'asc', labelKey: 'analytics:sorting.costLowest' },
];

// ============================================
// Main Component
// ============================================

export function TaskListWithSorting({
  tasks,
  title,
  showCard = true,
  className
}: TaskListWithSortingProps) {
  const { t } = useTranslation(['analytics']);
  const [sortValue, setSortValue] = useState<string>('date-desc');

  // Parse current sort option
  const currentSort = useMemo(() => {
    const option = SORT_OPTIONS.find(o => o.value === sortValue);
    return option || SORT_OPTIONS[0];
  }, [sortValue]);

  // Sort tasks based on current selection
  const sortedTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      let comparison = 0;

      switch (currentSort.field) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'tokens':
          comparison = a.totalTokens - b.totalTokens;
          break;
        case 'duration':
          comparison = a.totalDurationMs - b.totalDurationMs;
          break;
        case 'cost': {
          const costA = a.costDetails?.actualCostUsd || a.costDetails?.estimatedApiCostUsd || 0;
          const costB = b.costDetails?.actualCostUsd || b.costDetails?.estimatedApiCostUsd || 0;
          comparison = costA - costB;
          break;
        }
      }

      return currentSort.direction === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }, [tasks, currentSort]);

  // Get icon for sort field
  const getSortIcon = (field: SortField) => {
    switch (field) {
      case 'date':
        return <Calendar className="h-3.5 w-3.5" />;
      case 'tokens':
        return <Coins className="h-3.5 w-3.5" />;
      case 'duration':
        return <Timer className="h-3.5 w-3.5" />;
      case 'cost':
        return <DollarSign className="h-3.5 w-3.5" />;
    }
  };

  const content = (
    <>
      {/* Sorting Controls */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t('analytics:sorting.showing', { count: tasks.length })}
        </span>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select value={sortValue} onValueChange={setSortValue}>
            <SelectTrigger className="w-[180px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    {getSortIcon(option.field)}
                    <span>{t(option.labelKey)}</span>
                    {option.direction === 'desc' ? (
                      <ArrowDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ArrowUp className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {sortedTasks.map((task) => (
          <TaskRow key={task.taskId} task={task} t={t} currentSort={currentSort} />
        ))}
      </div>

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          {t('analytics:empty.noTasks')}
        </div>
      )}
    </>
  );

  if (showCard) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {title || t('analytics:labels.tasks')}
          </CardTitle>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    );
  }

  return <div className={className}>{content}</div>;
}

// ============================================
// Task Row Component
// ============================================

interface TaskRowProps {
  task: TaskAnalytics;
  t: (key: string, options?: Record<string, unknown>) => string;
  currentSort: { field: SortField; direction: SortDirection };
}

function TaskRow({ task, t, currentSort }: TaskRowProps) {
  const outcomeColors: Record<string, string> = {
    done: 'text-green-600 dark:text-green-400',
    pr_created: 'text-blue-600 dark:text-blue-400',
    staged: 'text-purple-600 dark:text-purple-400',
    error: 'text-red-600 dark:text-red-400',
    in_progress: 'text-yellow-600 dark:text-yellow-400'
  };

  const outcomeLabels: Record<string, string> = {
    done: t('analytics:outcomes.done'),
    pr_created: t('analytics:outcomes.prCreated'),
    staged: t('analytics:outcomes.staged'),
    error: t('analytics:outcomes.error'),
    in_progress: t('analytics:outcomes.inProgress')
  };

  const dateStr = new Date(task.createdAt).toLocaleDateString();
  const durationStr = task.totalDurationMs > 0
    ? (task.totalDurationMs < 1000 ? '< 1s' : formatDuration(task.totalDurationMs))
    : null;
  const cost = task.costDetails?.actualCostUsd || task.costDetails?.estimatedApiCostUsd || 0;

  // Determine which field to highlight based on sort
  const highlightField = currentSort.field;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
      <div className="min-w-0 flex-1">
        <h5 className="truncate font-medium text-foreground">{task.title}</h5>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <span className={cn(highlightField === 'date' && 'text-primary font-medium')}>
            {dateStr}
          </span>
          {task.totalTokens > 0 && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className={cn(
                'flex items-center gap-1',
                highlightField === 'tokens' ? 'text-primary font-medium' : 'text-primary/70'
              )}>
                <Coins className="h-3 w-3" />
                {formatTokenCount(task.totalTokens)} tokens
              </span>
            </>
          )}
          {cost > 0 && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className={cn(
                'flex items-center gap-1',
                highlightField === 'cost'
                  ? 'text-green-500 font-medium'
                  : 'text-green-600 dark:text-green-400'
              )}>
                <DollarSign className="h-3 w-3" />
                {formatCost(cost)}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm shrink-0">
        {durationStr && (
          <div className={cn(
            'flex items-center gap-1',
            highlightField === 'duration' ? 'text-primary font-medium' : 'text-muted-foreground'
          )}>
            <Clock className="h-3 w-3" />
            <span>{durationStr}</span>
          </div>
        )}
        <span className={cn('font-medium', outcomeColors[task.outcome])}>
          {outcomeLabels[task.outcome] || task.outcome}
        </span>
      </div>
    </div>
  );
}

export default TaskListWithSorting;
