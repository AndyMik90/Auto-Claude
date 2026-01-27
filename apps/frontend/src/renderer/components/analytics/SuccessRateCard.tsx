import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  XCircle,
  Clock,
  GitPullRequest,
  Archive,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import type {
  AnalyticsSummary,
  FeatureType,
  TaskOutcome,
} from '../../../shared/types/analytics';

/**
 * Props for the SuccessRateCard component
 */
export interface SuccessRateCardProps {
  /** Analytics summary data */
  data: AnalyticsSummary | null;
  /** Whether data is currently loading */
  isLoading?: boolean;
  /** Currently active feature filter */
  activeFeature?: FeatureType | 'overview';
  /** Optional click handler for drill-down */
  onTaskClick?: (taskId: string) => void;
  /** Optional additional className */
  className?: string;
  /** Whether to show compact view */
  compact?: boolean;
}

/**
 * Outcome configuration with icon, color, and label key
 */
interface OutcomeConfig {
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgColorClass: string;
  labelKey: string;
}

const OUTCOME_CONFIG: Record<TaskOutcome | 'success', OutcomeConfig> = {
  success: {
    icon: CheckCircle2,
    colorClass: 'text-green-600 dark:text-green-400',
    bgColorClass: 'bg-green-100 dark:bg-green-900/30',
    labelKey: 'metrics.successRate.successful',
  },
  done: {
    icon: CheckCircle2,
    colorClass: 'text-green-600 dark:text-green-400',
    bgColorClass: 'bg-green-100 dark:bg-green-900/30',
    labelKey: 'outcomes.done',
  },
  pr_created: {
    icon: GitPullRequest,
    colorClass: 'text-purple-600 dark:text-purple-400',
    bgColorClass: 'bg-purple-100 dark:bg-purple-900/30',
    labelKey: 'outcomes.prCreated',
  },
  staged: {
    icon: Archive,
    colorClass: 'text-blue-600 dark:text-blue-400',
    bgColorClass: 'bg-blue-100 dark:bg-blue-900/30',
    labelKey: 'outcomes.staged',
  },
  error: {
    icon: XCircle,
    colorClass: 'text-red-600 dark:text-red-400',
    bgColorClass: 'bg-red-100 dark:bg-red-900/30',
    labelKey: 'outcomes.error',
  },
  in_progress: {
    icon: Clock,
    colorClass: 'text-yellow-600 dark:text-yellow-400',
    bgColorClass: 'bg-yellow-100 dark:bg-yellow-900/30',
    labelKey: 'outcomes.inProgress',
  },
};

/**
 * SuccessRateCard component showing merged/staged/PR created vs error counts and percentages.
 *
 * Displays:
 * - Overall success rate as a prominent percentage
 * - Visual breakdown ring/bar showing success vs error distribution
 * - Detailed counts for each outcome type (done, staged, PR created, error, in progress)
 *
 * @example
 * ```tsx
 * <SuccessRateCard
 *   data={analyticsSummary}
 *   isLoading={isLoading}
 *   activeFeature="kanban"
 *   onTaskClick={(taskId) => navigateToTask(taskId)}
 * />
 * ```
 */
