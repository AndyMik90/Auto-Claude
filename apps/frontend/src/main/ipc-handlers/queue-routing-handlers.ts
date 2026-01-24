/**
 * Queue Routing IPC Handlers
 *
 * Handles IPC communication for the rate limit recovery queue routing system.
 * Provides profile-aware task distribution to enable overnight autonomous operation.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { AgentManager } from '../agent/agent-manager';
import type { ProfileAssignmentReason, RunningTasksByProfile } from '../../shared/types';

/**
 * Register queue routing IPC handlers
 */
export function registerQueueRoutingHandlers(
  agentManager: AgentManager,
  getMainWindow: () => BrowserWindow | null
): void {
  // Get running tasks grouped by profile
  ipcMain.handle(
    IPC_CHANNELS.QUEUE_GET_RUNNING_TASKS_BY_PROFILE,
    async (): Promise<{ success: boolean; data?: RunningTasksByProfile; error?: string }> => {
      try {
        const data = agentManager.getRunningTasksByProfile();
        return { success: true, data };
      } catch (error) {
        console.error('[QueueRouting] Failed to get running tasks by profile:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // Get best profile for a task
  ipcMain.handle(
    IPC_CHANNELS.QUEUE_GET_BEST_PROFILE_FOR_TASK,
    async (
      _event,
      options?: {
        excludeProfileId?: string;
        perProfileMaxTasks?: number;
        profileThreshold?: number;
      }
    ): Promise<{ success: boolean; data?: unknown; error?: string }> => {
      try {
        // This would integrate with the profile scorer
        // For now, return null to indicate no preference
        // The actual implementation would use getBestAvailableProfile from profile-scorer.ts
        console.log('[QueueRouting] getBestProfileForTask called with options:', options);
        return { success: true, data: null };
      } catch (error) {
        console.error('[QueueRouting] Failed to get best profile for task:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // Assign a profile to a task
  ipcMain.handle(
    IPC_CHANNELS.QUEUE_ASSIGN_PROFILE_TO_TASK,
    async (
      _event,
      taskId: string,
      profileId: string,
      profileName: string,
      reason: ProfileAssignmentReason
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        agentManager.assignProfileToTask(taskId, profileId, profileName, reason);
        return { success: true };
      } catch (error) {
        console.error('[QueueRouting] Failed to assign profile to task:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // Update session ID for a task
  ipcMain.handle(
    IPC_CHANNELS.QUEUE_UPDATE_TASK_SESSION,
    async (
      _event,
      taskId: string,
      sessionId: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        agentManager.updateTaskSession(taskId, sessionId);
        return { success: true };
      } catch (error) {
        console.error('[QueueRouting] Failed to update task session:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // Get session ID for a task
  ipcMain.handle(
    IPC_CHANNELS.QUEUE_GET_TASK_SESSION,
    async (
      _event,
      taskId: string
    ): Promise<{ success: boolean; data?: string | null; error?: string }> => {
      try {
        const sessionId = agentManager.getTaskSessionId(taskId);
        return { success: true, data: sessionId ?? null };
      } catch (error) {
        console.error('[QueueRouting] Failed to get task session:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // Forward events from agent manager to renderer

  // Profile swapped event
  agentManager.on('profile-swapped', (taskId: string, swap: unknown) => {
    const win = getMainWindow();
    if (win) {
      win.webContents.send(IPC_CHANNELS.QUEUE_PROFILE_SWAPPED, { taskId, swap });
    }
  });

  // Session captured event
  agentManager.on('session-captured', (taskId: string, sessionId: string) => {
    const win = getMainWindow();
    if (win) {
      win.webContents.send(IPC_CHANNELS.QUEUE_SESSION_CAPTURED, {
        taskId,
        sessionId,
        capturedAt: new Date().toISOString()
      });
    }
  });

  // Queue blocked event (no available profiles)
  agentManager.on('queue-blocked-no-profiles', (info: { reason: string }) => {
    const win = getMainWindow();
    if (win) {
      win.webContents.send(IPC_CHANNELS.QUEUE_BLOCKED_NO_PROFILES, {
        ...info,
        timestamp: new Date().toISOString()
      });
    }
  });

  console.log('[QueueRouting] IPC handlers registered');
}
