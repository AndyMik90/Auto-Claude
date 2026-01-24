import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  LayoutGrid,
  Sparkles,
  Map,
  Lightbulb,
  FileText,
  GitPullRequest,
  Info,
  Coins,
  Cpu,
  ArrowDownToLine,
  ArrowUpFromLine,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';
import type {
  AnalyticsSummary,
  DrillDownState,
  DrillDownLevel,
  FeatureType,
  AnalyticsPhase,
  TaskAnalytics,
  PhaseMetrics,
  TokenUsageDetails,
  CostDetails,
} from '../../../shared/types/analytics';
import { formatCost, formatTokenCount } from '../../../shared/constants/pricing';

// ============================================
// Types & Interfaces
// ============================================

/**
 * Props for the DrillDownView component
 */
export interface DrillDownViewProps {
  /** Analytics summary data */
  data: AnalyticsSummary | null;
  /** Current drill-down state */
  drillDown: DrillDownState;
  /** Whether data is currently loading */
  isLoading?: boolean;
  /** Callback when user drills down into a feature */
  onDrillDownToFeature?: (feature: FeatureType) => void;
  /** Callback when user drills down into a task */
  onDrillDownToTask?: (taskId: string) => void;
  /** Callback when user drills down into a phase */
  onDrillDownToPhase?: (phase: AnalyticsPhase) => void;
  /** Callback when user navigates back */
  onDrillUp?: () => void;
  /** Callback when user resets to overview */
  onReset?: () => void;
  /** Optional additional className */
  className?: string;
  /** Card title override */
  title?: string;
  /** Card description override */
  description?: string;
}

/**
 * Information about a drill-down item for rendering
 */
interface DrillDownItem {
  id: string;
  label: string;
  sublabel?: string;
  value?: string | number;
  percentage?: number;
  icon?: React.ReactNode;
  status?: 'success' | 'error' | 'in_progress' | 'neutral';
  onClick?: () => void;
}

// ============================================
// Feature Icons Mapping
// ============================================

const FEATURE_ICONS: Record<FeatureType, typeof LayoutGrid> = {
  kanban: LayoutGrid,
  insights: Sparkles,
  roadmap: Map,
  ideation: Lightbulb,
  changelog: FileText,
  'github-prs': GitPullRequest,
};

// ============================================
// Helper Functions
// ============================================

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
 * Get status from task outcome
 */
function getStatusFromOutcome(
  outcome: string
): 'success' | 'error' | 'in_progress' | 'neutral' {
  switch (outcome) {
    case 'done':
    case 'staged':
    case 'pr_created':
      return 'success';
    case 'error':
      return 'error';
    case 'in_progress':
      return 'in_progress';
    default:
      return 'neutral';
  }
}

/**
 * Get status color class
 */
function getStatusColor(status: 'success' | 'error' | 'in_progress' | 'neutral'): string {
  switch (status) {
    case 'success':
      return 'text-green-600 dark:text-green-400';
    case 'error':
      return 'text-red-600 dark:text-red-400';
    case 'in_progress':
      return 'text-blue-600 dark:text-blue-400';
    default:
      return 'text-muted-foreground';
  }
}

/**
 * Get feature translation key
 */
function getFeatureKey(feature: FeatureType): string {
  return feature === 'github-prs' ? 'githubPRs' : feature;
}

// ============================================
// Main Component
// ============================================

/**
 * DrillDownView component for displaying detailed breakdown
 * when user clicks into a metric.
 *
 * Supports hierarchical navigation: Overview → Feature → Task → Phase
 *
 * @example
 * ```tsx
 * <DrillDownView
 *   data={analyticsSummary}
 *   drillDown={currentDrillDown}
 *   isLoading={isLoading}
 *   onDrillDownToFeature={(f) => store.drillDownToFeature(f)}
 *   onDrillDownToTask={(t) => store.drillDownToTask(t)}
 *   onDrillDownToPhase={(p) => store.drillDownToPhase(p)}
 *   onDrillUp={() => store.drillUp()}
 * />
 * ```
 */
