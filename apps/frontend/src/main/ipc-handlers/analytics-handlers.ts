import { ipcMain } from "electron";
import * as fs from "fs";
import * as path from "path";
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
  TokenUsageDetails,
  CostDetails,
} from "../../shared/types";
import { calculateApiCost } from "../../shared/constants/pricing";
import { projectStore } from "../project-store";

/**
 * Interface for subtask data from implementation_plan.json
 */
interface ImplementationSubtask {
  id: string;
  description: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  input_tokens?: number;
  output_tokens?: number;
  total_cost_usd?: number;
}

/**
 * Interface for phase data from implementation_plan.json
 */
interface ImplementationPhase {
  id: string;
  name: string;
  subtasks: ImplementationSubtask[];
}

/**
 * Interface for implementation plan JSON
 */
interface ImplementationPlan {
  feature: string;
  phases: ImplementationPhase[];
}

/**
 * Load implementation plan from disk
 */
function loadImplementationPlan(projectPath: string, specId: string): ImplementationPlan | null {
  try {
    const planPath = path.join(projectPath, ".auto-claude", "specs", specId, "implementation_plan.json");
    if (!fs.existsSync(planPath)) {
      return null;
    }
    const content = fs.readFileSync(planPath, "utf-8");
    return JSON.parse(content) as ImplementationPlan;
  } catch (error) {
    console.warn('[Analytics] Failed to load implementation plan:', specId, error);
    return null;
  }
}

/**
 * Interface for insights session message with token usage
 */
interface InsightsMessageWithTokens {
  role: string;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalCostUsd?: number;
  };
  timestamp?: string;
}

/**
 * Interface for insights session JSON
 */
interface InsightsSessionJson {
  id: string;
  title?: string;
  messages: InsightsMessageWithTokens[];
  modelConfig?: {
    model?: string;
    thinkingLevel?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Result type for insights session loading
 */
interface InsightsUsageResult {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  sessionCount: number;
  /** Synthetic task analytics entries for drill-down support */
  taskAnalytics: TaskAnalytics[];
}

/**
 * Load all insights sessions from disk and aggregate token usage
 * Also creates synthetic TaskAnalytics entries for drill-down support
 */
function loadInsightsTokenUsage(projectPath: string, dateRange: DateRange): InsightsUsageResult {
  const result: InsightsUsageResult = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    sessionCount: 0,
    taskAnalytics: [],
  };

  try {
    const sessionsDir = path.join(projectPath, ".auto-claude", "insights", "sessions");
    if (!fs.existsSync(sessionsDir)) {
      return result;
    }

    const sessionFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith(".json"));

    for (const file of sessionFiles) {
      try {
        const sessionPath = path.join(sessionsDir, file);
        const content = fs.readFileSync(sessionPath, "utf-8");
        const session = JSON.parse(content) as InsightsSessionJson;

        // Check if session is within date range
        const sessionDate = session.updatedAt ? new Date(session.updatedAt) : new Date();
        if (sessionDate < dateRange.start || sessionDate > dateRange.end) {
          continue;
        }

        let sessionInputTokens = 0;
        let sessionOutputTokens = 0;
        let sessionCostUsd = 0;

        // Aggregate token usage from assistant messages
        for (const msg of session.messages) {
          if (msg.role === "assistant" && msg.tokenUsage) {
            sessionInputTokens += msg.tokenUsage.inputTokens || 0;
            sessionOutputTokens += msg.tokenUsage.outputTokens || 0;
            sessionCostUsd += msg.tokenUsage.totalCostUsd || 0;
          }
        }

        // Update totals for sessions with tokens
        if (sessionInputTokens > 0 || sessionOutputTokens > 0) {
          result.totalInputTokens += sessionInputTokens;
          result.totalOutputTokens += sessionOutputTokens;
          result.totalCostUsd += sessionCostUsd;
        }

        // Count all sessions (not just ones with tokens)
        result.sessionCount += 1;

        // Create TaskAnalytics entry for ALL sessions (for drill-down support)
        const sessionTitle = session.title || `Chat Session`;
        const sessionCreatedAt = session.createdAt;
        const sessionUpdatedAt = session.updatedAt;

        // Get model from session config (default to sonnet for insights)
        const model = session.modelConfig?.model || "sonnet";

        // Calculate session duration
        const sessionDurationMs = sessionCreatedAt && sessionUpdatedAt
          ? Math.max(0, new Date(sessionUpdatedAt).getTime() - new Date(sessionCreatedAt).getTime())
          : 0;

        // Calculate estimated API cost if actual cost not available
        const estimatedApiCost = calculateApiCost(sessionInputTokens, sessionOutputTokens, model);

        const taskAnalyticsEntry = {
          taskId: `insights-${session.id}`,
          specId: session.id,
          title: sessionTitle,
          feature: "insights" as FeatureType,
          totalTokens: sessionInputTokens + sessionOutputTokens,
          totalDurationMs: sessionDurationMs,
          phases: [], // Insights chat doesn't have phases
          outcome: "done" as TaskOutcome,
          createdAt: sessionCreatedAt || new Date().toISOString(),
          completedAt: sessionUpdatedAt,
          // Add token details
          tokenDetails: {
            inputTokens: sessionInputTokens,
            outputTokens: sessionOutputTokens,
          },
          // Add cost details
          costDetails: {
            actualCostUsd: sessionCostUsd > 0 ? sessionCostUsd : undefined,
            estimatedApiCostUsd: estimatedApiCost,
            model,
          },
        };
        console.log("[Analytics] Created insights task entry:", {
          title: sessionTitle,
          totalTokens: taskAnalyticsEntry.totalTokens,
          durationMs: sessionDurationMs,
          tokenDetails: taskAnalyticsEntry.tokenDetails,
          costDetails: taskAnalyticsEntry.costDetails,
        });
        result.taskAnalytics.push(taskAnalyticsEntry);
      } catch {
        // Skip invalid session files
      }
    }
  } catch {
    // Return empty result if insights directory doesn't exist or is unreadable
  }

