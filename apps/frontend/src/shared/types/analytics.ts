/**
 * Analytics dashboard types
 */

// ============================================
// Date Filter Types
// ============================================

/**
 * Predefined date range filter options
 */
export type DateFilter =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'this_month'
  | 'last_month'
  | 'last_6_months'
  | 'this_year'
  | 'all_time';

/**
 * Custom date range for future extensibility
 */
export interface DateRange {
  start: Date;
  end: Date;
}

// ============================================
// Feature Types
// ============================================

/**
 * Features that can be tracked in analytics
 */
export type FeatureType =
  | 'kanban'
  | 'insights'
  | 'roadmap'
  | 'ideation'
  | 'changelog'
  | 'github-prs';

// ============================================
// Metrics Types
// ============================================

/**
 * Execution phase type for analytics
 * Matches TaskLogPhase from task.ts
 */
export type AnalyticsPhase = 'planning' | 'coding' | 'validation';

/**
 * Metrics for a single execution phase
 */
export interface PhaseMetrics {
  phase: AnalyticsPhase;
  tokenCount: number;
  durationMs: number;
  startedAt: string;  // ISO date string
  completedAt?: string;  // ISO date string
}

/**
 * Task outcome status for analytics
 * Maps to Task.status with analytics-relevant outcomes
 */
export type TaskOutcome = 'done' | 'pr_created' | 'staged' | 'error' | 'in_progress';

/**
 * Detailed token usage breakdown
 */
export interface TokenUsageDetails {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
}

/**
 * Cost information for a task or session
 */
export interface CostDetails {
  /** Actual cost from API (if available) */
  actualCostUsd?: number;
  /** Estimated API cost based on token counts and model pricing */
  estimatedApiCostUsd?: number;
  /** Model used for this task/session */
  model?: string;
}

/**
 * Analytics data for a single task
 */
export interface TaskAnalytics {
  taskId: string;
  specId: string;
  title: string;
  feature: FeatureType;
  totalTokens: number;
  totalDurationMs: number;
  phases: PhaseMetrics[];
  outcome: TaskOutcome;
  createdAt: string;  // ISO date string
  completedAt?: string;  // ISO date string
  /** Detailed token breakdown (input/output) */
  tokenDetails?: TokenUsageDetails;
  /** Cost information */
  costDetails?: CostDetails;
}

// ============================================
// Aggregated Metrics Types
// ============================================

/**
 * Metrics aggregated for a specific feature
 */
export interface FeatureMetrics {
  feature: FeatureType;
  tokenCount: number;
  taskCount: number;
  averageDurationMs: number;
  successCount: number;
  errorCount: number;
}

/**
 * Summary of analytics for a given time period
 */
export interface AnalyticsSummary {
  period: DateFilter;
  dateRange: DateRange;
  totalTokens: number;
  totalCostUsd: number;  // Total estimated API cost across all tasks
  totalTasks: number;
  averageDurationMs: number;
  successRate: number;  // Percentage: (done + pr_created + staged) / total * 100
  successCount: number;
  errorCount: number;
  inProgressCount: number;
  byFeature: Record<FeatureType, FeatureMetrics>;
  tasks: TaskAnalytics[];  // Individual task data for drill-down
}

// ============================================
// Drill-Down Types
// ============================================

/**
 * Level of drill-down detail
 */
export type DrillDownLevel = 'overview' | 'feature' | 'task' | 'phase';

/**
 * Current drill-down state for navigation
 */
export interface DrillDownState {
  level: DrillDownLevel;
  feature?: FeatureType;
  taskId?: string;
  phase?: AnalyticsPhase;
}

// ============================================
// Store State Types
// ============================================

/**
 * Loading state for analytics data
 */
export type AnalyticsLoadingState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Analytics store state interface
 */
export interface AnalyticsState {
  // Data
  summary: AnalyticsSummary | null;

  // Filters
  dateFilter: DateFilter;
  activeFeature: FeatureType | 'overview';

  // Drill-down navigation
  drillDown: DrillDownState;

  // Loading state
  loadingState: AnalyticsLoadingState;
  error: string | null;

  // Cache
  lastFetched: Date | null;
}

// ============================================
// Empty State Types
// ============================================

/**
 * Reason why analytics data is empty
 */
export type EmptyStateReason =
  | 'no_project'
  | 'no_tasks'
  | 'no_data_in_range'
  | 'feature_not_used';

/**
 * Empty state information for UI rendering
 */
export interface AnalyticsEmptyState {
  reason: EmptyStateReason;
  dateFilter: DateFilter;
  feature?: FeatureType;
}
