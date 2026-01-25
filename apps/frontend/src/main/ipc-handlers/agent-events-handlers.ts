import type { BrowserWindow } from "electron";
import path from "path";
import { existsSync } from "fs";
import { IPC_CHANNELS, AUTO_BUILD_PATHS, getSpecsDir } from "../../shared/constants";
import {
  wouldPhaseRegress,
  isTerminalPhase,
  isValidExecutionPhase,
  isValidPhaseTransition,
  type ExecutionPhase,
} from "../../shared/constants/phase-protocol";
import type {
  SDKRateLimitInfo,
  AuthFailureInfo,
  Task,
  TaskStatus,
  Project,
  ImplementationPlan,
} from "../../shared/types";
import { AgentManager } from "../agent";
import type { ProcessType, ExecutionProgressData } from "../agent";
import { titleGenerator } from "../title-generator";
import { fileWatcher } from "../file-watcher";
import { projectStore } from "../project-store";
import { notificationService } from "../notification-service";
import { persistPlanStatusSync, getPlanPath } from "./task/plan-file-utils";
import { findTaskWorktree } from "../worktree-paths";
import { findTaskAndProject } from "./task/shared";
import { safeSendToRenderer } from "./utils";
import { getClaudeProfileManager } from "../claude-profile-manager";
import { TaskStateMachine } from "../task-state-machine";
import { getTaskStateManager } from '../task-state-manager';

/**
 * Validates status transitions to prevent invalid state changes.
 * FIX (ACS-55, ACS-71): Adds guardrails against bad status transitions.
 * FIX (PR Review): Uses comprehensive wouldPhaseRegress() utility instead of hardcoded checks.
 * FIX (ACS-203): Adds phase completion validation to prevent phase overlaps.
 *
 * @param task - The current task (may be undefined if not found)
 * @param newStatus - The proposed new status
 * @param phase - The execution phase that triggered this transition
 * @returns true if transition is valid, false if it should be blocked
 */
function validateStatusTransition(
  task: Task | undefined,
  newStatus: TaskStatus,
  phase: string
): boolean {
  // Can't validate without task data - allow the transition
  if (!task) return true;

  // Don't allow human_review without subtasks
  // This prevents tasks from jumping to review before planning is complete
  if (newStatus === "human_review" && (!task.subtasks || task.subtasks.length === 0)) {
    console.warn(
      `[validateStatusTransition] Blocking human_review - task ${task.id} has no subtasks (phase: ${phase})`
    );
    return false;
  }

  // FIX (PR Review): Use comprehensive phase regression check instead of hardcoded checks
  // This handles all phase regressions (qa_review→coding, complete→coding, etc.)
  // not just the specific coding→planning case
  const currentPhase = task.executionProgress?.phase;
  const completedPhases = task.executionProgress?.completedPhases || [];

  if (currentPhase && isValidExecutionPhase(currentPhase) && isValidExecutionPhase(phase)) {
    // Block transitions from terminal phases (complete/failed)
    if (isTerminalPhase(currentPhase)) {
      console.warn(
        `[validateStatusTransition] Blocking transition from terminal phase: ${currentPhase} for task ${task.id}`
      );
      return false;
    }

    // Block any phase regression (going backwards in the workflow)
    // Note: Cast phase to ExecutionPhase since isValidExecutionPhase() type guard doesn't narrow through function calls
    if (wouldPhaseRegress(currentPhase, phase as ExecutionPhase)) {
      console.warn(
        `[validateStatusTransition] Blocking phase regression: ${currentPhase} -> ${phase} for task ${task.id}`
      );
      return false;
    }

    // FIX (ACS-203): Validate phase transitions based on completed phases
    // This prevents multiple phases from being active simultaneously
    // e.g., coding starting while planning is still marked as active
    const newPhase = phase as ExecutionPhase;
    if (!isValidPhaseTransition(currentPhase, newPhase, completedPhases)) {
      console.warn(
        `[validateStatusTransition] Blocking invalid phase transition: ${currentPhase} -> ${newPhase} for task ${task.id}`,
        {
          currentPhase,
          newPhase,
          completedPhases,
          reason: "Prerequisite phases not completed",
        }
      );
      return false;
    }
  }

  return true;
}

/**
 * Register all agent-events-related IPC handlers
 */
