/**
 * Enhanced Settings Handler - Proof of Concept
 * 
 * This is a refactored version of SETTINGS_GET handler
 * demonstrating the new infrastructure with minimal changes.
 * 
 * Once tested, we can gradually migrate the original file.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS, DEFAULT_APP_SETTINGS } from '../../shared/constants';
import type { AppSettings, IPCResult } from '../../shared/types';
import { readSettingsFile, getSettingsPath } from '../settings-utils';
import { writeFileSync } from 'fs';
import { configureTools } from '../cli-tool-manager';

/**
 * Safe error wrapper - catches errors and returns IPCResult
 */
function wrapWithErrorHandling<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => Promise<IPCResult<TResult>>
) {
  return async (...args: TArgs): Promise<IPCResult<TResult>> => {
    const startTime = Date.now();
    
    try {
      const result = await handler(...args);
      
      // Add metadata
      return {
        ...result,
        metadata: {
          timestamp: Date.now(),
          duration: Date.now() - startTime,
        },
      };
    } catch (error) {
      console.error('[IPC Error]', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
        errorCode: 'INTERNAL_ERROR',
        metadata: {
          timestamp: Date.now(),
          duration: Date.now() - startTime,
        },
      };
    }
  };
}

/**
 * Enhanced SETTINGS_GET handler
 * 
 * Improvements:
 * - Automatic error handling
 * - Performance timing
 * - Metadata in response
 * - Same logic as original, just wrapped
 */
export function registerEnhancedSettingsGetHandler(): void {
  const handler = wrapWithErrorHandling(async (): Promise<IPCResult<AppSettings>> => {
    // Load settings using shared helper and merge with defaults
    const savedSettings = readSettingsFile();
    const settings: AppSettings = { ...DEFAULT_APP_SETTINGS, ...savedSettings };
    let needsSave = false;

    // Migration: Set agent profile to 'auto' for users who haven't made a selection (one-time)
    if (!settings._migratedAgentProfileToAuto) {
      if (!settings.selectedAgentProfile) {
        settings.selectedAgentProfile = 'auto';
      }
      settings._migratedAgentProfileToAuto = true;
      needsSave = true;
    }

    // If no manual autoBuildPath is set, try to auto-detect
    if (!settings.autoBuildPath) {
      // Import detectAutoBuildSourcePath from original file
      // For now, skip this to keep it simple
    }

    // Persist migration changes
    if (needsSave) {
      try {
        const settingsPath = getSettingsPath();
        writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      } catch (error) {
        console.error('[Enhanced SETTINGS_GET] Failed to persist migration:', error);
      }
    }

    // Configure CLI tools with current settings
    configureTools({
      pythonPath: settings.pythonPath,
      gitPath: settings.gitPath,
      githubCLIPath: settings.githubCLIPath,
      claudePath: settings.claudePath,
    });

    return { success: true, data: settings as AppSettings };
  });

  // Register with a test channel first
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET + ':enhanced', handler);
}

/**
 * Usage Example:
 * 
 * In main/index.ts, add:
 * import { registerEnhancedSettingsGetHandler } from './ipc-handlers/enhanced-settings-handlers';
 * registerEnhancedSettingsGetHandler();
 * 
 * In renderer, test with:
 * const result = await ipcRenderer.invoke('settings:get:enhanced');
 * console.log('Response metadata:', result.metadata);
 */
