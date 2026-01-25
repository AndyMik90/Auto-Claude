/**
 * JIRA IPC handlers
 * Handles JIRA API operations via main process (to avoid CORS issues)
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { IPCResult } from '../../shared/types';

// Debug logging helper
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    if (data !== undefined) {
      console.debug(`[JIRA] ${message}`, data);
    } else {
      console.debug(`[JIRA] ${message}`);
    }
  }
}

/**
 * Test JIRA connection with host, email, and API token
 * Makes request from main process to bypass CORS restrictions
 */
export function registerTestJiraConnection(): void {
  ipcMain.handle(
    IPC_CHANNELS.JIRA_TEST_CONNECTION,
    async (
      _event,
      host: string,
      email: string,
      token: string
    ): Promise<IPCResult<{ displayName: string }>> => {
      debugLog('testJiraConnection handler called', { host });

      if (!host || !email || !token) {
        return { success: false, error: 'Host, email, and API token are required' };
      }

      try {
        // Normalize URL
        const baseUrl = host.replace(/\/$/, '');

        // Create Basic auth header
        const credentials = Buffer.from(`${email}:${token}`).toString('base64');

        // Test connection by fetching current user
        const response = await fetch(`${baseUrl}/rest/api/3/myself`, {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const user = await response.json();
          debugLog('JIRA connection successful:', { displayName: user.displayName });
          return {
            success: true,
            data: {
              displayName: user.displayName,
            },
          };
        } else if (response.status === 401) {
          return {
            success: false,
            error: 'Invalid credentials - check email and API token',
          };
        } else if (response.status === 403) {
          return {
            success: false,
            error: 'Access forbidden - check API token permissions',
          };
        } else {
          return {
            success: false,
            error: `Connection failed: ${response.statusText}`,
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to connect to JIRA';
        debugLog('JIRA connection test failed:', errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      }
    }
  );
}

/**
 * Register all JIRA handlers
 */
export function registerJiraHandlers(): void {
  debugLog('Registering JIRA handlers');
  registerTestJiraConnection();
  debugLog('JIRA handlers registered');
}
