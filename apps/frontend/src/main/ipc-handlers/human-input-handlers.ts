/**
 * Human Input IPC Handlers
 *
 * Handles communication between the Electron renderer and the backend
 * for the human input request system. Monitors human_input.json files
 * in spec directories and notifies the UI when input is requested.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { watch, FSWatcher } from 'fs';
import { readFile, writeFile, access } from 'fs/promises';
import * as path from 'path';

import { IPC_CHANNELS } from '../../shared/constants';
import type {
  IPCResult,
  HumanInputRequest,
  HumanInputAnswer,
} from '../../shared/types';

// Track active file watchers by spec path
const activeWatchers: Map<string, FSWatcher> = new Map();

/**
 * Read the human_input.json file from a spec directory
 */
async function readHumanInputFile(specPath: string): Promise<HumanInputRequest | null> {
  const inputFile = path.join(specPath, 'human_input.json');

  try {
    await access(inputFile);
    const content = await readFile(inputFile, 'utf-8');
    return JSON.parse(content) as HumanInputRequest;
  } catch {
    return null;
  }
}

/**
 * Write the human_input.json file to a spec directory
 */
async function writeHumanInputFile(specPath: string, data: HumanInputRequest): Promise<void> {
  const inputFile = path.join(specPath, 'human_input.json');
  await writeFile(inputFile, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Register all human input IPC handlers
 */
export function registerHumanInputHandlers(getMainWindow: () => BrowserWindow | null): void {
  /**
   * Check for pending human input request in a spec directory
   * Returns the request if status is 'pending', null otherwise
   */
  ipcMain.handle(
    IPC_CHANNELS.HUMAN_INPUT_CHECK,
    async (_, specPath: string): Promise<IPCResult<HumanInputRequest | null>> => {
      try {
        const data = await readHumanInputFile(specPath);

        if (data && data.status === 'pending') {
          return { success: true, data };
        }

        return { success: true, data: null };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to check human input',
        };
      }
    }
  );

  /**
   * Submit an answer to a human input request
   */
  ipcMain.handle(
    IPC_CHANNELS.HUMAN_INPUT_ANSWER,
    async (_, specPath: string, answer: HumanInputAnswer['answer']): Promise<IPCResult<void>> => {
      try {
        const data = await readHumanInputFile(specPath);

        if (!data) {
          return {
            success: false,
            error: 'No human input request found',
          };
        }

        if (data.status !== 'pending') {
          return {
            success: false,
            error: `Request is not pending (status: ${data.status})`,
          };
        }

        // Update the request with the answer
        data.status = 'answered';
        data.answer = answer;
        data.answered_at = new Date().toISOString();

        await writeHumanInputFile(specPath, data);

        return { success: true, data: undefined };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to submit answer',
        };
      }
    }
  );

  /**
   * Skip a human input request (user doesn't want to answer)
   */
  ipcMain.handle(
    IPC_CHANNELS.HUMAN_INPUT_SKIP,
    async (_, specPath: string): Promise<IPCResult<void>> => {
      try {
        const data = await readHumanInputFile(specPath);

        if (!data) {
          return {
            success: false,
            error: 'No human input request found',
          };
        }

        if (data.status !== 'pending') {
          return {
            success: false,
            error: `Request is not pending (status: ${data.status})`,
          };
        }

        // Mark as skipped
        data.status = 'skipped';
        data.answered_at = new Date().toISOString();

        await writeHumanInputFile(specPath, data);

        return { success: true, data: undefined };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to skip request',
        };
      }
    }
  );

  /**
   * Start watching a spec directory for human input requests
   */
  ipcMain.handle(
    IPC_CHANNELS.HUMAN_INPUT_WATCH,
    async (_, specPath: string): Promise<IPCResult<void>> => {
      try {
        // Stop existing watcher if any
        const existingWatcher = activeWatchers.get(specPath);
        if (existingWatcher) {
          existingWatcher.close();
          activeWatchers.delete(specPath);
        }

        const inputFile = path.join(specPath, 'human_input.json');
        const mainWindow = getMainWindow();

        // Create a watcher for the spec directory (watching specific file can be unreliable)
        const watcher = watch(specPath, { persistent: false }, async (eventType, filename) => {
          // Only react to changes to human_input.json
          if (filename !== 'human_input.json') {
            return;
          }

          try {
            const data = await readHumanInputFile(specPath);

            if (data && data.status === 'pending' && mainWindow && !mainWindow.isDestroyed()) {
              // Notify renderer about the new request
              mainWindow.webContents.send(IPC_CHANNELS.HUMAN_INPUT_CHANGED, {
                specPath,
                request: data,
              });
            }
          } catch {
            // File might be in the middle of being written, ignore errors
          }
        });

        activeWatchers.set(specPath, watcher);

        // Also check immediately for existing pending request
        const data = await readHumanInputFile(specPath);
        if (data && data.status === 'pending' && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.HUMAN_INPUT_CHANGED, {
            specPath,
            request: data,
          });
        }

        return { success: true, data: undefined };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to start watching',
        };
      }
    }
  );

  /**
   * Stop watching a spec directory for human input requests
   */
  ipcMain.handle(
    IPC_CHANNELS.HUMAN_INPUT_UNWATCH,
    async (_, specPath: string): Promise<IPCResult<void>> => {
      try {
        const watcher = activeWatchers.get(specPath);
        if (watcher) {
          watcher.close();
          activeWatchers.delete(specPath);
        }

        return { success: true, data: undefined };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to stop watching',
        };
      }
    }
  );
}

/**
 * Cleanup all active watchers (call on app quit)
 */
export function cleanupHumanInputWatchers(): void {
  for (const watcher of activeWatchers.values()) {
    watcher.close();
  }
  activeWatchers.clear();
}
