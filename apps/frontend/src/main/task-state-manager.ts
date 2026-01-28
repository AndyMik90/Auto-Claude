import type { BrowserWindow } from 'electron';
import path from 'path';
import { existsSync } from 'fs';
import { createActor } from 'xstate';
import type { ActorRefFrom, SnapshotFrom } from 'xstate';
import { taskMachine } from '../shared/state-machines/task-machine';
import type { ExecutionProgress, Project, ReviewReason, Task, TaskStatus } from '../shared/types';
import { AUTO_BUILD_PATHS, getSpecsDir, IPC_CHANNELS } from '../shared/constants';
import { logger } from './app-logger';
import { safeSendToRenderer } from './ipc-handlers/utils';
import { findTaskWorktree } from './worktree-paths';
import { getPlanPath, persistPlanStatusSync } from './ipc-handlers/task/plan-file-utils';
import { isDebugEnabled } from './task-state-utils';

type TaskMachineActor = ActorRefFrom<typeof taskMachine>;
type TaskMachineSnapshot = SnapshotFrom<typeof taskMachine>;

type LegacyStatus = {
  status: TaskStatus;
  reviewReason?: ReviewReason;
};

type TaskContext = {
  task: Task;
  project: Project;
};

export class TaskStateManager {
  private readonly actors = new Map<string, TaskMachineActor>();
  private readonly taskContext = new Map<string, TaskContext>();
  private readonly lastLegacy = new Map<string, LegacyStatus>();

  constructor(private readonly getMainWindow: () => BrowserWindow | null) {}

  /**
   * Get the current status from XState actor for a task.
   * Returns null if no actor exists (task not being tracked).
   * This should be used during refresh to preserve running state.
   */
  getCurrentStatus(taskId: string): { status: TaskStatus; reviewReason?: ReviewReason } | null {
    const actor = this.actors.get(taskId);
    if (!actor) {
      return null;
    }
    const snapshot = actor.getSnapshot();
    return this.mapSnapshotToLegacy(snapshot);
  }

  /**
   * Check if a task has an active XState actor (is being tracked).
   */
  hasActiveActor(taskId: string): boolean {
    return this.actors.has(taskId);
  }

  /**
   * Cleans up resources for a specific task.
   * Call this when a task is deleted or no longer needs tracking.
   */
  cleanupTask(taskId: string): void {
    const actor = this.actors.get(taskId);
    if (actor) {
      actor.stop();
      this.actors.delete(taskId);
    }
    this.taskContext.delete(taskId);
    this.lastLegacy.delete(taskId);
    logger.info(`[TaskStateManager] Cleaned up task: ${taskId}`);
  }

  /**
   * Cleans up all resources. Call this on app shutdown.
   */
  cleanup(): void {
    for (const [taskId, actor] of this.actors) {
      actor.stop();
      logger.info(`[TaskStateManager] Stopped actor for task: ${taskId}`);
    }
    this.actors.clear();
    this.taskContext.clear();
    this.lastLegacy.clear();
    logger.info('[TaskStateManager] All resources cleaned up');
  }

  handleExecutionProgress(task: Task, project: Project, progress: ExecutionProgress): void {
    this.taskContext.set(task.id, { task, project });
    this.logExecutionProgress(task.id, progress, project.id);

    const actor = this.getActor(task);
    const currentState = actor.getSnapshot().value;
    const requireReviewBeforeCoding = task.metadata?.requireReviewBeforeCoding === true;
    if (
      currentState === 'planning' &&
      progress.phase !== 'planning' &&
      progress.phase !== 'idle'
    ) {
      actor.send({ type: 'PLANNING_COMPLETE', requireReviewBeforeCoding });
      if (requireReviewBeforeCoding) {
        return;
      }
    }
    if (
      currentState === 'backlog' &&
      progress.phase !== 'planning' &&
      progress.phase !== 'idle'
    ) {
      actor.send({ type: 'PLANNING_STARTED' });
      actor.send({ type: 'PLANNING_COMPLETE', requireReviewBeforeCoding });
      if (requireReviewBeforeCoding) {
        return;
      }
    }
    this.syncActorToPhase(actor, progress.phase, requireReviewBeforeCoding);
    const event = this.mapProgressToEvent(progress);
    if (event) {
      actor.send(event);
    }
  }

