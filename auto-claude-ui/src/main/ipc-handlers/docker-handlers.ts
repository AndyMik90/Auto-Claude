/**
 * Docker & FalkorDB IPC Handlers
 *
 * Provides automatic infrastructure detection for non-technical users.
 * When Graphiti is enabled, the UI can check Docker/FalkorDB status
 * and offer one-click solutions instead of manual terminal commands.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { IPCResult, InfrastructureStatus } from '../../shared/types';
import {
  getInfrastructureStatus,
  startFalkorDB,
  stopFalkorDB,
  openDockerDesktop,
  getDockerDownloadUrl,
} from '../docker-service';

/**
 * Register all Docker-related IPC handlers
 */
export function registerDockerHandlers(): void {
  // Get infrastructure status (Docker + FalkorDB)
  ipcMain.handle(
    IPC_CHANNELS.DOCKER_STATUS,
    async (_, port?: number): Promise<IPCResult<InfrastructureStatus>> => {
      try {
        const status = await getInfrastructureStatus(port);
        return { success: true, data: status };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to check Docker status',
        };
      }
    }
  );

  // Start FalkorDB container
  ipcMain.handle(
    IPC_CHANNELS.DOCKER_START_FALKORDB,
    async (_, port?: number): Promise<IPCResult<{ success: boolean; error?: string }>> => {
      try {
        const result = await startFalkorDB(port);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to start FalkorDB',
        };
      }
    }
  );

  // Stop FalkorDB container
  ipcMain.handle(
    IPC_CHANNELS.DOCKER_STOP_FALKORDB,
    async (): Promise<IPCResult<{ success: boolean; error?: string }>> => {
      try {
        const result = await stopFalkorDB();
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to stop FalkorDB',
        };
      }
    }
  );

  // Open Docker Desktop application
  ipcMain.handle(
    IPC_CHANNELS.DOCKER_OPEN_DESKTOP,
    async (): Promise<IPCResult<{ success: boolean; error?: string }>> => {
      try {
        const result = await openDockerDesktop();
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to open Docker Desktop',
        };
      }
    }
  );

  // Get Docker download URL
  ipcMain.handle(IPC_CHANNELS.DOCKER_GET_DOWNLOAD_URL, async (): Promise<string> => {
    return getDockerDownloadUrl();
  });
}