export function registerAgenteventsHandlers(
  agentManager: AgentManager,
  getMainWindow: () => BrowserWindow | null
): void {
  const taskStateMachine = new TaskStateMachine();
  // ============================================
  // Agent Manager Events → Renderer
  // ============================================

  agentManager.on("log", (taskId: string, log: string) => {
    // Include projectId for multi-project filtering (issue #723)
    const { project } = findTaskAndProject(taskId);
    safeSendToRenderer(getMainWindow, IPC_CHANNELS.TASK_LOG, taskId, log, project?.id);
  });

  agentManager.on("error", (taskId: string, error: string) => {
    // Include projectId for multi-project filtering (issue #723)
    const { project } = findTaskAndProject(taskId);
    safeSendToRenderer(getMainWindow, IPC_CHANNELS.TASK_ERROR, taskId, error, project?.id);
  });

  // Handle SDK rate limit events from agent manager
  agentManager.on("sdk-rate-limit", (rateLimitInfo: SDKRateLimitInfo) => {
    safeSendToRenderer(getMainWindow, IPC_CHANNELS.CLAUDE_SDK_RATE_LIMIT, rateLimitInfo);
  });

  // Handle SDK rate limit events from title generator
  titleGenerator.on("sdk-rate-limit", (rateLimitInfo: SDKRateLimitInfo) => {
    safeSendToRenderer(getMainWindow, IPC_CHANNELS.CLAUDE_SDK_RATE_LIMIT, rateLimitInfo);
  });

  // Handle auth failure events (401 errors requiring re-authentication)
  agentManager.on("auth-failure", (taskId: string, authFailure: {
    profileId?: string;
    failureType?: 'missing' | 'invalid' | 'expired' | 'unknown';
    message?: string;
    originalError?: string;
  }) => {
    console.warn(`[AgentEvents] Auth failure detected for task ${taskId}:`, authFailure);

    // Get profile name for display
    const profileManager = getClaudeProfileManager();
    const profile = authFailure.profileId
      ? profileManager.getProfile(authFailure.profileId)
      : profileManager.getActiveProfile();

    const authFailureInfo: AuthFailureInfo = {
      profileId: authFailure.profileId || profile?.id || 'unknown',
      profileName: profile?.name,
      failureType: authFailure.failureType || 'unknown',
      message: authFailure.message || 'Authentication failed. Please re-authenticate.',
      originalError: authFailure.originalError,
      taskId,
      detectedAt: new Date(),
    };

    safeSendToRenderer(getMainWindow, IPC_CHANNELS.CLAUDE_AUTH_FAILURE, authFailureInfo);
  });

  agentManager.on("exit", (taskId: string, code: number | null, processType: ProcessType) => {
    // Get project info early for multi-project filtering (issue #723)
    const { project: exitProject } = findTaskAndProject(taskId);
    const exitProjectId = exitProject?.id;

    // Send final plan state to renderer BEFORE unwatching
    // This ensures the renderer has the final subtask data (fixes 0/0 subtask bug)
    const finalPlan = fileWatcher.getCurrentPlan(taskId);
    if (finalPlan) {
      safeSendToRenderer(
        getMainWindow,
        IPC_CHANNELS.TASK_PROGRESS,
        taskId,
        finalPlan,
        exitProjectId
      );
    }

    fileWatcher.unwatch(taskId);

    if (processType === "spec-creation") {
      console.warn(`[Task ${taskId}] Spec creation completed with code ${code}`);
      return;
    }

    let task: Task | undefined;
    let project: Project | undefined;

    try {
      const projects = projectStore.getProjects();

      // IMPORTANT: Invalidate cache for all projects to ensure we get fresh data
      // This prevents race conditions where cached task data has stale status
      for (const p of projects) {
        projectStore.invalidateTasksCache(p.id);
      }

      for (const p of projects) {
        const tasks = projectStore.getTasks(p.id);
        task = tasks.find((t) => t.id === taskId || t.specId === taskId);
        if (task) {
          project = p;
          break;
        }
      }

      if (task && project) {
        const taskTitle = task.title || task.specId;
        const mainPlanPath = getPlanPath(project, task);
        const projectId = project.id; // Capture for closure

        // Capture task values for closure
        const taskSpecId = task.specId;
        const projectPath = project.path;
        const autoBuildPath = project.autoBuildPath;

        // Use shared utility for persisting status (prevents race conditions)
        // Persist to both main project AND worktree (if exists) for consistency
        const persistStatus = (status: TaskStatus) => {
          // Persist to main project
          const mainPersisted = persistPlanStatusSync(mainPlanPath, status, projectId);
          if (mainPersisted) {
            console.warn(`[Task ${taskId}] Persisted status to main plan: ${status}`);
          }

          // Also persist to worktree if it exists
          const worktreePath = findTaskWorktree(projectPath, taskSpecId);
          if (worktreePath) {
            const specsBaseDir = getSpecsDir(autoBuildPath);
            const worktreePlanPath = path.join(
              worktreePath,
              specsBaseDir,
              taskSpecId,
              AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN
            );
            if (existsSync(worktreePlanPath)) {
              const worktreePersisted = persistPlanStatusSync(worktreePlanPath, status, projectId);
              if (worktreePersisted) {
                console.warn(`[Task ${taskId}] Persisted status to worktree plan: ${status}`);
              }
            }
          }
        };

        const hasSubtasks = task.subtasks && task.subtasks.length > 0;
        const allSubtasksDone = hasSubtasks && task.subtasks.every((s) => s.status === "completed");
        const requireReviewBeforeCoding = task.metadata?.requireReviewBeforeCoding === true;

        taskStateMachine.logProcessExit({
          taskId,
          exitCode: code ?? 0,
          task,
          hasSubtasks,
          allSubtasksDone,
          requireReviewBeforeCoding,
        });

        const manager = getTaskStateManager(getMainWindow);
        manager.handleProcessExit(task, project, code ?? 0, hasSubtasks, allSubtasksDone);

        if (code === 0) {
          notificationService.notifyReviewNeeded(taskTitle, project.id, taskId);
        } else {
          notificationService.notifyTaskFailed(taskTitle, project.id, taskId);
        }

        const decision = taskStateMachine.getStatusForProcessExit({
          taskId,
          exitCode: code ?? 0,
          task,
          hasSubtasks,
          allSubtasksDone,
          requireReviewBeforeCoding,
        });
        const decisionWithFallback =
          requireReviewBeforeCoding && !decision.status
            ? { status: "human_review", reviewReason: "plan_review" }
            : decision;

        if (code === 0) {
          const isActiveStatus = task.status === "in_progress" || task.status === "ai_review";
          if (decisionWithFallback.status) {
            persistStatus(decisionWithFallback.status);
            taskStateMachine.emitStatusChange(
              getMainWindow,
              taskId,
              decisionWithFallback.status,
              projectId,
              decisionWithFallback.reviewReason
            );
          } else if (isActiveStatus) {
            console.warn(
              `[Task ${taskId}] Process exited but status unchanged (current status: ${task.status})`
            );
          }
        } else {
          const nextStatus = decisionWithFallback.status ?? "human_review";
          persistStatus(nextStatus);
          taskStateMachine.emitStatusChange(
            getMainWindow,
            taskId,
            nextStatus,
            projectId,
            decisionWithFallback.reviewReason
          );
        }
      }
    } catch (error) {
      console.error(`[Task ${taskId}] Exit handler error:`, error);
    }
  });

  agentManager.on("execution-progress", (taskId: string, progress: ExecutionProgressData) => {
    // Use shared helper to find task and project (issue #723 - deduplicate lookup)
    const { task, project } = findTaskAndProject(taskId);
    const taskProjectId = project?.id;

    taskStateMachine.logExecutionProgress(taskId, progress, taskProjectId);

    // Include projectId in execution progress event for multi-project filtering
    safeSendToRenderer(
      getMainWindow,
      IPC_CHANNELS.TASK_EXECUTION_PROGRESS,
      taskId,
      progress,
      taskProjectId
    );

    if (task && project) {
      const manager = getTaskStateManager(getMainWindow);
      manager.handleExecutionProgress(task, project, progress);

      const fallbackStatus = taskStateMachine.getStatusForExecutionProgress(progress);
      if (fallbackStatus === "ai_review" || fallbackStatus === "human_review") {
        if (validateStatusTransition(task, fallbackStatus, progress.phase)) {
          taskStateMachine.emitStatusChange(getMainWindow, taskId, fallbackStatus, taskProjectId);
        }
        try {
          const mainPlanPath = getPlanPath(project, task);
          persistPlanStatusSync(mainPlanPath, fallbackStatus, project.id);

          const worktreePath = findTaskWorktree(project.path, task.specId);
          if (worktreePath) {
            const specsBaseDir = getSpecsDir(project.autoBuildPath);
            const worktreePlanPath = path.join(
              worktreePath,
              specsBaseDir,
              task.specId,
              AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN
            );
            if (existsSync(worktreePlanPath)) {
              persistPlanStatusSync(worktreePlanPath, fallbackStatus, project.id);
            }
          }
        } catch (err) {
          console.warn("[execution-progress] Could not persist xstate fallback:", err);
        }
      }
    }
  });

  // ============================================
  // File Watcher Events → Renderer
  // ============================================

  fileWatcher.on("progress", (taskId: string, plan: ImplementationPlan) => {
    // Use shared helper to find project (issue #723 - deduplicate lookup)
    const { project } = findTaskAndProject(taskId);
    safeSendToRenderer(getMainWindow, IPC_CHANNELS.TASK_PROGRESS, taskId, plan, project?.id);
  });

  fileWatcher.on("error", (taskId: string, error: string) => {
    // Include projectId for multi-project filtering (issue #723)
    const { project } = findTaskAndProject(taskId);
    safeSendToRenderer(getMainWindow, IPC_CHANNELS.TASK_ERROR, taskId, error, project?.id);
  });
}
