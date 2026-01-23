import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import {
  BarChart3,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Activity,
  DollarSign,
  Coins
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { cn } from '../lib/utils';
import {
  useAnalyticsStore,
  loadAnalytics,
  refreshAnalytics,
  changeAndLoadDateFilter
} from '../stores/analytics-store';
import { DateFilterBar } from './analytics/DateFilterBar';
import { FeatureTabs } from './analytics/FeatureTabs';
import { MetricCard } from './analytics/MetricCard';
import { TaskListWithSorting } from './analytics/TaskListWithSorting';
import { formatTokenCount } from './analytics/TokenUsageChart';
import type { DateFilter, FeatureType, FeatureMetrics } from '../../shared/types';

interface AnalyticsProps {
  projectId: string;
}

/**
 * Format duration from milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

/**
 * Main Analytics Dashboard component
 *
 * Provides a comprehensive view of usage patterns across all features:
 * - Token consumption tracking
 * - Task duration analysis
 * - Success rate metrics
 * - Feature segmentation with drill-down capability
 */
export function Analytics({ projectId }: AnalyticsProps) {
  const { t } = useTranslation(['analytics', 'common']);

  // Store state
  const summary = useAnalyticsStore((state) => state.summary);
  const dateFilter = useAnalyticsStore((state) => state.dateFilter);
  const activeFeature = useAnalyticsStore((state) => state.activeFeature);
  const loadingState = useAnalyticsStore((state) => state.loadingState);
  const error = useAnalyticsStore((state) => state.error);

  // Store actions
  const setActiveFeature = useAnalyticsStore((state) => state.setActiveFeature);

  // Load analytics on mount and when projectId changes
  useEffect(() => {
    loadAnalytics(projectId);
  }, [projectId]);

  // Handle date filter change
  const handleDateFilterChange = useCallback(
    (filter: DateFilter) => {
      changeAndLoadDateFilter(projectId, filter);
    },
    [projectId]
  );

  // Handle feature tab change
  const handleFeatureChange = useCallback(
    (feature: FeatureType | 'overview') => {
      setActiveFeature(feature);
    },
    [setActiveFeature]
  );

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refreshAnalytics();
  }, []);

  const isLoading = loadingState === 'loading';
  const hasError = loadingState === 'error';
  const hasData = summary !== null && summary.totalTasks > 0;

  // Get current feature metrics
  const currentFeatureMetrics: FeatureMetrics | null =
    activeFeature === 'overview' || !summary
      ? null
      : summary.byFeature[activeFeature] || null;

  // Get filtered tasks for current feature
  const featureTasks = useMemo(() => {
    if (activeFeature === 'overview' || !summary) return [];
    return summary.tasks.filter((task) => task.feature === activeFeature);
  }, [summary, activeFeature]);

  // Calculate feature-level cost from tasks
  const featureCost = useMemo(() => {
    return featureTasks.reduce((sum, task) => {
      const cost = task.costDetails?.actualCostUsd || task.costDetails?.estimatedApiCostUsd || 0;
      return sum + cost;
    }, 0);
  }, [featureTasks]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {t('analytics:title')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('analytics:description')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DateFilterBar
              value={dateFilter}
              onChange={handleDateFilterChange}
              disabled={isLoading}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw
                className={cn(
                  'mr-2 h-4 w-4',
                  isLoading && 'animate-spin'
                )}
              />
              {t('analytics:actions.refresh')}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {/* Loading State */}
        {isLoading && !summary && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {t('analytics:loading.title')}
            </p>
          </div>
        )}

        {/* Error State */}
        {hasError && (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="text-center">
              <h3 className="mb-2 text-lg font-medium text-foreground">
                {t('analytics:errors.loadFailed')}
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {error || t('analytics:errors.aggregationFailed')}
              </p>
              <Button onClick={handleRefresh} variant="outline">
                {t('analytics:errors.retry')}
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !hasError && !hasData && (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <h3 className="mb-2 text-lg font-medium text-foreground">
                {t('analytics:empty.title')}
              </h3>
              <p className="max-w-md text-sm text-muted-foreground">
                {t('analytics:empty.description')}
              </p>
            </div>
          </div>
        )}

        {/* Data View */}
        {!hasError && hasData && summary && (
          <FeatureTabs
            activeFeature={activeFeature}
            onFeatureChange={handleFeatureChange}
            disabled={isLoading}
          >
            <ScrollArea className="h-full px-6 py-4">
              {/* Overview Summary Cards */}
              {activeFeature === 'overview' && (
                <div className="space-y-6">
                  {/* Primary Metrics Row */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard
                      label={t('analytics:summary.totalTasks')}
                      value={summary.totalTasks}
                      icon={<Activity className="h-4 w-4" />}
                    />
                    <MetricCard
                      label={t('analytics:summary.averageDuration')}
                      value={formatDuration(summary.averageDurationMs)}
                      icon={<Clock className="h-4 w-4" />}
                    />
                    <MetricCard
                      label={t('analytics:summary.successRate')}
                      value={`${summary.successRate.toFixed(1)}%`}
                      icon={<TrendingUp className="h-4 w-4" />}
                      variant={
                        summary.successRate >= 80
                          ? 'success'
                          : summary.successRate >= 50
                            ? 'warning'
                            : 'error'
                      }
                    />
                    <MetricCard
                      label={t('analytics:metrics.tokenUsage.total')}
                      value={summary.totalTokens}
                      icon={<BarChart3 className="h-4 w-4" />}
                      tooltip={t('analytics:tooltips.tokenUsage')}
                    />
                    <MetricCard
                      label={t('analytics:labels.actualCost')}
                      value={`$${summary.totalCostUsd.toFixed(2)}`}
                      icon={<DollarSign className="h-4 w-4" />}
                      tooltip={t('analytics:tooltips.cost')}
                    />
                  </div>

                  {/* Outcome Breakdown */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        {t('analytics:metrics.successRate.title')}
                      </CardTitle>
                      <CardDescription>
                        {t('analytics:metrics.successRate.description')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/50">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <div>
                            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                              {summary.successCount}
                            </p>
                            <p className="text-sm text-green-600 dark:text-green-400">
                              {t('analytics:metrics.successRate.successful')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/50">
                          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                          <div>
                            <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                              {summary.errorCount}
                            </p>
                            <p className="text-sm text-red-600 dark:text-red-400">
                              {t('analytics:metrics.successRate.failed')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/50">
                          <Loader2 className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                          <div>
                            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                              {summary.inProgressCount}
                            </p>
                            <p className="text-sm text-yellow-600 dark:text-yellow-400">
                              {t('analytics:metrics.successRate.inProgress')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Feature Breakdown */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        {t('analytics:features.overview')}
                      </CardTitle>
                      <CardDescription>
                        {t('analytics:description')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {(Object.entries(summary.byFeature) as [FeatureType, FeatureMetrics][])
                          .filter(([, metrics]) => metrics.taskCount > 0)
                          .map(([feature, metrics]) => (
                            <FeatureMetricsCard
                              key={feature}
                              feature={feature}
                              metrics={metrics}
                              onClick={() => handleFeatureChange(feature)}
                            />
                          ))}
                        {Object.values(summary.byFeature).every(
                          (m) => m.taskCount === 0
                        ) && (
                          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                            {t('analytics:empty.noDataForPeriod')}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Token Tracking MVP Notice */}
                  {summary.totalTokens === 0 && (
                    <Card className="border-dashed">
                      <CardContent className="flex items-center gap-4 py-6">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          <BarChart3 className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">
                            {t('analytics:empty.tokenTrackingNotEnabled')}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {t('analytics:empty.tokenTrackingDescription')}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Feature-Specific View */}
              {activeFeature !== 'overview' && (
                <div className="space-y-6">
                  {currentFeatureMetrics && currentFeatureMetrics.taskCount > 0 ? (
                    <>
                      {/* Feature Metrics */}
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                        <MetricCard
                          label={t('analytics:labels.tasks')}
                          value={currentFeatureMetrics.taskCount}
                          icon={<Activity className="h-4 w-4" />}
                        />
                        <MetricCard
                          label={t('analytics:summary.averageDuration')}
                          value={formatDuration(currentFeatureMetrics.averageDurationMs)}
                          icon={<Clock className="h-4 w-4" />}
                        />
                        <MetricCard
                          label={t('analytics:metrics.tokenUsage.total')}
                          value={formatTokenCount(currentFeatureMetrics.tokenCount)}
                          icon={<Coins className="h-4 w-4" />}
                          tooltip={t('analytics:tooltips.tokenUsage')}
                        />
                        <MetricCard
                          label={t('analytics:labels.actualCost')}
                          value={`$${featureCost.toFixed(2)}`}
                          icon={<DollarSign className="h-4 w-4" />}
                          tooltip={t('analytics:tooltips.cost')}
                        />
                        <MetricCard
                          label={t('analytics:metrics.successRate.successful')}
                          value={currentFeatureMetrics.successCount}
                          icon={<CheckCircle2 className="h-4 w-4" />}
                          variant="success"
                        />
                        <MetricCard
                          label={t('analytics:metrics.successRate.failed')}
                          value={currentFeatureMetrics.errorCount}
                          icon={<XCircle className="h-4 w-4" />}
                          variant={currentFeatureMetrics.errorCount > 0 ? 'error' : 'default'}
                        />
                      </div>

                      {/* Task List for this Feature with Sorting */}
                      <TaskListWithSorting tasks={featureTasks} />
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                        <BarChart3 className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="mb-2 text-lg font-medium text-foreground">
                        {t('analytics:empty.noDataForFeature')}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t('analytics:empty.description')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </FeatureTabs>
        )}
      </div>
    </div>
  );
}

/**
 * Feature metrics card for the overview grid
 */
interface FeatureMetricsCardProps {
  feature: FeatureType;
  metrics: FeatureMetrics;
  onClick: () => void;
}

function FeatureMetricsCard({ feature, metrics, onClick }: FeatureMetricsCardProps) {
  const { t } = useTranslation(['analytics']);

  const featureLabels: Record<FeatureType, string> = {
    kanban: t('analytics:features.kanban'),
    insights: t('analytics:features.insights'),
    roadmap: t('analytics:features.roadmap'),
    ideation: t('analytics:features.ideation'),
    changelog: t('analytics:features.changelog'),
    'github-prs': t('analytics:features.githubPRs')
  };

  const successRate =
    metrics.taskCount > 0
      ? ((metrics.successCount / metrics.taskCount) * 100).toFixed(0)
      : '0';

  return (
    <Card
      className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <CardContent className="p-4">
        <h4 className="mb-2 font-medium text-foreground">
          {featureLabels[feature]}
        </h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">{t('analytics:labels.tasks')}:</span>{' '}
            <span className="font-medium">{metrics.taskCount}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('analytics:summary.successRate')}:</span>{' '}
            <span
              className={cn(
                'font-medium',
                Number(successRate) >= 80
                  ? 'text-green-600 dark:text-green-400'
                  : Number(successRate) >= 50
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-red-600 dark:text-red-400'
              )}
            >
              {successRate}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

