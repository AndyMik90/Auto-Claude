import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  ChevronRight,
  ArrowLeft,
  Timer,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import type {
  AnalyticsSummary,
  FeatureType,
  AnalyticsPhase,
  TaskAnalytics,
} from '../../../shared/types/analytics';

/**
 * Drill-down hierarchy levels for duration
 * app -> feature -> task -> phase
 */
type DurationDrillDownLevel = 'app' | 'feature' | 'task' | 'phase';

/**
 * Current drill-down state for duration navigation
 */
interface DurationDrillDownState {
  level: DurationDrillDownLevel;
  feature?: FeatureType;
  taskId?: string;
  phase?: AnalyticsPhase;
}

/**
 * Props for the DurationChart component
 */
export interface DurationChartProps {
  /** Analytics summary data */
  data: AnalyticsSummary | null;
  /** Whether data is currently loading */
  isLoading?: boolean;
  /** Currently active feature filter (from parent) */
  activeFeature?: FeatureType | 'overview';
  /** Optional additional className */
  className?: string;
}

/**
 * DurationChart component with hierarchical drill-down capability.
 *
 * Hierarchy: App -> Feature -> Task -> Phase
 *
 * Displays task/phase duration metrics with interactive drill-down
 * to explore time spent at each level of granularity.
 *
 * @example
 * ```tsx
 * <DurationChart
 *   data={analyticsSummary}
 *   isLoading={isLoading}
 *   activeFeature="kanban"
 * />
 * ```
 */
