import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Coins,
  ChevronRight,
  ArrowLeft,
  Info,
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
 * Drill-down hierarchy levels for token usage
 * app -> feature -> task -> phase
 */
type TokenDrillDownLevel = 'app' | 'feature' | 'task' | 'phase';

/**
 * Current drill-down state for token usage navigation
 */
interface TokenDrillDownState {
  level: TokenDrillDownLevel;
  feature?: FeatureType;
  taskId?: string;
  phase?: AnalyticsPhase;
}

/**
 * Props for the TokenUsageChart component
 */
export interface TokenUsageChartProps {
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
 * TokenUsageChart component with hierarchical drill-down capability.
 *
 * Hierarchy: App → Feature → Task → Phase
 *
 * Shows token usage data from implementation plans. If no token data exists
 * (e.g., for tasks completed before token tracking was enabled), shows a
 * placeholder message indicating that data will appear as new tasks complete.
 *
 * @example
 * ```tsx
 * <TokenUsageChart
 *   data={analyticsSummary}
 *   isLoading={isLoading}
 *   activeFeature="kanban"
 * />
 * ```
 */
export function TokenUsageChart({
  data,
  isLoading = false,
  activeFeature = 'overview',
  className,
}: TokenUsageChartProps) {
  const { t } = useTranslation(['analytics']);

  // Drill-down navigation state
  const [drillDown, setDrillDown] = useState<TokenDrillDownState>({
    level: 'app',
  });

  // Navigation handlers
  const handleDrillDown = (
    level: TokenDrillDownLevel,
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

  // Check if there's any token data to display
  const hasTokenData = data !== null && data.totalTokens > 0;

  // Render loading state
  if (isLoading) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Coins className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">
                {t('analytics:metrics.tokenUsage.title')}
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

  // Render empty state when no token data exists yet
  if (!hasTokenData) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Coins className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">
                {t('analytics:metrics.tokenUsage.title')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('analytics:metrics.tokenUsage.description')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TokenTrackingPlaceholder />
        </CardContent>
      </Card>
    );
  }

  // Render actual chart with drill-down (future implementation)
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Coins className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">
                {t('analytics:metrics.tokenUsage.title')}
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
        <TokenUsageContent
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
 * Placeholder component for when no token data has been recorded yet
 */
function TokenTrackingPlaceholder() {
  const { t } = useTranslation(['analytics']);

  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Info className="h-6 w-6 text-muted-foreground" />
      </div>
      <h4 className="mb-2 text-sm font-medium text-foreground">
        {t('analytics:empty.tokenTrackingNotEnabled')}
      </h4>
      <p className="max-w-sm text-xs text-muted-foreground">
        {t('analytics:empty.tokenTrackingDescription')}
      </p>
      <Badge variant="outline" className="mt-4 text-xs">
        {t('analytics:labels.tokens')}
      </Badge>
    </div>
  );
}

/**
 * Props for TokenUsageContent component
 */
interface TokenUsageContentProps {
  data: AnalyticsSummary;
  drillDown: TokenDrillDownState;
  activeFeature: FeatureType | 'overview';
  onDrillDown: (
    level: TokenDrillDownLevel,
    options?: { feature?: FeatureType; taskId?: string; phase?: AnalyticsPhase }
  ) => void;
}

/**
 * Content renderer for different drill-down levels
 */
function TokenUsageContent({
  data,
  drillDown,
  activeFeature,
  onDrillDown,
}: TokenUsageContentProps) {
  const { t } = useTranslation(['analytics']);

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
 * App-level token usage view (shows all features or filtered by activeFeature)
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

  const totalTokens = features.reduce(
    (sum, [, metrics]) => sum + metrics.tokenCount,
    0
  );

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">
          {formatTokenCount(totalTokens)}
        </span>
        <span className="text-sm text-muted-foreground">
          {t('analytics:labels.tokens')}
        </span>
      </div>

      {/* Feature breakdown */}
      <div className="space-y-2">
        {features.map(([feature, metrics]) => (
          <TokenUsageRow
            key={feature}
            label={t(`analytics:features.${feature === 'github-prs' ? 'githubPRs' : feature}`)}
            tokens={metrics.tokenCount}
            totalTokens={totalTokens}
            onClick={() => onSelectFeature(feature as FeatureType)}
            showDrillDown
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Feature-level token usage view (shows tasks for selected feature)
 */
interface FeatureLevelViewProps {
  data: AnalyticsSummary;
  feature: FeatureType;
  onSelectTask: (taskId: string) => void;
}

function FeatureLevelView({ data, feature, onSelectTask }: FeatureLevelViewProps) {
  const { t } = useTranslation(['analytics']);

  const tasks = data.tasks.filter((task) => task.feature === feature);
  const totalTokens = tasks.reduce((sum, task) => sum + task.totalTokens, 0);

  if (tasks.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        {t('analytics:charts.noData')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">
          {formatTokenCount(totalTokens)}
        </span>
        <span className="text-sm text-muted-foreground">
          {t('analytics:labels.tokens')}
        </span>
      </div>

      {/* Task breakdown */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {tasks.map((task) => (
          <TokenUsageRow
            key={task.taskId}
            label={task.title || task.specId}
            tokens={task.totalTokens}
            totalTokens={totalTokens}
            onClick={() => onSelectTask(task.taskId)}
            showDrillDown
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Task-level token usage view (shows phases for selected task)
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

  const totalTokens = task.totalTokens;

  return (
    <div className="space-y-3">
      {/* Task title */}
      <div className="mb-2">
        <span className="text-sm font-medium text-foreground">
          {task.title || task.specId}
        </span>
      </div>

      {/* Summary */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">
          {formatTokenCount(totalTokens)}
        </span>
        <span className="text-sm text-muted-foreground">
          {t('analytics:labels.tokens')}
        </span>
      </div>

      {/* Phase breakdown */}
      <div className="space-y-2">
        {task.phases.map((phase) => (
          <TokenUsageRow
            key={phase.phase}
            label={t(`analytics:phases.${phase.phase}`)}
            tokens={phase.tokenCount}
            totalTokens={totalTokens}
            onClick={() => onSelectPhase(phase.phase)}
            showDrillDown
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Phase-level token usage view (deepest level - shows phase details)
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

      {/* Token count */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">
          {formatTokenCount(phaseData.tokenCount)}
        </span>
        <span className="text-sm text-muted-foreground">
          {t('analytics:labels.tokens')}
        </span>
      </div>

      {/* Phase metadata */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Started:</span>
          <span className="ml-2 text-foreground">
            {phaseData.startedAt
              ? new Date(phaseData.startedAt).toLocaleString()
              : '-'}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Completed:</span>
          <span className="ml-2 text-foreground">
            {phaseData.completedAt
              ? new Date(phaseData.completedAt).toLocaleString()
              : '-'}
          </span>
        </div>
      </div>

      {/* Note about subagent data (not yet available) */}
      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Info className="mb-1 inline h-3 w-3" /> {t('analytics:labels.subagentBreakdownNote')}
      </div>
    </div>
  );
}

/**
 * Reusable row component for token usage display
 */
interface TokenUsageRowProps {
  label: string;
  tokens: number;
  totalTokens: number;
  onClick?: () => void;
  showDrillDown?: boolean;
}

function TokenUsageRow({
  label,
  tokens,
  totalTokens,
  onClick,
  showDrillDown = false,
}: TokenUsageRowProps) {
  const percentage = totalTokens > 0 ? (tokens / totalTokens) * 100 : 0;

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
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {formatTokenCount(tokens)}
          </span>
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
 * Format token count for display
 */
function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toLocaleString();
}

/**
 * Get breadcrumb string for current drill-down state
 */
function getBreadcrumb(
  drillDown: TokenDrillDownState,
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

  return parts.join(' → ');
}

/**
 * Export helper for testing
 */
export { formatTokenCount, TokenTrackingPlaceholder };