  private syncActorToPhase(
    actor: TaskMachineActor,
    phase: ExecutionProgress['phase'],
    requireReviewBeforeCoding: boolean
  ): void {
    if (requireReviewBeforeCoding) {
      return;
    }

    const snapshot = actor.getSnapshot();
    const state = typeof snapshot.value === 'string' ? snapshot.value : null;
    if (!state) {
      return;
    }

    if (state === 'human_review' || state === 'error' || state === 'done') {
      return;
    }

    const ensurePlanningComplete = () => {
      if (state === 'backlog') {
        actor.send({ type: 'PLANNING_STARTED' });
      }
      if (state === 'backlog' || state === 'planning') {
        actor.send({ type: 'PLANNING_COMPLETE', requireReviewBeforeCoding: false });
      }
    };

    switch (phase) {
      case 'coding':
        ensurePlanningComplete();
        if (state !== 'coding' && state !== 'qa_review' && state !== 'qa_fixing') {
          actor.send({ type: 'CODING_STARTED' });
        }
        break;
      case 'qa_review':
        if (state === 'qa_review' || state === 'qa_fixing') {
          return;
        }
        ensurePlanningComplete();
        if (state !== 'coding') {
          actor.send({ type: 'CODING_STARTED' });
        }
        actor.send({ type: 'QA_STARTED' });
        break;
      case 'qa_fixing':
        if (state === 'qa_fixing') {
          return;
        }
        ensurePlanningComplete();
        if (state !== 'coding') {
          actor.send({ type: 'CODING_STARTED' });
        }
        actor.send({ type: 'QA_STARTED' });
        actor.send({ type: 'QA_FAILED' });
        break;
      case 'complete':
        ensurePlanningComplete();
        if (state !== 'coding') {
          actor.send({ type: 'CODING_STARTED' });
        }
        actor.send({ type: 'QA_STARTED' });
        actor.send({ type: 'QA_PASSED' });
        break;
      default:
        break;
    }
  }

  handleProcessExit(
    task: Task,
    project: Project,
    exitCode: number,
    hasSubtasks: boolean,
    allSubtasksDone: boolean
  ): void {
    this.taskContext.set(task.id, { task, project });
    const requireReviewBeforeCoding = task.metadata?.requireReviewBeforeCoding === true;

    this.logProcessExit({
      taskId: task.id,
      exitCode,
      hasSubtasks,
      allSubtasksDone,
      requireReviewBeforeCoding
    });

    const actor = this.getActor(task);
    actor.send({
      type: 'PROCESS_EXITED',
      exitCode,
      hasSubtasks,
      allSubtasksDone,
      requireReviewBeforeCoding
    });
  }

  handleUserStopped(task: Task, project: Project): void {
    this.taskContext.set(task.id, { task, project });
    this.getActor(task).send({ type: 'USER_STOPPED' });
  }

  handleUserResumed(task: Task, project: Project): void {
    this.taskContext.set(task.id, { task, project });
    this.getActor(task).send({ type: 'USER_RESUMED' });
  }

  handleManualStatus(
    task: Task,
    project: Project,
    status: 'backlog' | 'human_review' | 'done',
    reviewReason?: ReviewReason
  ): void {
    this.taskContext.set(task.id, { task, project });
    this.getActor(task).send({ type: 'MANUAL_SET_STATUS', status, reviewReason });
  }

  private getActor(task: Task): TaskMachineActor {
    let actor = this.actors.get(task.id);
    if (!actor) {
      actor = createActor(taskMachine, { id: task.id });
      actor.subscribe((snapshot) => {
        // XState v5: 'changed' is only present when state has actually changed
        // For subscriptions, we receive updates on every transition attempt, so check if status changed
        this.handleSnapshot(task.id, snapshot);
      });
      actor.start();
      this.actors.set(task.id, actor);
    }
    return actor;
  }

  private handleSnapshot(taskId: string, snapshot: TaskMachineSnapshot): void {
    const legacy = this.mapSnapshotToLegacy(snapshot);
    if (!legacy) return;

    const previous = this.lastLegacy.get(taskId);
    if (previous && previous.status === legacy.status && previous.reviewReason === legacy.reviewReason) {
      return;
    }

    this.lastLegacy.set(taskId, legacy);
    const context = this.taskContext.get(taskId);
    const projectId = context?.project.id;

    if (!previous || previous.status !== legacy.status) {
      if (context) {
        this.persistStatus(context.project, context.task, legacy.status);
      }
    }

    this.emitStatusChange(taskId, legacy.status, projectId, legacy.reviewReason);
  }