export function DurationChart({
  data,
  isLoading = false,
  activeFeature = 'overview',
  className,
}: DurationChartProps) {
  const { t } = useTranslation(['analytics']);

  // Drill-down navigation state
  const [drillDown, setDrillDown] = useState<DurationDrillDownState>({
    level: 'app',
  });

  // Navigation handlers
  const handleDrillDown = (
    level: DurationDrillDownLevel,
    options?: { feature?: FeatureType; taskId?: string; phase?: AnalyticsPhase }
  ) => {
    setDrillDown({
      level,
      ...options,
    });
  };

  const handleBack = () => {
    switch (drillDown.level) {
      case 'phase':
        setDrillDown({
          level: 'task',
          feature: drillDown.feature,
          taskId: drillDown.taskId,
        });
        break;
      case 'task':
        setDrillDown({
          level: 'feature',
          feature: drillDown.feature,
        });
        break;
      case 'feature':
        setDrillDown({ level: 'app' });
        break;
      default:
        break;
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">
                {t('analytics:metrics.duration.title')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('analytics:loading.aggregating')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 animate-pulse">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-20 w-full bg-muted rounded" />
            <div className="h-4 w-24 bg-muted rounded" />
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
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">
                {t('analytics:metrics.duration.title')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('analytics:metrics.duration.description')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DurationEmptyState />
        </CardContent>
      </Card>
    );
  }

  // Render actual chart with drill-down
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">
                {t('analytics:metrics.duration.title')}
              </CardTitle>
              <CardDescription className="text-xs">
                {getBreadcrumb(drillDown, t)}
              </CardDescription>
            </div>
          </div>
          {drillDown.level !== 'app' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              {t('analytics:drillDown.backToOverview')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <DurationContent
          data={data}
          drillDown={drillDown}
          activeFeature={activeFeature}
          onDrillDown={handleDrillDown}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Empty state component for duration chart
 */
function DurationEmptyState() {
  const { t } = useTranslation(['analytics']);

  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Timer className="h-6 w-6 text-muted-foreground" />
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
 * Props for DurationContent component
 */
interface DurationContentProps {
  data: AnalyticsSummary;
  drillDown: DurationDrillDownState;
  activeFeature: FeatureType | 'overview';
  onDrillDown: (
    level: DurationDrillDownLevel,
    options?: { feature?: FeatureType; taskId?: string; phase?: AnalyticsPhase }
  ) => void;
}

/**
 * Content renderer for different drill-down levels
 */
function DurationContent({
  data,
  drillDown,
  activeFeature,
  onDrillDown,
}: DurationContentProps) {
  // Render based on current drill-down level
  switch (drillDown.level) {
    case 'app':
      return (
        <AppLevelView
          data={data}
          activeFeature={activeFeature}
          onSelectFeature={(feature) =>
            onDrillDown('feature', { feature })
          }
        />
      );

    case 'feature':
      return (
        <FeatureLevelView
          data={data}
          feature={drillDown.feature!}
          onSelectTask={(taskId) =>
            onDrillDown('task', { feature: drillDown.feature, taskId })
          }
        />
      );

    case 'task':
      return (
        <TaskLevelView
          data={data}
          taskId={drillDown.taskId!}
          onSelectPhase={(phase) =>
            onDrillDown('phase', {
              feature: drillDown.feature,
              taskId: drillDown.taskId,
              phase,
            })
          }
        />
      );

    case 'phase':
      return (
        <PhaseLevelView
          data={data}
          taskId={drillDown.taskId!}
          phase={drillDown.phase!}
        />
      );

    default:
      return null;
  }
}

/**
 * App-level duration view (shows all features or filtered by activeFeature)
 */
interface AppLevelViewProps {
  data: AnalyticsSummary;
  activeFeature: FeatureType | 'overview';
  onSelectFeature: (feature: FeatureType) => void;
}

function AppLevelView({ data, activeFeature, onSelectFeature }: AppLevelViewProps) {
  const { t } = useTranslation(['analytics']);

  const features = Object.entries(data.byFeature).filter(([feature, metrics]) => {
    if (activeFeature === 'overview') return true;
    return feature === activeFeature;
  });

  // Calculate total duration from filtered features
  const totalDurationMs = features.reduce(
    (sum, [, metrics]) => sum + (metrics.averageDurationMs * metrics.taskCount),
    0
  );

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">
          {formatDuration(totalDurationMs)}
        </span>
        <span className="text-sm text-muted-foreground">
          {t('analytics:metrics.duration.total')}
        </span>
      </div>

      {/* Average duration */}
      {data.totalTasks > 0 && (
        <div className="flex items-baseline gap-2 text-sm">
          <span className="text-muted-foreground">
            {t('analytics:metrics.duration.average')}:
          </span>
          <span className="font-medium text-foreground">
            {formatDuration(data.averageDurationMs)}
          </span>
        </div>
      )}

      {/* Feature breakdown */}
      <div className="space-y-2">
        {features.map(([feature, metrics]) => {
          const featureDurationMs = metrics.averageDurationMs * metrics.taskCount;
          return (
            <DurationRow
              key={feature}
              label={t(`analytics:features.${feature === 'github-prs' ? 'githubPRs' : feature}`)}
              durationMs={featureDurationMs}
              totalDurationMs={totalDurationMs}
              taskCount={metrics.taskCount}
              onClick={() => onSelectFeature(feature as FeatureType)}
              showDrillDown
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Feature-level duration view (shows tasks for selected feature)
 */
interface FeatureLevelViewProps {
  data: AnalyticsSummary;
  feature: FeatureType;
  onSelectTask: (taskId: string) => void;
}

function FeatureLevelView({ data, feature, onSelectTask }: FeatureLevelViewProps) {
  const { t } = useTranslation(['analytics']);

  const tasks = data.tasks.filter((task) => task.feature === feature);
  const totalDurationMs = tasks.reduce((sum, task) => sum + task.totalDurationMs, 0);

  if (tasks.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        {t('analytics:charts.noData')}
      </div>
    );
  }

  // Calculate average duration
  const avgDurationMs = totalDurationMs / tasks.length;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">
          {formatDuration(totalDurationMs)}
        </span>
        <span className="text-sm text-muted-foreground">
          {t('analytics:metrics.duration.total')}
        </span>
      </div>

      {/* Average */}
      <div className="flex items-baseline gap-2 text-sm">
        <span className="text-muted-foreground">
          {t('analytics:metrics.duration.average')}:
        </span>
        <span className="font-medium text-foreground">
          {formatDuration(avgDurationMs)}
        </span>
        <span className="text-muted-foreground">
          ({tasks.length} {t('analytics:labels.tasks')})
        </span>
      </div>

      {/* Task breakdown */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {tasks.map((task) => (
          <DurationRow
            key={task.taskId}
            label={task.title || task.specId}
            durationMs={task.totalDurationMs}
            totalDurationMs={totalDurationMs}
            outcome={task.outcome}
            onClick={() => onSelectTask(task.taskId)}
            showDrillDown
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Task-level duration view (shows phases for selected task)
 */
interface TaskLevelViewProps {
  data: AnalyticsSummary;
  taskId: string;
  onSelectPhase: (phase: AnalyticsPhase) => void;
}

function TaskLevelView({ data, taskId, onSelectPhase }: TaskLevelViewProps) {
  const { t } = useTranslation(['analytics']);

  const task = data.tasks.find((t) => t.taskId === taskId);

  if (!task) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        {t('analytics:charts.noData')}
      </div>
    );
  }

  const totalDurationMs = task.totalDurationMs;
  // Calculate total from phases for percentage breakdown
  const phasesTotalDurationMs = task.phases.reduce(
    (sum, phase) => sum + phase.durationMs,
    0
  );

  return (
    <div className="space-y-3">
      {/* Task title */}
      <div className="mb-2">
        <span className="text-sm font-medium text-foreground">
          {task.title || task.specId}
        </span>
        <Badge variant="outline" className="ml-2 text-xs">
          {t(`analytics:outcomes.${getOutcomeKey(task.outcome)}`)}
        </Badge>
      </div>

      {/* Summary */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">
          {formatDuration(totalDurationMs)}
        </span>
        <span className="text-sm text-muted-foreground">
          {t('analytics:metrics.duration.total')}
        </span>
      </div>

      {/* Phase breakdown */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground mb-2">
          {t('analytics:metrics.duration.byPhase')}
        </div>
        {task.phases.map((phase) => (
          <DurationRow
            key={phase.phase}
            label={t(`analytics:phases.${phase.phase}`)}
            durationMs={phase.durationMs}
            totalDurationMs={phasesTotalDurationMs || totalDurationMs}
            onClick={() => onSelectPhase(phase.phase)}
            showDrillDown
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Phase-level duration view (deepest level - shows phase details)
 */
interface PhaseLevelViewProps {
  data: AnalyticsSummary;
  taskId: string;
  phase: AnalyticsPhase;
}

function PhaseLevelView({ data, taskId, phase }: PhaseLevelViewProps) {
  const { t } = useTranslation(['analytics']);

  const task = data.tasks.find((t) => t.taskId === taskId);
  const phaseData = task?.phases.find((p) => p.phase === phase);

  if (!phaseData) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        {t('analytics:charts.noData')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Phase title */}
      <div>
        <Badge variant="outline" className="mb-2">
          {t(`analytics:phases.${phase}`)}
        </Badge>
      </div>

      {/* Duration */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">
          {formatDuration(phaseData.durationMs)}
        </span>
        <span className="text-sm text-muted-foreground">
          {t('analytics:metrics.duration.total')}
        </span>
      </div>

      {/* Phase metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="rounded-lg border border-border p-3">
          <span className="text-muted-foreground block mb-1">
            {t('analytics:labels.started', { defaultValue: 'Started' })}
          </span>
          <span className="text-foreground font-medium">
            {phaseData.startedAt
              ? new Date(phaseData.startedAt).toLocaleString()
              : '-'}
          </span>
        </div>
        <div className="rounded-lg border border-border p-3">
          <span className="text-muted-foreground block mb-1">
            {t('analytics:labels.completed', { defaultValue: 'Completed' })}
          </span>
          <span className="text-foreground font-medium">
            {phaseData.completedAt
              ? new Date(phaseData.completedAt).toLocaleString()
              : '-'}
          </span>
        </div>
      </div>

      {/* Duration breakdown visualization */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            {t('analytics:labels.durationBreakdown', { defaultValue: 'Duration Breakdown' })}
          </span>
        </div>
        <DurationBreakdownBar durationMs={phaseData.durationMs} />
      </div>
    </div>
  );
}

/**
 * Visual duration breakdown bar
 */
interface DurationBreakdownBarProps {
  durationMs: number;
}

function DurationBreakdownBar({ durationMs }: DurationBreakdownBarProps) {
  const hours = Math.floor(durationMs / 3600000);
  const minutes = Math.floor((durationMs % 3600000) / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);

  const parts: { label: string; seconds: number; color: string }[] = [];
  if (hours > 0) parts.push({ label: `${hours}h`, seconds: hours * 3600, color: 'bg-primary' });
  if (minutes > 0) parts.push({ label: `${minutes}m`, seconds: minutes * 60, color: 'bg-primary/70' });
  if (seconds > 0 || parts.length === 0) parts.push({ label: `${seconds}s`, seconds: seconds, color: 'bg-primary/40' });

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  return (
    <div className="space-y-2">
      <div className="h-3 w-full rounded-full bg-muted flex overflow-hidden">
        {parts.map((part) => {
          const percentage = totalSeconds > 0 ? (part.seconds / totalSeconds) * 100 : 100 / parts.length;
          return (
            <div
              key={part.label}
              className={cn('h-full transition-all', part.color)}
              style={{ width: `${Math.max(percentage, 5)}%` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        {parts.map((part) => (
          <span key={part.label}>{part.label}</span>
        ))}
      </div>
    </div>
  );
}

/**
 * Reusable row component for duration display
 */
interface DurationRowProps {
  label: string;
  durationMs: number;
  totalDurationMs: number;
  taskCount?: number;
  outcome?: string;
  onClick?: () => void;
  showDrillDown?: boolean;
}

function DurationRow({
  label,
  durationMs,
  totalDurationMs,
  taskCount,
  outcome,
  onClick,
  showDrillDown = false,
}: DurationRowProps) {
  const { t } = useTranslation(['analytics']);
  const percentage = totalDurationMs > 0 ? (durationMs / totalDurationMs) * 100 : 0;

  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-lg border border-border p-3 text-left transition-colors',
        onClick && 'cursor-pointer hover:border-primary/50 hover:bg-muted/50'
      )}
      onClick={onClick}
      disabled={!onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {outcome && (
            <Badge variant="outline" className={cn('text-xs', getOutcomeColor(outcome))}>
              {t(`analytics:outcomes.${getOutcomeKey(outcome)}`)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {formatDuration(durationMs)}
          </span>
          {taskCount !== undefined && (
            <span className="text-xs text-muted-foreground">
              ({taskCount} {t('analytics:labels.tasks')})
            </span>
          )}
          {showDrillDown && onClick && (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {percentage.toFixed(1)}%
      </div>
    </button>
  );
}

/**
 * Format duration for display
 */
function formatDuration(ms: number): string {
  if (ms < 0) return '0s';

  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Get outcome key for translation
 */
function getOutcomeKey(outcome: string): string {
  switch (outcome) {
    case 'pr_created':
      return 'prCreated';
    case 'in_progress':
      return 'inProgress';
    default:
      return outcome;
  }
}

/**
 * Get outcome color class
 */
function getOutcomeColor(outcome: string): string {
  switch (outcome) {
    case 'done':
    case 'staged':
    case 'pr_created':
      return 'border-green-500/50 text-green-600 dark:text-green-400';
    case 'error':
      return 'border-red-500/50 text-red-600 dark:text-red-400';
    case 'in_progress':
      return 'border-blue-500/50 text-blue-600 dark:text-blue-400';
    default:
      return '';
  }
}

/**
 * Get breadcrumb string for current drill-down state
 */
function getBreadcrumb(
  drillDown: DurationDrillDownState,
  t: (key: string, options?: Record<string, string>) => string
): string {
  const parts: string[] = [t('analytics:drillDown.levels.app')];

  if (drillDown.feature) {
    const featureKey = drillDown.feature === 'github-prs' ? 'githubPRs' : drillDown.feature;
    parts.push(t(`analytics:features.${featureKey}`));
  }

  if (drillDown.taskId) {
    parts.push(t('analytics:drillDown.levels.task'));
  }

  if (drillDown.phase) {
    parts.push(t(`analytics:phases.${drillDown.phase}`));
  }

  return parts.join(' -> ');
}

/**
 * Export helpers for testing
 */
export { formatDuration, DurationEmptyState, getOutcomeColor };