export function DrillDownView({
  data,
  drillDown,
  isLoading = false,
  onDrillDownToFeature,
  onDrillDownToTask,
  onDrillDownToPhase,
  onDrillUp,
  onReset,
  className,
  title,
  description,
}: DrillDownViewProps) {
  const { t } = useTranslation(['analytics']);

  // Determine current breadcrumb path
  const breadcrumb = useMemo(() => {
    return getBreadcrumbPath(drillDown, data, t);
  }, [drillDown, data, t]);

  // Render loading state
  if (isLoading) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            </div>
            <div>
              <CardTitle className="text-base">
                {title || t('analytics:drillDown.viewDetails')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('analytics:loading.aggregating')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DrillDownSkeleton />
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
              <Info className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">
                {title || t('analytics:drillDown.viewDetails')}
              </CardTitle>
              <CardDescription className="text-xs">
                {description || t('analytics:empty.title')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DrillDownEmptyState />
        </CardContent>
      </Card>
    );
  }

  // Render drill-down content based on level
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ChevronRight className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">
                {title || t('analytics:drillDown.viewDetails')}
              </CardTitle>
              <CardDescription className="text-xs truncate max-w-md">
                {breadcrumb}
              </CardDescription>
            </div>
          </div>
          {drillDown.level !== 'overview' && onDrillUp && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDrillUp}
              className="gap-1 shrink-0"
            >
              <ArrowLeft className="h-3 w-3" />
              {t('analytics:drillDown.backToOverview')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <DrillDownContent
          data={data}
          drillDown={drillDown}
          onDrillDownToFeature={onDrillDownToFeature}
          onDrillDownToTask={onDrillDownToTask}
          onDrillDownToPhase={onDrillDownToPhase}
        />
      </CardContent>
    </Card>
  );
}

// ============================================
// Content Renderer
// ============================================

interface DrillDownContentProps {
  data: AnalyticsSummary;
  drillDown: DrillDownState;
  onDrillDownToFeature?: (feature: FeatureType) => void;
  onDrillDownToTask?: (taskId: string) => void;
  onDrillDownToPhase?: (phase: AnalyticsPhase) => void;
}

