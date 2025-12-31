import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { IPCResult } from '../../shared/types';
import { PythonEnvManager } from '../python-env-manager';

/**
 * Environment validation status types
 */
export interface EnvironmentValidationStatus {
  isValidating: boolean;
  isComplete: boolean;
  buildToolsResult: {
    success: boolean;
    platform: string;
    missingTools: string[];
    errors: string[];
    installationInstructions: string;
  } | null;
  environmentResult: {
    success: boolean;
    bundled: { success: boolean; errors: string[] } | null;
    venv: { success: boolean; errors: string[] } | null;
    summary: string;
  } | null;
  overallSuccess: boolean;
  lastValidatedAt: string | null;
}

// Module-level state to track validation
let validationState: EnvironmentValidationStatus = {
  isValidating: false,
  isComplete: false,
  buildToolsResult: null,
  environmentResult: null,
  overallSuccess: false,
  lastValidatedAt: null
};

/**
 * Register all environment validation IPC handlers
 */
export function registerEnvironmentHandlers(
  pythonEnvManager: PythonEnvManager,
  getMainWindow: () => BrowserWindow | null
): void {
  // ============================================
  // Environment Validation Operations
  // ============================================

  /**
   * Get current environment validation status
   * Returns the current state of validation including results if complete
   */
  ipcMain.handle(
    IPC_CHANNELS.ENV_VALIDATE_STATUS,
    async (): Promise<IPCResult<EnvironmentValidationStatus>> => {
      return { success: true, data: validationState };
    }
  );

  /**
   * Start environment validation process
   * Validates build tools and Python environments
   * Sends progress events to renderer during validation
   */
  ipcMain.handle(
    IPC_CHANNELS.ENV_VALIDATE_START,
    async (): Promise<IPCResult<EnvironmentValidationStatus>> => {
      // Don't start if already validating
      if (validationState.isValidating) {
        return {
          success: false,
          error: 'Validation already in progress',
          data: validationState
        };
      }

      const mainWindow = getMainWindow();

      // Reset state and start validation
      validationState = {
        isValidating: true,
        isComplete: false,
        buildToolsResult: null,
        environmentResult: null,
        overallSuccess: false,
        lastValidatedAt: null
      };

      try {
        // Step 1: Validate build tools
        if (mainWindow) {
          mainWindow.webContents.send(
            IPC_CHANNELS.ENV_VALIDATE_PROGRESS,
            'Checking system build tools (make, cmake)...'
          );
        }

        const buildToolsResult = await pythonEnvManager.validateBuildTools();
        validationState.buildToolsResult = buildToolsResult;

        if (!buildToolsResult.success) {
          if (mainWindow) {
            mainWindow.webContents.send(
              IPC_CHANNELS.ENV_VALIDATE_PROGRESS,
              `Missing build tools: ${buildToolsResult.missingTools.join(', ')}`
            );
          }
        }

        // Step 2: Validate Python environments
        if (mainWindow) {
          mainWindow.webContents.send(
            IPC_CHANNELS.ENV_VALIDATE_PROGRESS,
            'Validating Python environments...'
          );
        }

        const environmentResult = await pythonEnvManager.validateBothEnvironments();
        validationState.environmentResult = environmentResult;

        // Determine overall success
        validationState.overallSuccess = buildToolsResult.success && environmentResult.success;
        validationState.isValidating = false;
        validationState.isComplete = true;
        validationState.lastValidatedAt = new Date().toISOString();

        // Send completion event
        if (mainWindow) {
          mainWindow.webContents.send(
            IPC_CHANNELS.ENV_VALIDATE_COMPLETE,
            validationState
          );
        }

        return { success: true, data: validationState };
      } catch (error) {
        validationState.isValidating = false;
        validationState.isComplete = true;
        validationState.overallSuccess = false;
        validationState.lastValidatedAt = new Date().toISOString();

        const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';

        // Send error event
        if (mainWindow) {
          mainWindow.webContents.send(
            IPC_CHANNELS.ENV_VALIDATE_ERROR,
            errorMessage
          );
        }

        return {
          success: false,
          error: errorMessage,
          data: validationState
        };
      }
    }
  );
}
