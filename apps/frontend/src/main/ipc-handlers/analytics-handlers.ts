import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../../shared/constants";
import type {
  IPCResult,
  Task,
  DateFilter,
  DateRange,
  FeatureType,
  FeatureMetrics,
  TaskAnalytics,
  TaskOutcome,
  AnalyticsSummary,
  PhaseMetrics,
  AnalyticsPhase,
} from "../../shared/types";
import { projectStore } from "../project-store";

/**
 * Get date range based on predefined filter
 */
function getDateRange(filter: DateFilter): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter) {
    case "today":
      return {
        start: today,
        end: now,
      };
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        start: yesterday,
        end: today,
      };
    }
    case "last_7_days": {
      const last7Days = new Date(today);
      last7Days.setDate(last7Days.getDate() - 7);
      return {
        start: last7Days,
        end: now,
      };
    }
    case "this_month": {
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start: thisMonth,
        end: now,
      };
    }
    case "last_month": {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        start: lastMonthStart,
        end: lastMonthEnd,
      };
    }
    case "last_6_months": {
      const last6Months = new Date(today);
      last6Months.setMonth(last6Months.getMonth() - 6);
      return {
        start: last6Months,
        end: now,
      };
    }
    case "this_year": {
      const thisYear = new Date(now.getFullYear(), 0, 1);
      return {
        start: thisYear,
        end: now,
      };
    }
    case "all_time":
    default:
      // Return a very early date for all time
      return {
        start: new Date(2020, 0, 1),
        end: now,
      };
  }
}

/**
 * Map task source type to analytics feature type
 */
function getFeatureType(task: Task): FeatureType {
  const sourceType = task.metadata?.sourceType;

  switch (sourceType) {
    case "insights":
      return "insights";
    case "roadmap":
      return "roadmap";
    case "ideation":
      return "ideation";
    case "github":
      return "github-prs";
    case "linear":
      // Linear issues are typically managed in kanban
      return "kanban";
    case "manual":
    case "imported":
    default:
      // Default to kanban for manual/imported/unknown tasks
      return "kanban";
  }
}

/**
 * Map task status to analytics outcome
 */
function getTaskOutcome(task: Task): TaskOutcome {
  switch (task.status) {
    case "done":
      return "done";
    case "pr_created":
      return "pr_created";
    case "error":
      return "error";
    case "in_progress":
    case "ai_review":
    case "human_review":
    case "queue":
    case "backlog":
    default:
      // Check if staged
      if (task.stagedInMainProject) {
        return "staged";
      }
      return "in_progress";
  }
}

/**
 * Calculate duration in milliseconds between two dates
 */
function calculateDurationMs(createdAt: Date, updatedAt: Date): number {
  return Math.max(0, updatedAt.getTime() - createdAt.getTime());
}

/**
 * Extract phase metrics from task (MVP: placeholder data)
 * Token usage is not currently tracked, so we return empty phases
 * Duration is estimated from task timestamps
 */
function extractPhaseMetrics(task: Task): PhaseMetrics[] {
  // MVP: Return empty phases since we don't have detailed phase timing
  // In the future, this can be populated from implementation_plan.json
  const phases: PhaseMetrics[] = [];

  // If task has execution progress, we can at least note which phase it was in
  if (task.executionProgress?.phase) {
    const phase = task.executionProgress.phase as AnalyticsPhase;
    if (["planning", "coding", "validation"].includes(phase)) {
      phases.push({
        phase: phase as AnalyticsPhase,
        tokenCount: 0, // Token tracking not yet implemented
        durationMs: calculateDurationMs(
          new Date(task.createdAt),
          new Date(task.updatedAt)
        ),
        startedAt: task.createdAt.toISOString(),
        completedAt: task.updatedAt.toISOString(),
      });
    }
  }

  return phases;
}

/**
 * Convert Task to TaskAnalytics
 */