export function SuccessRateCard({
  data,
  isLoading = false,
  activeFeature = 'overview',
  onTaskClick,
  className,
  compact = false,
}: SuccessRateCardProps) {
  const { t } = useTranslation(['analytics']);

  // Render loading state
  if (isLoading) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">
                {t('analytics:metrics.successRate.title')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('analytics:loading.aggregating')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 animate-pulse">
            <div className="h-12 w-24 bg-muted rounded" />
            <div className="h-4 w-full bg-muted rounded" />
            <div className="space-y-2">
              <div className="h-8 w-full bg-muted rounded" />
              <div className="h-8 w-full bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render empty state if no data
  if (!data || data.totalTasks === 0) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">
                {t('analytics:metrics.successRate.title')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('analytics:metrics.successRate.description')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <SuccessRateEmptyState />
        </CardContent>
      </Card>
    );
  }

  // Calculate metrics based on active feature filter
  const metrics = calculateMetrics(data, activeFeature);

  // Render compact version if requested
  if (compact) {
    return (
      <CompactSuccessRateCard
        metrics={metrics}
        className={className}
      />
    );
  }

  // Render full card
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">
                {t('analytics:metrics.successRate.title')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('analytics:metrics.successRate.description')}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main success rate display */}
        <SuccessRateDisplay
          successRate={metrics.successRate}
          totalTasks={metrics.totalTasks}
        />

        {/* Visual progress bar */}
        <SuccessRateBar
          successCount={metrics.successCount}
          errorCount={metrics.errorCount}
          inProgressCount={metrics.inProgressCount}
          totalTasks={metrics.totalTasks}
        />

        {/* Outcome breakdown */}
        <OutcomeBreakdown
          outcomeCounts={metrics.outcomeCounts}
          totalTasks={metrics.totalTasks}
        />

        {/* Recent tasks with errors (if any) */}
        {metrics.recentErrors.length > 0 && (
          <RecentErrorTasks
            tasks={metrics.recentErrors}
            onTaskClick={onTaskClick}
          />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Metrics calculated for success rate display
 */
interface SuccessMetrics {
  successRate: number;
  totalTasks: number;
  successCount: number;
  errorCount: number;
  inProgressCount: number;
  outcomeCounts: Record<TaskOutcome, number>;
  recentErrors: Array<{ taskId: string; title: string; specId: string }>;
}

/**
 * Calculate metrics based on analytics data and active feature filter
 */
function calculateMetrics(
  data: AnalyticsSummary,
  activeFeature: FeatureType | 'overview'
): SuccessMetrics {
  // Filter tasks by feature if not overview
  const filteredTasks =
    activeFeature === 'overview'
      ? data.tasks
      : data.tasks.filter((task) => task.feature === activeFeature);

  const totalTasks = filteredTasks.length;

  // Count outcomes
  const outcomeCounts: Record<TaskOutcome, number> = {
    done: 0,
    pr_created: 0,
    staged: 0,
    error: 0,
    in_progress: 0,
  };

  filteredTasks.forEach((task) => {
    if (task.outcome in outcomeCounts) {
      outcomeCounts[task.outcome]++;
    }
  });

  // Success includes done, staged, and pr_created
  const successCount =
    outcomeCounts.done + outcomeCounts.staged + outcomeCounts.pr_created;
  const errorCount = outcomeCounts.error;
  const inProgressCount = outcomeCounts.in_progress;

  // Calculate success rate (excluding in-progress from calculation)
  const completedTasks = successCount + errorCount;
  const successRate =
    completedTasks > 0 ? (successCount / completedTasks) * 100 : 0;

  // Get recent error tasks (max 3)
  const recentErrors = filteredTasks
    .filter((task) => task.outcome === 'error')
    .slice(0, 3)
    .map((task) => ({
      taskId: task.taskId,
      title: task.title || task.specId,
      specId: task.specId,
    }));

  return {
    successRate,
    totalTasks,
    successCount,
    errorCount,
    inProgressCount,
    outcomeCounts,
    recentErrors,
  };
}

/**
 * Empty state component for success rate
 */
function SuccessRateEmptyState() {
  const { t } = useTranslation(['analytics']);

  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <TrendingUp className="h-6 w-6 text-muted-foreground" />
      </div>
      <h4 className="mb-2 text-sm font-medium text-foreground">
        {t('analytics:empty.title')}
      </h4>
      <p className="max-w-sm text-xs text-muted-foreground">
        {t('analytics:empty.description')}
      </p>
    </div>
  );
}

/**
 * Main success rate percentage display
 */
interface SuccessRateDisplayProps {
  successRate: number;
  totalTasks: number;
}

function SuccessRateDisplay({ successRate, totalTasks }: SuccessRateDisplayProps) {
  const { t } = useTranslation(['analytics']);

  // Determine color based on success rate
  const getSuccessRateColor = () => {
    if (successRate >= 80) return 'text-green-600 dark:text-green-400';
    if (successRate >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="flex items-baseline gap-3">
      <span className={cn('text-4xl font-bold', getSuccessRateColor())}>
        {successRate.toFixed(1)}%
      </span>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-muted-foreground">
          {t('analytics:metrics.successRate.rate')}
        </span>
        <span className="text-xs text-muted-foreground">
          {totalTasks} {t('analytics:labels.tasks')}
        </span>
      </div>
    </div>
  );
}

/**
 * Visual progress bar showing success/error/in-progress distribution
 */
interface SuccessRateBarProps {
  successCount: number;
  errorCount: number;
  inProgressCount: number;
  totalTasks: number;
}

function SuccessRateBar({
  successCount,
  errorCount,
  inProgressCount,
  totalTasks,
}: SuccessRateBarProps) {
  if (totalTasks === 0) return null;

  const successPercent = (successCount / totalTasks) * 100;
  const errorPercent = (errorCount / totalTasks) * 100;
  const inProgressPercent = (inProgressCount / totalTasks) * 100;

  return (
    <div className="space-y-2">
      <div className="h-3 w-full rounded-full bg-muted flex overflow-hidden">
        {/* Success segment (green) */}
        {successPercent > 0 && (
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${successPercent}%` }}
            title={`${successCount} successful`}
          />
        )}
        {/* Error segment (red) */}
        {errorPercent > 0 && (
          <div
            className="h-full bg-red-500 transition-all"
            style={{ width: `${errorPercent}%` }}
            title={`${errorCount} failed`}
          />
        )}
        {/* In-progress segment (yellow) */}
        {inProgressPercent > 0 && (
          <div
            className="h-full bg-yellow-500 transition-all"
            style={{ width: `${inProgressPercent}%` }}
            title={`${inProgressCount} in progress`}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span>Successful ({successCount})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span>Failed ({errorCount})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-yellow-500" />
          <span>In Progress ({inProgressCount})</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Detailed breakdown of each outcome type
 */
interface OutcomeBreakdownProps {
  outcomeCounts: Record<TaskOutcome, number>;
  totalTasks: number;
}

function OutcomeBreakdown({ outcomeCounts, totalTasks }: OutcomeBreakdownProps) {
  const { t } = useTranslation(['analytics']);

  // Define the order of outcomes to display
  const outcomeOrder: TaskOutcome[] = [
    'done',
    'pr_created',
    'staged',
    'error',
    'in_progress',
  ];

  // Filter out outcomes with zero count for cleaner display
  const activeOutcomes = outcomeOrder.filter(
    (outcome) => outcomeCounts[outcome] > 0
  );

  if (activeOutcomes.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">
        {t('analytics:summary.title')}
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {activeOutcomes.map((outcome) => {
          const config = OUTCOME_CONFIG[outcome];
          const count = outcomeCounts[outcome];
          const percentage =
            totalTasks > 0 ? ((count / totalTasks) * 100).toFixed(1) : '0';
          const Icon = config.icon;

          return (
            <div
              key={outcome}
              className={cn(
                'flex items-center gap-2 rounded-lg p-2 border border-border',
                config.bgColorClass
              )}
            >
              <Icon className={cn('h-4 w-4', config.colorClass)} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">
                  {count}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {t(`analytics:${config.labelKey}`)} ({percentage}%)
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * List of recent error tasks for quick navigation
 */
interface RecentErrorTasksProps {
  tasks: Array<{ taskId: string; title: string; specId: string }>;
  onTaskClick?: (taskId: string) => void;
}

function RecentErrorTasks({ tasks, onTaskClick }: RecentErrorTasksProps) {
  const { t } = useTranslation(['analytics']);

  if (tasks.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">
        {t('analytics:metrics.successRate.failed')}
      </h4>
      <div className="space-y-1">
        {tasks.map((task) => (
          <button
            key={task.taskId}
            type="button"
            className={cn(
              'w-full flex items-center justify-between rounded-lg p-2 text-left',
              'border border-red-200 dark:border-red-900/50',
              'bg-red-50 dark:bg-red-900/20',
              'hover:bg-red-100 dark:hover:bg-red-900/30',
              'transition-colors',
              onTaskClick && 'cursor-pointer'
            )}
            onClick={() => onTaskClick?.(task.taskId)}
            disabled={!onTaskClick}
          >
            <div className="flex items-center gap-2 min-w-0">
              <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-foreground truncate">
                {task.title}
              </span>
            </div>
            {onTaskClick && (
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Compact variant of SuccessRateCard for use in smaller layouts
 */
interface CompactSuccessRateCardProps {
  metrics: SuccessMetrics;
  className?: string;
}

function CompactSuccessRateCard({ metrics, className }: CompactSuccessRateCardProps) {
  const { t } = useTranslation(['analytics']);

  const getSuccessRateColor = () => {
    if (metrics.successRate >= 80) return 'text-green-600 dark:text-green-400';
    if (metrics.successRate >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className={cn('flex items-center justify-between p-3 rounded-lg border border-border', className)}>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-medium text-muted-foreground">
            {t('analytics:metrics.successRate.title')}
          </div>
          <div className="text-xs text-muted-foreground">
            {metrics.totalTasks} {t('analytics:labels.tasks')}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {metrics.successCount}
          </Badge>
        </div>
        {metrics.errorCount > 0 && (
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              <XCircle className="h-3 w-3 mr-1" />
              {metrics.errorCount}
            </Badge>
          </div>
        )}
        <span className={cn('text-xl font-bold', getSuccessRateColor())}>
          {metrics.successRate.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

/**
 * Success rate ring visualization component
 * Can be used as an alternative to the bar chart
 */
export interface SuccessRateRingProps {
  successRate: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function SuccessRateRing({
  successRate,
  size = 'md',
  showLabel = true,
  className,
}: SuccessRateRingProps) {
  const sizeConfig = {
    sm: { container: 'h-16 w-16', strokeWidth: 4, fontSize: 'text-sm' },
    md: { container: 'h-24 w-24', strokeWidth: 6, fontSize: 'text-lg' },
    lg: { container: 'h-32 w-32', strokeWidth: 8, fontSize: 'text-2xl' },
  };

  const config = sizeConfig[size];
  const radius = 50 - config.strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (successRate / 100) * circumference;

  const getStrokeColor = () => {
    if (successRate >= 80) return 'stroke-green-500';
    if (successRate >= 50) return 'stroke-yellow-500';
    return 'stroke-red-500';
  };

  return (
    <div className={cn('relative', config.container, className)}>
      <svg
        className="w-full h-full transform -rotate-90"
        viewBox="0 0 100 100"
      >
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth={config.strokeWidth}
          className="stroke-muted"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          className={cn('transition-all duration-500', getStrokeColor())}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset,
          }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold', config.fontSize)}>
            {successRate.toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Export helpers for testing
 */
export { calculateMetrics, SuccessRateEmptyState, SuccessRateBar, OutcomeBreakdown };