  return result;
}

/**
 * Extract token usage from implementation plan
 * Returns total input/output tokens and per-phase metrics
 */
function extractTokenUsageFromPlan(plan: ImplementationPlan | null): {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number | null;
  phases: PhaseMetrics[];
} {
  if (!plan) {
    return {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: null,
      phases: [],
    };
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd: number | null = null;
  const phases: PhaseMetrics[] = [];

  for (const phase of plan.phases) {
    let phaseInputTokens = 0;
    let phaseOutputTokens = 0;
    let phaseCostUsd: number | null = null;
    let phaseStartedAt: string | undefined;
    let phaseCompletedAt: string | undefined;

    for (const subtask of phase.subtasks) {
      phaseInputTokens += subtask.input_tokens || 0;
      phaseOutputTokens += subtask.output_tokens || 0;

      if (subtask.total_cost_usd !== undefined) {
        phaseCostUsd = (phaseCostUsd || 0) + subtask.total_cost_usd;
      }

      // Track earliest start and latest completion for phase timing
      if (subtask.started_at) {
        if (!phaseStartedAt || subtask.started_at < phaseStartedAt) {
          phaseStartedAt = subtask.started_at;
        }
      }
      if (subtask.completed_at) {
        if (!phaseCompletedAt || subtask.completed_at > phaseCompletedAt) {
          phaseCompletedAt = subtask.completed_at;
        }
      }
    }

    totalInputTokens += phaseInputTokens;
    totalOutputTokens += phaseOutputTokens;
    if (phaseCostUsd !== null) {
      totalCostUsd = (totalCostUsd || 0) + phaseCostUsd;
    }

    // Calculate phase duration
    let durationMs = 0;
    if (phaseStartedAt && phaseCompletedAt) {
      durationMs = new Date(phaseCompletedAt).getTime() - new Date(phaseStartedAt).getTime();
      durationMs = Math.max(0, durationMs);
    }

    // Map phase name to analytics phase type
    const phaseName = phase.name.toLowerCase();
    let analyticsPhase: AnalyticsPhase = "coding"; // default
    if (phaseName.includes("plan")) {
      analyticsPhase = "planning";
    } else if (phaseName.includes("valid") || phaseName.includes("qa") || phaseName.includes("test")) {
      analyticsPhase = "validation";
    }

    // Only add phase if it has data and a valid start time
    if ((phaseInputTokens > 0 || phaseOutputTokens > 0 || durationMs > 0) && phaseStartedAt) {
      phases.push({
        phase: analyticsPhase,
        tokenCount: phaseInputTokens + phaseOutputTokens,
        durationMs,
        startedAt: phaseStartedAt,
        completedAt: phaseCompletedAt,
      });
    }
  }

  return { totalInputTokens, totalOutputTokens, totalCostUsd, phases };
}

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
 * Extract phase metrics from task using implementation plan data
 * Falls back to basic task timestamps if plan is not available
 */
function extractPhaseMetrics(task: Task, projectPath: string): PhaseMetrics[] {
  // Try to load implementation plan for detailed phase data
  const plan = loadImplementationPlan(projectPath, task.specId);
  const planData = extractTokenUsageFromPlan(plan);

  // If we have phase data from the plan, use it
  if (planData.phases.length > 0) {
    return planData.phases;
  }

  // Fallback: If task has execution progress, create a basic phase entry
  const phases: PhaseMetrics[] = [];
  if (task.executionProgress?.phase) {
    const phase = task.executionProgress.phase as AnalyticsPhase;
    if (["planning", "coding", "validation"].includes(phase)) {
      phases.push({
        phase: phase as AnalyticsPhase,
        tokenCount: 0,
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
 * Convert Task to TaskAnalytics with token usage from implementation plan
 */
function taskToAnalytics(task: Task, projectPath: string): TaskAnalytics {
  const durationMs = calculateDurationMs(
    new Date(task.createdAt),
    new Date(task.updatedAt)
  );

  // Load implementation plan for token usage
  const plan = loadImplementationPlan(projectPath, task.specId);
  const planData = extractTokenUsageFromPlan(plan);
  const totalTokens = planData.totalInputTokens + planData.totalOutputTokens;

  // Get phases with timing data
  const phases = extractPhaseMetrics(task, projectPath);

  // Calculate actual duration from phase data if available
  let actualDurationMs = durationMs;
  if (phases.length > 0) {
    const firstPhaseStart = phases.find(p => p.startedAt)?.startedAt;
    const lastPhaseEnd = phases.reduce((latest, p) => {
      if (p.completedAt && (!latest || p.completedAt > latest)) {
        return p.completedAt;
      }
      return latest;
    }, undefined as string | undefined);

    if (firstPhaseStart && lastPhaseEnd) {
      actualDurationMs = new Date(lastPhaseEnd).getTime() - new Date(firstPhaseStart).getTime();
      actualDurationMs = Math.max(0, actualDurationMs);
    }
  }

  return {
    taskId: task.id,
    specId: task.specId,
    title: task.title,
    feature: getFeatureType(task),
    totalTokens,
    totalDurationMs: actualDurationMs,
    phases,
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
  dateRange: DateRange,
  projectPath: string
): AnalyticsSummary {
  // Filter tasks by date range
  const filteredTasks = tasks.filter((task) => {
    const taskDate = new Date(task.createdAt);
    return taskDate >= dateRange.start && taskDate <= dateRange.end;
  });

  // Convert to TaskAnalytics with project path for implementation plan lookups
  const taskAnalytics = filteredTasks.map(task => taskToAnalytics(task, projectPath));

  // Initialize feature metrics
  const features: FeatureType[] = ["kanban", "insights", "roadmap", "ideation", "changelog", "github-prs"];
  const byFeature: Record<FeatureType, FeatureMetrics> = {} as Record<FeatureType, FeatureMetrics>;

  for (const feature of features) {
    byFeature[feature] = createEmptyFeatureMetrics(feature);
  }

  // Aggregate metrics
  let totalTokens = 0;
  let totalCostUsd = 0;
  let totalDurationMs = 0;
  let successCount = 0;
  let errorCount = 0;
  let inProgressCount = 0;

  for (const analytics of taskAnalytics) {
    // Update totals
    totalTokens += analytics.totalTokens;
    totalDurationMs += analytics.totalDurationMs;
    // Add cost from task if available
    if (analytics.costDetails?.actualCostUsd) {
      totalCostUsd += analytics.costDetails.actualCostUsd;
    } else if (analytics.costDetails?.estimatedApiCostUsd) {
      totalCostUsd += analytics.costDetails.estimatedApiCostUsd;
    }

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

  // Add insights chat sessions to the "insights" feature
  const insightsData = loadInsightsTokenUsage(projectPath, dateRange);
  console.log("[Analytics] Insights data loaded:", {
    projectPath,
    dateRange: { start: dateRange.start.toISOString(), end: dateRange.end.toISOString() },
    sessionCount: insightsData.sessionCount,
    totalInputTokens: insightsData.totalInputTokens,
    totalOutputTokens: insightsData.totalOutputTokens,
    taskAnalyticsCount: insightsData.taskAnalytics.length,
  });

  // Always add insights sessions (even those without tokens)
  if (insightsData.sessionCount > 0) {
    const insightsChatTokens = insightsData.totalInputTokens + insightsData.totalOutputTokens;
    totalTokens += insightsChatTokens;
    totalCostUsd += insightsData.totalCostUsd;
    byFeature["insights"].tokenCount += insightsChatTokens;

    // Count all sessions as "tasks" for the insights feature
    byFeature["insights"].taskCount += insightsData.sessionCount;
    byFeature["insights"].successCount += insightsData.sessionCount; // Chat sessions are always "successful"
    successCount += insightsData.sessionCount;

    // Calculate average duration for insights sessions
    const totalInsightsDurationMs = insightsData.taskAnalytics.reduce(
      (sum, task) => sum + task.totalDurationMs,
      0
    );
    totalDurationMs += totalInsightsDurationMs;

    if (insightsData.taskAnalytics.length > 0) {
      // Calculate running average for insights duration
      const oldAvg = byFeature["insights"].averageDurationMs;
      const oldCount = byFeature["insights"].taskCount - insightsData.sessionCount;
      const newAvg = totalInsightsDurationMs / insightsData.taskAnalytics.length;
      byFeature["insights"].averageDurationMs = oldCount > 0
        ? (oldAvg * oldCount + newAvg * insightsData.sessionCount) / byFeature["insights"].taskCount
        : newAvg;
    }

    // Add all task analytics for drill-down support
    taskAnalytics.push(...insightsData.taskAnalytics);
    console.log("[Analytics] Added insights sessions:", {
      insightsChatTokens,
      totalTokens,
      avgDurationMs: byFeature["insights"].averageDurationMs,
      featureMetrics: byFeature["insights"],
      addedTasks: insightsData.taskAnalytics.length,
    });
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
    totalCostUsd,
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

        // Aggregate analytics with project path for implementation plan lookups
        const summary = aggregateAnalytics(tasks, filter, dateRange, project.path);

        return { success: true, data: summary };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to get analytics";
        return { success: false, error: errorMessage };
      }
    }
  );
}