function taskToAnalytics(task: Task): TaskAnalytics {
  const durationMs = calculateDurationMs(
    new Date(task.createdAt),
    new Date(task.updatedAt)
  );

  return {
    taskId: task.id,
    specId: task.specId,
    title: task.title,
    feature: getFeatureType(task),
    totalTokens: 0, // Token tracking not yet implemented
    totalDurationMs: durationMs,
    phases: extractPhaseMetrics(task),
    outcome: getTaskOutcome(task),
    createdAt: task.createdAt.toISOString(),
    completedAt: task.status === "done" || task.status === "pr_created" || task.status === "error"
      ? task.updatedAt.toISOString()
      : undefined,
  };
}

/**
 * Create empty feature metrics
 */
function createEmptyFeatureMetrics(feature: FeatureType): FeatureMetrics {
  return {
    feature,
    tokenCount: 0,
    taskCount: 0,
    averageDurationMs: 0,
    successCount: 0,
    errorCount: 0,
  };
}

/**
 * Aggregate analytics data from tasks
 */
function aggregateAnalytics(
  tasks: Task[],
  filter: DateFilter,
  dateRange: DateRange
): AnalyticsSummary {
  // Filter tasks by date range
  const filteredTasks = tasks.filter((task) => {
    const taskDate = new Date(task.createdAt);
    return taskDate >= dateRange.start && taskDate <= dateRange.end;
  });

  // Convert to TaskAnalytics
  const taskAnalytics = filteredTasks.map(taskToAnalytics);

  // Initialize feature metrics
  const features: FeatureType[] = ["kanban", "insights", "roadmap", "ideation", "changelog", "github-prs"];
  const byFeature: Record<FeatureType, FeatureMetrics> = {} as Record<FeatureType, FeatureMetrics>;

  for (const feature of features) {
    byFeature[feature] = createEmptyFeatureMetrics(feature);
  }

  // Aggregate metrics
  let totalTokens = 0;
  let totalDurationMs = 0;
  let successCount = 0;
  let errorCount = 0;
  let inProgressCount = 0;

  for (const analytics of taskAnalytics) {
    // Update totals
    totalTokens += analytics.totalTokens;
    totalDurationMs += analytics.totalDurationMs;

    // Update feature metrics
    const featureMetrics = byFeature[analytics.feature];
    featureMetrics.tokenCount += analytics.totalTokens;
    featureMetrics.taskCount += 1;

    // Calculate running average for duration
    const oldAvg = featureMetrics.averageDurationMs;
    const count = featureMetrics.taskCount;
    featureMetrics.averageDurationMs = oldAvg + (analytics.totalDurationMs - oldAvg) / count;

    // Update success/error counts
    if (analytics.outcome === "done" || analytics.outcome === "pr_created" || analytics.outcome === "staged") {
      successCount += 1;
      featureMetrics.successCount += 1;
    } else if (analytics.outcome === "error") {
      errorCount += 1;
      featureMetrics.errorCount += 1;
    } else {
      inProgressCount += 1;
    }
  }

  // Calculate overall success rate
  const completedTasks = successCount + errorCount;
  const successRate = completedTasks > 0 ? (successCount / completedTasks) * 100 : 0;

  // Calculate overall average duration
  const averageDurationMs = taskAnalytics.length > 0
    ? totalDurationMs / taskAnalytics.length
    : 0;

  return {
    period: filter,
    dateRange,
    totalTokens,
    totalTasks: taskAnalytics.length,
    averageDurationMs,
    successRate,
    successCount,
    errorCount,
    inProgressCount,
    byFeature,
    tasks: taskAnalytics,
  };
}

/**
 * Register all analytics-related IPC handlers
 *
 * Implements the getAnalytics IPC handler for the frontend store
 * which aggregates task data by date filter and feature type.
 */
export function registerAnalyticsHandlers(): void {
  // ============================================
  // Analytics Operations
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.ANALYTICS_GET,
    async (_, projectId: string, filter: DateFilter): Promise<IPCResult<AnalyticsSummary>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: "Project not found" };
      }

      try {
        // Get all tasks for the project
        const tasks = projectStore.getTasks(projectId);

        // Calculate date range from filter
        const dateRange = getDateRange(filter);

        // Aggregate analytics
        const summary = aggregateAnalytics(tasks, filter, dateRange);

        return { success: true, data: summary };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to get analytics";
        return { success: false, error: errorMessage };
      }
    }
  );
}