  private mapSnapshotToLegacy(snapshot: TaskMachineSnapshot): LegacyStatus | null {
    const state = typeof snapshot.value === 'string' ? snapshot.value : null;
    if (!state) {
      logger.warn('[TaskStateManager] Unexpected xstate snapshot value:', snapshot.value);
      return null;
    }

    switch (state) {
      case 'backlog':
        return { status: 'backlog' };
      case 'planning':
      case 'coding':
        return { status: 'in_progress' };
      case 'awaitingPlanReview':
        return { status: 'human_review', reviewReason: 'plan_review' };
      case 'qa_review':
      case 'qa_fixing':
        return { status: 'ai_review' };
      case 'human_review':
        return { status: 'human_review', reviewReason: snapshot.context.reviewReason };
      case 'error':
        return { status: 'error', reviewReason: 'errors' };
      case 'done':
        return { status: 'done' };
      default:
        logger.warn('[TaskStateManager] Unhandled xstate state:', state);
        return null;
    }
  }

  private mapProgressToEvent(progress: ExecutionProgress) {
    switch (progress.phase) {
      case 'planning':
        return { type: 'PLANNING_STARTED' as const };
      case 'coding':
        return { type: 'CODING_STARTED' as const };
      case 'qa_review':
        return { type: 'QA_STARTED' as const };
      case 'qa_fixing':
        return { type: 'QA_FAILED' as const };
      case 'complete':
        return { type: 'QA_PASSED' as const };
      default:
        return null;
    }
  }

  private persistStatus(project: Project, task: Task, status: TaskStatus): void {
    const mainPlanPath = getPlanPath(project, task);
    const projectId = project.id;
    const taskSpecId = task.specId;
    const projectPath = project.path;
    const autoBuildPath = project.autoBuildPath;

    const mainPersisted = persistPlanStatusSync(mainPlanPath, status, projectId);
    if (mainPersisted) {
      logger.info(`[TaskStateManager] Persisted status to main plan: ${status}`);
    }

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
          logger.info(`[TaskStateManager] Persisted status to worktree plan: ${status}`);
        }
      }
    }
  }

  private emitStatusChange(
    taskId: string,
    status: TaskStatus,
    projectId?: string,
    reviewReason?: ReviewReason
  ): void {
    if (isDebugEnabled()) {
      const payload = {
        taskId,
        status,
        reviewReason: reviewReason ?? 'none',
        projectId: projectId ?? 'none'
      };
      logger.info(`[TASK_STATUS_CHANGE] ${JSON.stringify(payload)}`);
    }
    safeSendToRenderer(this.getMainWindow, IPC_CHANNELS.TASK_STATUS_CHANGE, taskId, status, projectId, reviewReason);
  }

  private logExecutionProgress(taskId: string, progress: ExecutionProgress, projectId?: string): void {
    logger.info(
      `[EXECUTION_PROGRESS] taskId=${taskId} phase=${progress.phase} phaseProgress=${progress.phaseProgress} overallProgress=${progress.overallProgress} projectId=${projectId ?? 'none'}`
    );
  }

  private logProcessExit(snapshot: {
    taskId: string;
    exitCode: number;
    hasSubtasks: boolean;
    allSubtasksDone: boolean;
    requireReviewBeforeCoding: boolean;
  }): void {
    logger.info(
      `[PROCESS_EXITED] taskId=${snapshot.taskId} code=${snapshot.exitCode} hasSubtasks=${snapshot.hasSubtasks} allSubtasksDone=${snapshot.allSubtasksDone} requireReviewBeforeCoding=${snapshot.requireReviewBeforeCoding}`
    );
  }
}

let taskStateManager: TaskStateManager | null = null;

export function getTaskStateManager(getMainWindow: () => BrowserWindow | null): TaskStateManager {
  if (!taskStateManager) {
    taskStateManager = new TaskStateManager(getMainWindow);
  }
  return taskStateManager;
}

/**
 * Get current XState status for a task without needing getMainWindow.
 * Returns null if TaskStateManager is not initialized or task has no active actor.
 * This is safe to call from project-store during refresh.
 */
export function getXStateTaskStatus(taskId: string): { status: TaskStatus; reviewReason?: ReviewReason } | null {
  if (!taskStateManager) {
    return null;
  }
  return taskStateManager.getCurrentStatus(taskId);
}

/**
 * Cleans up and resets the singleton instance.
 * Call this on app shutdown to prevent memory leaks.
 */
export function cleanupTaskStateManager(): void {
  if (taskStateManager) {
    taskStateManager.cleanup();
    taskStateManager = null;
  }
}
