/**
 * Task Recovery IPC Handlers
 *
 * Handlers for task recovery service - provides recovery stats and configuration
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { TaskRecoveryService, RecoveryStats, RecoveryConfig, RecoveryHealthStatus } from '../task-recovery-service';
import type { IPCResult } from '../../shared/types';

/**
 * Register task recovery IPC handlers
 */
export function registerTaskRecoveryHandlers(recoveryService: TaskRecoveryService): void {
  /**
   * Get recovery statistics
   */
  ipcMain.handle(IPC_CHANNELS.TASK_RECOVERY_STATS, async (): Promise<IPCResult<RecoveryStats>> => {
    try {
      const stats = recoveryService.getRecoveryStats();
      return { success: true, data: stats };
    } catch (error) {
      console.error('[IPC] Failed to get recovery stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recovery stats'
      };
    }
  });

  /**
   * Get recovery configuration
   */
  ipcMain.handle(IPC_CHANNELS.TASK_RECOVERY_CONFIG_GET, async (): Promise<IPCResult<RecoveryConfig>> => {
    try {
      const config = recoveryService.getConfig();
      return { success: true, data: config };
    } catch (error) {
      console.error('[IPC] Failed to get recovery config:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recovery config'
      };
    }
  });

  /**
   * Update recovery configuration
   */
  ipcMain.handle(
    IPC_CHANNELS.TASK_RECOVERY_CONFIG_UPDATE,
    async (_event, newConfig: Partial<RecoveryConfig>): Promise<IPCResult<RecoveryConfig>> => {
      try {
        recoveryService.updateConfig(newConfig);
        const updatedConfig = recoveryService.getConfig();
        return { success: true, data: updatedConfig };
      } catch (error) {
        console.error('[IPC] Failed to update recovery config:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update recovery config'
        };
      }
    }
  );

  /**
   * Run healthcheck
   */
  ipcMain.handle(IPC_CHANNELS.TASK_RECOVERY_HEALTHCHECK, async (): Promise<IPCResult<void>> => {
    try {
      await recoveryService.runHealthcheck();
      return { success: true };
    } catch (error) {
      console.error('[IPC] Task recovery healthcheck failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Healthcheck failed'
      };
    }
  });

  /**
   * Get health status
   */
  ipcMain.handle(IPC_CHANNELS.TASK_RECOVERY_HEALTH_STATUS, async (): Promise<IPCResult<RecoveryHealthStatus>> => {
    try {
      const status = recoveryService.getHealthStatus();
      return { success: true, data: status };
    } catch (error) {
      console.error('[IPC] Failed to get health status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get health status'
      };
    }
  });

  console.log('[IPC] Task recovery handlers registered');
}
