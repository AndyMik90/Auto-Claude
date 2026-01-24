/**
 * IPC handlers for system tray operations
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc';
import { setTrayTaskCounts, type TrayTaskCounts } from '../tray-manager';

/**
 * Register tray-related IPC handlers
 */
export function registerTrayHandlers(): void {
  // Handle tray status updates from renderer
  ipcMain.handle(IPC_CHANNELS.TRAY_UPDATE_STATUS, (_event, counts: TrayTaskCounts) => {
    setTrayTaskCounts(counts);
    return { success: true };
  });

  console.warn('[IPC] Tray handlers registered');
}