function DrillDownContent({
  data,
  drillDown,
  onDrillDownToFeature,
  onDrillDownToTask,
  onDrillDownToPhase,
}: DrillDownContentProps) {
  const { t } = useTranslation(['analytics']);

  switch (drillDown.level) {
    case 'overview':
      return (
        <OverviewLevelView
          data={data}
          onSelectFeature={onDrillDownToFeature}
        />
      );

    case 'feature':
      return (
        <FeatureLevelView
          data={data}
          feature={drillDown.feature!}
          onSelectTask={onDrillDownToTask}
        />
      );

    case 'task':
      return (
        <TaskLevelView
          data={data}
          taskId={drillDown.taskId!}
          onSelectPhase={onDrillDownToPhase}
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

// ============================================
// Level Views
// ============================================

interface OverviewLevelViewProps {
  data: AnalyticsSummary;
  onSelectFeature?: (feature: FeatureType) => void;
}

function OverviewLevelView({ data, onSelectFeature }: OverviewLevelViewProps) {
  const { t } = useTranslation(['analytics']);

  const items: DrillDownItem[] = Object.entries(data.byFeature).map(
    ([feature, metrics]) => {
      const FeatureIcon = FEATURE_ICONS[feature as FeatureType];
      const successRate = metrics.taskCount > 0
        ? (metrics.successCount / metrics.taskCount) * 100
        : 0;

      return {
        id: feature,
        label: t(`analytics:features.${getFeatureKey(feature as FeatureType)}`),
        sublabel: `${metrics.taskCount} ${t('analytics:labels.tasks')}`,
        value: formatDuration(metrics.averageDurationMs * metrics.taskCount),
        percentage: successRate,
        icon: FeatureIcon ? <FeatureIcon className="h-4 w-4" /> : null,
        status: successRate >= 80 ? 'success' : successRate >= 50 ? 'neutral' : 'error',
        onClick: onSelectFeature ? () => onSelectFeature(feature as FeatureType) : undefined,
      };
    }
  );

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryStatCard
          label={t('analytics:summary.totalTasks')}
          value={data.totalTasks.toString()}
        />
        <SummaryStatCard
          label={t('analytics:summary.successRate')}
          value={`${Math.round(data.successRate)}%`}
          status={data.successRate >= 80 ? 'success' : data.successRate >= 50 ? 'neutral' : 'error'}
        />
        <SummaryStatCard
          label={t('analytics:summary.averageDuration')}
          value={formatDuration(data.averageDurationMs)}
        />
        <SummaryStatCard
          label={t('analytics:metrics.successRate.inProgress')}
          value={data.inProgressCount.toString()}
          status="in_progress"
        />
      </div>

      {/* Feature breakdown */}
      <div className="space-y-1">
        <h4 className="text-sm font-medium text-muted-foreground mb-2">
          {t('analytics:drillDown.levels.feature')}
        </h4>
        <ScrollArea className="max-h-64">
          <div className="space-y-2">
            {items.map((item) => (
              <DrillDownRow key={item.id} item={item} />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

interface FeatureLevelViewProps {
  data: AnalyticsSummary;
  feature: FeatureType;
  onSelectTask?: (taskId: string) => void;
}

function FeatureLevelView({ data, feature, onSelectTask }: FeatureLevelViewProps) {
  const { t } = useTranslation(['analytics']);

  const tasks = data.tasks.filter((task) => task.feature === feature);
  const featureMetrics = data.byFeature[feature];

  if (tasks.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          {t('analytics:empty.noDataForFeature')}
        </p>
      </div>
    );
  }

  const items: DrillDownItem[] = tasks.map((task) => {
    // Build sublabel with date and optional token count
    let sublabel = new Date(task.createdAt).toLocaleDateString();
    if (task.totalTokens > 0) {
      sublabel += ` \u2022 ${formatTokenCount(task.totalTokens)} tokens`;
    }
    if (task.costDetails?.actualCostUsd) {
      sublabel += ` \u2022 ${formatCost(task.costDetails.actualCostUsd)}`;
    }

    return {
      id: task.taskId,
      label: task.title || task.specId,
      sublabel,
      value: formatDuration(task.totalDurationMs),
      status: getStatusFromOutcome(task.outcome),
      onClick: onSelectTask ? () => onSelectTask(task.taskId) : undefined,
    };
  });

  return (
    <div className="space-y-4">
      {/* Feature summary */}
      <div className="rounded-lg border border-border p-4 bg-muted/30">
        <div className="flex items-center gap-3 mb-3">
          {FEATURE_ICONS[feature] && (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              {(() => {
                const Icon = FEATURE_ICONS[feature];
                return <Icon className="h-5 w-5 text-primary" />;
              })()}
            </div>
          )}
          <div>
            <h3 className="font-medium text-foreground">
              {t(`analytics:features.${getFeatureKey(feature)}`)}
            </h3>
            <p className="text-sm text-muted-foreground">
              {featureMetrics?.taskCount || 0} {t('analytics:labels.tasks')}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{t('analytics:metrics.successRate.successful')}:</span>
            <span className="ml-1 font-medium text-green-600 dark:text-green-400">
              {featureMetrics?.successCount || 0}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('analytics:metrics.successRate.failed')}:</span>
            <span className="ml-1 font-medium text-red-600 dark:text-red-400">
              {featureMetrics?.errorCount || 0}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('analytics:metrics.duration.average')}:</span>
            <span className="ml-1 font-medium">
              {formatDuration(featureMetrics?.averageDurationMs || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-1">
        <h4 className="text-sm font-medium text-muted-foreground mb-2">
          {t('analytics:drillDown.levels.task')}
        </h4>
        <ScrollArea className="max-h-64">
          <div className="space-y-2">
            {items.map((item) => (
              <DrillDownRow key={item.id} item={item} />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

interface TaskLevelViewProps {
  data: AnalyticsSummary;
  taskId: string;
  onSelectPhase?: (phase: AnalyticsPhase) => void;
}

function TaskLevelView({ data, taskId, onSelectPhase }: TaskLevelViewProps) {
  const { t } = useTranslation(['analytics']);

  const task = data.tasks.find((t) => t.taskId === taskId);

  if (!task) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          {t('analytics:charts.noData')}
        </p>
      </div>
    );
  }

  const totalPhaseDuration = task.phases.reduce((sum, p) => sum + p.durationMs, 0);
  const hasTokenDetails = task.tokenDetails && (task.tokenDetails.inputTokens > 0 || task.tokenDetails.outputTokens > 0);
  const hasCostDetails = task.costDetails && (task.costDetails.actualCostUsd || task.costDetails.estimatedApiCostUsd);
  const isInsightsChat = task.feature === 'insights' && task.phases.length === 0;

  const items: DrillDownItem[] = task.phases.map((phase) => ({
    id: phase.phase,
    label: t(`analytics:phases.${phase.phase}`),
    sublabel: phase.completedAt
      ? new Date(phase.completedAt).toLocaleString()
      : t('analytics:metrics.successRate.inProgress'),
    value: formatDuration(phase.durationMs),
    percentage: totalPhaseDuration > 0 ? (phase.durationMs / totalPhaseDuration) * 100 : 0,
    status: phase.completedAt ? 'success' : 'in_progress',
    onClick: onSelectPhase ? () => onSelectPhase(phase.phase) : undefined,
  }));

  return (
    <div className="space-y-4">
      {/* Task header */}
      <div className="rounded-lg border border-border p-4 bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-foreground truncate">
            {task.title || task.specId}
          </h3>
          <div className="flex items-center gap-2">
            {task.costDetails?.model && (
              <Badge variant="outline" className="text-xs">
                <Cpu className="h-3 w-3 mr-1" />
                {task.costDetails.model}
              </Badge>
            )}
            <TaskOutcomeBadge outcome={task.outcome} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{t('analytics:metrics.duration.total')}:</span>
            <span className="ml-1 font-medium">
              {formatDuration(task.totalDurationMs)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('analytics:labels.tokens')}:</span>
            <span className="ml-1 font-medium">
              {task.totalTokens > 0 ? formatTokenCount(task.totalTokens) : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* Token breakdown (if available) */}
      {hasTokenDetails && (
        <div className="rounded-lg border border-border p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t('analytics:metrics.tokenUsage.title')}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4 text-blue-500" />
              <div>
                <div className="text-xs text-muted-foreground">{t('analytics:labels.inputTokens')}</div>
                <div className="text-lg font-semibold">
                  {formatTokenCount(task.tokenDetails!.inputTokens)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpFromLine className="h-4 w-4 text-green-500" />
              <div>
                <div className="text-xs text-muted-foreground">{t('analytics:labels.outputTokens')}</div>
                <div className="text-lg font-semibold">
                  {formatTokenCount(task.tokenDetails!.outputTokens)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cost information (if available) */}
      {hasCostDetails && (
        <div className="rounded-lg border border-border p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Coins className="h-4 w-4" />
            {t('analytics:labels.cost')}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            {task.costDetails!.actualCostUsd !== undefined && (
              <div>
                <div className="text-xs text-muted-foreground">{t('analytics:labels.actualCost')}</div>
                <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {formatCost(task.costDetails!.actualCostUsd)}
                </div>
              </div>
            )}
            {task.costDetails!.estimatedApiCostUsd !== undefined && (
              <div>
                <div className="text-xs text-muted-foreground">{t('analytics:labels.estimatedCost')}</div>
                <div className="text-lg font-semibold">
                  {formatCost(task.costDetails!.estimatedApiCostUsd)}
                </div>
              </div>
            )}
          </div>
          {/* Note about Claude Code subscription */}
          <div className="mt-3 text-xs text-muted-foreground bg-muted/50 rounded p-2">
            <Info className="inline h-3 w-3 mb-0.5 mr-1" />
            {isInsightsChat
              ? t('analytics:labels.costNoteInsightsChat')
              : t('analytics:labels.costNoteSubscription')}
          </div>
        </div>
      )}

      {/* Phase breakdown (for non-Insights tasks) */}
      {items.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {t('analytics:metrics.duration.byPhase')}
          </h4>
          <div className="space-y-2">
            {items.map((item) => (
              <DrillDownRow key={item.id} item={item} showProgress />
            ))}
          </div>
        </div>
      )}

      {/* Note for Insights Chat sessions (no phases) */}
      {isInsightsChat && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <Info className="inline h-3 w-3 mb-0.5" />{' '}
          {t('analytics:labels.insightsChatNote')}
        </div>
      )}
    </div>
  );
}

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
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          {t('analytics:charts.noData')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Phase header */}
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="text-sm">
          {t(`analytics:phases.${phase}`)}
        </Badge>
        {phaseData.completedAt ? (
          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/50">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {t('analytics:outcomes.done')}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/50">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            {t('analytics:outcomes.inProgress')}
          </Badge>
        )}
      </div>

      {/* Duration */}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-foreground">
          {formatDuration(phaseData.durationMs)}
        </span>
      </div>

      {/* Phase details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PhaseDetailCard
          label={t('analytics:labels.started', { defaultValue: 'Started' })}
          value={
            phaseData.startedAt
              ? new Date(phaseData.startedAt).toLocaleString()
              : '-'
          }
        />
        <PhaseDetailCard
          label={t('analytics:labels.completed', { defaultValue: 'Completed' })}
          value={
            phaseData.completedAt
              ? new Date(phaseData.completedAt).toLocaleString()
              : '-'
          }
        />
      </div>

      {/* Token usage */}
      {phaseData.tokenCount > 0 && (
        <div className="rounded-lg border border-border p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {t('analytics:metrics.tokenUsage.title')}
          </h4>
          <span className="text-2xl font-bold text-foreground">
            {phaseData.tokenCount.toLocaleString()}
          </span>
          <span className="ml-2 text-sm text-muted-foreground">
            {t('analytics:labels.tokens')}
          </span>
        </div>
      )}

      {/* Subagent note */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Info className="inline h-3 w-3 mb-0.5" />{' '}
        {t('analytics:drillDown.levels.subagent')} breakdown will be available in a future update.
      </div>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

interface DrillDownRowProps {
  item: DrillDownItem;
  showProgress?: boolean;
}

function DrillDownRow({ item, showProgress = false }: DrillDownRowProps) {
  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-lg border border-border p-3 text-left transition-colors',
        item.onClick && 'cursor-pointer hover:border-primary/50 hover:bg-muted/50'
      )}
      onClick={item.onClick}
      disabled={!item.onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {item.icon && (
            <div className={cn('shrink-0', getStatusColor(item.status || 'neutral'))}>
              {item.icon}
            </div>
          )}
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground truncate block">
              {item.label}
            </span>
            {item.sublabel && (
              <span className="text-xs text-muted-foreground">
                {item.sublabel}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.status && (
            <StatusIndicator status={item.status} />
          )}
          {item.value && (
            <span className="text-sm text-muted-foreground">
              {item.value}
            </span>
          )}
          {item.onClick && (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>
      {showProgress && item.percentage !== undefined && (
        <div className="mt-2">
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(item.percentage, 100)}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {item.percentage.toFixed(1)}%
          </div>
        </div>
      )}
    </button>
  );
}

interface StatusIndicatorProps {
  status: 'success' | 'error' | 'in_progress' | 'neutral';
}

function StatusIndicator({ status }: StatusIndicatorProps) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    case 'in_progress':
      return <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />;
    default:
      return null;
  }
}

interface TaskOutcomeBadgeProps {
  outcome: string;
}

function TaskOutcomeBadge({ outcome }: TaskOutcomeBadgeProps) {
  const { t } = useTranslation(['analytics']);
  const status = getStatusFromOutcome(outcome);
  const outcomeKey = outcome === 'pr_created' ? 'prCreated' : outcome === 'in_progress' ? 'inProgress' : outcome;

  const colorClasses = {
    success: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/50',
    error: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/50',
    in_progress: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/50',
    neutral: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <Badge variant="outline" className={cn('text-xs', colorClasses[status])}>
      {t(`analytics:outcomes.${outcomeKey}`)}
    </Badge>
  );
}

interface SummaryStatCardProps {
  label: string;
  value: string;
  status?: 'success' | 'error' | 'in_progress' | 'neutral';
}

function SummaryStatCard({ label, value, status }: SummaryStatCardProps) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={cn('text-lg font-semibold', status ? getStatusColor(status) : 'text-foreground')}>
        {value}
      </div>
    </div>
  );
}

interface PhaseDetailCardProps {
  label: string;
  value: string;
}

function PhaseDetailCard({ label, value }: PhaseDetailCardProps) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function DrillDownSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}

function DrillDownEmptyState() {
  const { t } = useTranslation(['analytics']);

  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Clock className="h-6 w-6 text-muted-foreground" />
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

// ============================================
// Utility Functions
// ============================================

/**
 * Get breadcrumb path string for current drill-down state
 */
function getBreadcrumbPath(
  drillDown: DrillDownState,
  data: AnalyticsSummary | null,
  t: (key: string, options?: Record<string, string>) => string
): string {
  const parts: string[] = [t('analytics:drillDown.levels.app')];

  if (drillDown.level === 'overview') {
    return parts.join(' → ');
  }

  if (drillDown.feature) {
    const featureKey = getFeatureKey(drillDown.feature);
    parts.push(t(`analytics:features.${featureKey}`));
  }

  if (drillDown.level === 'task' || drillDown.level === 'phase') {
    if (drillDown.taskId && data) {
      const task = data.tasks.find((t) => t.taskId === drillDown.taskId);
      parts.push(task?.title || drillDown.taskId);
    }
  }

  if (drillDown.level === 'phase' && drillDown.phase) {
    parts.push(t(`analytics:phases.${drillDown.phase}`));
  }

  return parts.join(' → ');
}

// ============================================
// Exports
// ============================================

export {
  DrillDownEmptyState,
  DrillDownSkeleton,
  DrillDownRow,
  StatusIndicator,
  TaskOutcomeBadge,
  formatDuration,
  getStatusFromOutcome,
  getBreadcrumbPath,
};
