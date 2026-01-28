import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../shared/constants';
import type { ExecutionProgress, ReviewReason, Task, TaskStatus } from '../shared/types';
import { logger } from './app-logger';
import { isDebugEnabled } from './task-state-utils';
import { safeSendToRenderer } from './ipc-handlers/utils';

export type ProcessExitSnapshot = {
  taskId: string;
  exitCode: number;
  task: Task | undefined;
  hasSubtasks: boolean;
  allSubtasksDone: boolean;
  requireReviewBeforeCoding: boolean;
};

export class TaskStateMachine {
  emitStatusChange(
    getMainWindow: () => BrowserWindow | null,
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
    safeSendToRenderer(getMainWindow, IPC_CHANNELS.TASK_STATUS_CHANGE, taskId, status, projectId, reviewReason);
  }

  logExecutionProgress(taskId: string, progress: ExecutionProgress, projectId?: string): void {
    logger.info(
      `[EXECUTION_PROGRESS] taskId=${taskId} phase=${progress.phase} phaseProgress=${progress.phaseProgress} overallProgress=${progress.overallProgress} projectId=${projectId ?? 'none'}`
    );
  }

  logProcessExit(snapshot: ProcessExitSnapshot): void {
    logger.info(
      `[PROCESS_EXITED] taskId=${snapshot.taskId} code=${snapshot.exitCode} hasSubtasks=${snapshot.hasSubtasks} allSubtasksDone=${snapshot.allSubtasksDone} requireReviewBeforeCoding=${snapshot.requireReviewBeforeCoding}`
    );
  }

  getStatusForExecutionProgress(progress: ExecutionProgress): TaskStatus | null {
    const phaseToStatus: Record<string, TaskStatus | null> = {
      idle: null,
      planning: 'in_progress',
      coding: 'in_progress',
      qa_review: 'ai_review',
      qa_fixing: 'ai_review',
      complete: 'human_review',
      failed: 'human_review'
    };

    return phaseToStatus[progress.phase] ?? null;
  }

  getStatusForProcessExit(snapshot: ProcessExitSnapshot): {
    status?: TaskStatus;
    reviewReason?: ReviewReason;
  } {
    if (snapshot.exitCode !== 0) {
      return { status: 'human_review', reviewReason: 'errors' };
    }

    // Check subtasks first - if all done, it's completed regardless of requireReviewBeforeCoding
    if (snapshot.hasSubtasks && snapshot.allSubtasksDone) {
      return { status: 'human_review', reviewReason: 'completed' };
    }

    // Only use plan_review if requireReviewBeforeCoding AND no subtasks completed yet
    if (snapshot.requireReviewBeforeCoding) {
      return { status: 'human_review', reviewReason: 'plan_review' };
    }

    // No review required and no completed subtasks -> keep current status
    return {};
  }
}
