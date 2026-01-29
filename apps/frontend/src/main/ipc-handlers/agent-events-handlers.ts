import type { BrowserWindow } from "electron";
import path from "path";
import { existsSync, readFileSync } from "fs";
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
  ImplementationPlan,
} from "../../shared/types";
import { AgentManager } from "../agent";
import type { ProcessType, ExecutionProgressData } from "../agent";
import { titleGenerator } from "../title-generator";
import { fileWatcher } from "../file-watcher";
import { projectStore } from "../project-store";
import { notificationService } from "../notification-service";
import { persistPlanStatus } from "./task/plan-file-utils";
import { findTaskWorktree } from "../worktree-paths";
// FIX: Removed findTaskAndProject import - it triggers heavy sync I/O via getTasks()
// All handlers now use lightweight project lookup (existsSync) instead
import { safeSendToRenderer } from "./utils";
import { getClaudeProfileManager } from "../claude-profile-manager";
import type { Project } from "../../shared/types";

/**
 * Lightweight project lookup by taskId without heavy I/O.
 * Checks if a spec directory exists for the given taskId in any project.
 * This avoids the heavy getTasks() call that reads multiple files per spec.
 */
function findProjectByTaskId(taskId: string): { project: Project; projectId: string } | undefined {
  const projects = projectStore.getProjects();
  for (const p of projects) {
    // Use default .auto-claude path if autoBuildPath not set (matches getSpecsDir behavior)
    const specsBaseDir = getSpecsDir(p.autoBuildPath);
    const specPath = path.join(p.path, specsBaseDir, taskId);
    if (existsSync(specPath)) {
      return { project: p, projectId: p.id };
    }
  }
  return undefined;
}

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
  // ============================================
  // Agent Manager Events → Renderer
  // ============================================

  agentManager.on("log", (taskId: string, log: string) => {
    const found = findProjectByTaskId(taskId);
    safeSendToRenderer(getMainWindow, IPC_CHANNELS.TASK_LOG, taskId, log, found?.projectId);
  });

  agentManager.on("error", (taskId: string, error: string) => {
    const found = findProjectByTaskId(taskId);
    safeSendToRenderer(getMainWindow, IPC_CHANNELS.TASK_ERROR, taskId, error, found?.projectId);
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
    console.warn(`[Exit Handler] START for task ${taskId}, code=${code}, type=${processType}`);

    try {
      // FIX: Find project WITHOUT calling getTasks() - lightweight lookup
      const found = findProjectByTaskId(taskId);
      const foundProject = found?.project;
      const projectId = found?.projectId;
      console.warn(`[Exit Handler] Found project: ${projectId || 'none'}`);

      // FIX: Get plan data from file watcher cache FIRST (zero I/O - already in memory)
      // This avoids the heavy sync file I/O in findTaskAndProject() that was causing crashes
      let finalPlan = fileWatcher.getCurrentPlan(taskId);

      // Fallback: If file watcher doesn't have the plan (e.g., in tests or edge cases),
      // read it directly from disk. This is a single file read, much lighter than getTasks()
      if (!finalPlan && foundProject) {
        try {
          const specsBaseDir = getSpecsDir(foundProject.autoBuildPath);
          const planPath = path.join(foundProject.path, specsBaseDir, taskId, AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN);
          if (existsSync(planPath)) {
            const planContent = readFileSync(planPath, 'utf-8');
            finalPlan = JSON.parse(planContent);
            console.warn(`[Exit Handler] Read plan from disk (fallback)`);
          }
        } catch (readErr) {
          console.warn(`[Exit Handler] Could not read plan from disk:`, readErr);
        }
      }
      console.warn(`[Exit Handler] Got finalPlan: ${finalPlan ? 'yes' : 'no'}`);

      // Send final plan state to renderer BEFORE unwatching
      // This ensures the renderer has the final subtask data (fixes 0/0 subtask bug)
      if (finalPlan) {
        safeSendToRenderer(
          getMainWindow,
          IPC_CHANNELS.TASK_PROGRESS,
          taskId,
          finalPlan,
          projectId
        );
        console.warn(`[Exit Handler] Sent final plan to renderer`);
      }

      // Unwatch asynchronously - don't block on it
      fileWatcher.unwatch(taskId).catch((err) => {
        console.error(`[Exit Handler] Error unwatching:`, err);
      });
      console.warn(`[Exit Handler] Initiated unwatch`);

      if (processType === "spec-creation") {
        console.warn(`[Task ${taskId}] Spec creation completed with code ${code}`);
        return;
      }

      // FIX: Use plan data from file watcher cache (or fallback from disk) for immediate operations
      // This avoids the heavy getTasks() call that reads multiple files per spec
      if (foundProject && finalPlan) {
        console.warn(`[Exit Handler] Processing task completion for ${taskId}`);

        // Get title from plan (file watcher already has this in memory)
        const taskTitle = finalPlan.feature || finalPlan.title || taskId;

        // Capture values for deferred async work
        const projectPath = foundProject.path;
        const autoBuildPath = foundProject.autoBuildPath;
        const specsBaseDir = getSpecsDir(autoBuildPath);
        const mainPlanPath = path.join(projectPath, specsBaseDir, taskId, AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN);

        // Use subtasks from the plan (already in memory from file watcher)
        const allSubtasks = finalPlan.phases?.flatMap((phase) => phase.subtasks || []) || [];
        const hasSubtasks = allSubtasks.length > 0;
        const allSubtasksCompleted = hasSubtasks && allSubtasks.every((s) => s.status === "completed");
        console.warn(`[Exit Handler] Subtasks: ${allSubtasks.length}, completed: ${allSubtasksCompleted}`);

        // Determine what status to persist and whether to send IPC
        let statusToPersist: TaskStatus | null = null;
        let shouldSendStatusIpc = false;

        if (code === 0) {
          console.warn(`[Exit Handler] Sending review notification for ${taskTitle}`);
          // Send notification IMMEDIATELY (before any file I/O)
          notificationService.notifyReviewNeeded(taskTitle, foundProject.id, taskId);
          console.warn(`[Exit Handler] Notification sent`);

          // Fallback: Ensure status is updated even if COMPLETE phase event was missed
          // FIX (ACS-71): Only move to human_review if subtasks exist AND are all completed
          if (hasSubtasks && allSubtasksCompleted) {
            console.warn(
              `[Task ${taskId}] Fallback: Moving to human_review (process exited successfully, all ${allSubtasks.length} subtasks completed)`
            );
            statusToPersist = "human_review";
            shouldSendStatusIpc = true;
          } else if (!hasSubtasks) {
            console.warn(
              `[Task ${taskId}] Process exited but no subtasks created yet - keeping current status`
            );
          }
        } else {
          console.warn(`[Exit Handler] Sending failure notification for ${taskTitle}`);
          // Send notification IMMEDIATELY (before any file I/O)
          notificationService.notifyTaskFailed(taskTitle, foundProject.id, taskId);
          console.warn(`[Exit Handler] Failure notification sent`);
          statusToPersist = "human_review";
          shouldSendStatusIpc = true;
        }

        // Send IPC to renderer IMMEDIATELY for instant UI feedback
        if (shouldSendStatusIpc && statusToPersist) {
          console.warn(`[Exit Handler] Sending status IPC: ${statusToPersist}`);
          safeSendToRenderer(
            getMainWindow,
            IPC_CHANNELS.TASK_STATUS_CHANGE,
            taskId,
            statusToPersist,
            projectId
          );
          console.warn(`[Exit Handler] Status IPC sent`);
        }

        console.warn(`[Exit Handler] Scheduling deferred work`);
        // FIX: Defer ALL heavy file I/O to prevent blocking the main process
        // This follows the established pattern in execution-handlers.ts
        setImmediate(async () => {
          try {
            // Invalidate cache for all projects to ensure fresh data on next read
            for (const p of projectStore.getProjects()) {
              projectStore.invalidateTasksCache(p.id);
            }

            // Persist status to plan files using async version (prevents race conditions)
            if (statusToPersist) {
              // Persist to main project
              const mainPersisted = await persistPlanStatus(mainPlanPath, statusToPersist, projectId);
              if (mainPersisted) {
                console.warn(`[Task ${taskId}] Persisted status to main plan: ${statusToPersist}`);
              }

              // Also persist to worktree if it exists
              const worktreePath = findTaskWorktree(projectPath, taskId);
              if (worktreePath) {
                const worktreePlanPath = path.join(
                  worktreePath,
                  specsBaseDir,
                  taskId,
                  AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN
                );
                if (existsSync(worktreePlanPath)) {
                  const worktreePersisted = await persistPlanStatus(worktreePlanPath, statusToPersist, projectId);
                  if (worktreePersisted) {
                    console.warn(`[Task ${taskId}] Persisted status to worktree plan: ${statusToPersist}`);
                  }
                }
              }
            }
          } catch (error) {
            console.error(`[Task ${taskId}] Exit handler deferred work error:`, error);
          }
        });
        console.warn(`[Exit Handler] Deferred work scheduled`);
      }
      console.warn(`[Exit Handler] END for task ${taskId}`);
    } catch (error) {
      console.error(`[Exit Handler] CRASH for task ${taskId}:`, error);
    }
  });

  agentManager.on("execution-progress", (taskId: string, progress: ExecutionProgressData) => {
    try {
      // FIX: Find project WITHOUT calling getTasks() - lightweight lookup
      const found = findProjectByTaskId(taskId);
      const foundProject = found?.project;
      const taskProjectId = found?.projectId;

    // Include projectId in execution progress event for multi-project filtering
    safeSendToRenderer(
      getMainWindow,
      IPC_CHANNELS.TASK_EXECUTION_PROGRESS,
      taskId,
      progress,
      taskProjectId
    );

    const phaseToStatus: Record<string, TaskStatus | null> = {
      idle: null,
      planning: "in_progress",
      coding: "in_progress",
      qa_review: "ai_review",
      qa_fixing: "ai_review",
      complete: "human_review",
      failed: "human_review",
    };

    const newStatus = phaseToStatus[progress.phase];
    if (newStatus && foundProject) {
      // FIX: For status validation, use the plan from file watcher (already in memory)
      // instead of calling findTaskAndProject() which triggers heavy I/O
      const cachedPlan = fileWatcher.getCurrentPlan(taskId);
      const cachedTask: Task | undefined = cachedPlan ? {
        id: taskId,
        specId: taskId,
        projectId: foundProject.id,
        title: cachedPlan.feature || cachedPlan.title || taskId,
        description: '',
        status: (cachedPlan.status as TaskStatus) || 'in_progress',
        subtasks: cachedPlan.phases?.flatMap((p) => p.subtasks || []).map((s) => ({
          id: s.id,
          title: s.description,
          description: s.description,
          status: s.status,
          files: []
        })) || [],
        logs: [],
        executionProgress: {
          phase: progress.phase,
          phaseProgress: progress.phaseProgress || 0,
          overallProgress: progress.overallProgress || 0,
          completedPhases: progress.completedPhases || [],
        },
        createdAt: cachedPlan.created_at ? new Date(cachedPlan.created_at) : new Date(),
        updatedAt: cachedPlan.updated_at ? new Date(cachedPlan.updated_at) : new Date()
      } : undefined;

      // FIX (ACS-55, ACS-71): Validate status transition before sending/persisting
      if (validateStatusTransition(cachedTask, newStatus, progress.phase)) {
        // Include projectId in status change event for multi-project filtering
        safeSendToRenderer(
          getMainWindow,
          IPC_CHANNELS.TASK_STATUS_CHANGE,
          taskId,
          newStatus,
          taskProjectId
        );

        // FIX: Defer file persistence to prevent blocking the main process
        // This follows the established pattern in execution-handlers.ts
        const projectPath = foundProject.path;
        const autoBuildPath = foundProject.autoBuildPath;
        const specsBaseDir = getSpecsDir(autoBuildPath);
        const mainPlanPath = path.join(projectPath, specsBaseDir, taskId, AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN);

        setImmediate(async () => {
          try {
            // Persist to main project plan file using async version
            await persistPlanStatus(mainPlanPath, newStatus, taskProjectId);

            // Also persist to worktree plan file if it exists
            const worktreePath = findTaskWorktree(projectPath, taskId);
            if (worktreePath) {
              const worktreePlanPath = path.join(
                worktreePath,
                specsBaseDir,
                taskId,
                AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN
              );
              if (existsSync(worktreePlanPath)) {
                await persistPlanStatus(worktreePlanPath, newStatus, taskProjectId);
              }
            }
          } catch (err) {
            // Ignore persistence errors - UI will still work, just might flip on refresh
            console.warn("[execution-progress] Could not persist status:", err);
          }
        });
      }
    }
    } catch (error) {
      console.error(`[execution-progress] CRASH for task ${taskId}:`, error);
    }
  });

  // ============================================
  // File Watcher Events → Renderer
  // ============================================

  fileWatcher.on("progress", (taskId: string, plan: ImplementationPlan) => {
    const found = findProjectByTaskId(taskId);
    safeSendToRenderer(getMainWindow, IPC_CHANNELS.TASK_PROGRESS, taskId, plan, found?.projectId);
  });

  fileWatcher.on("error", (taskId: string, error: string) => {
    const found = findProjectByTaskId(taskId);
    safeSendToRenderer(getMainWindow, IPC_CHANNELS.TASK_ERROR, taskId, error, found?.projectId);
  });
}
