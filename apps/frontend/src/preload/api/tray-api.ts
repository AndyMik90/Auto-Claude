/**
 * System Tray API
 *
 * Provides system tray functionality via IPC to the main process.
 * Allows renderer to update tray status and task counts.
 */
import { IPC_CHANNELS } from '../../shared/constants/ipc';
import { ipcRenderer } from 'electron';

export interface TrayTaskCounts {
  running: number;
  review: number;
  pending: number;
  completed: number;
}

export interface TrayAPI {
  /**
   * Update task counts displayed in system tray
   */
  updateStatus: (counts: TrayTaskCounts) => Promise<{ success: boolean }>;

  /**
   * Listen for "New Task" action from tray menu
   */
  onNewTask: (callback: () => void) => () => void;

  /**
   * Listen for "Settings" action from tray menu
   */
  onOpenSettings: (callback: () => void) => () => void;
}

export const createTrayAPI = (): TrayAPI => ({
  updateStatus: (counts) => ipcRenderer.invoke(IPC_CHANNELS.TRAY_UPDATE_STATUS, counts),

  onNewTask: (callback) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.TRAY_NEW_TASK, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRAY_NEW_TASK, handler);
  },

  onOpenSettings: (callback) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.TRAY_OPEN_SETTINGS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TRAY_OPEN_SETTINGS, handler);
  }
});
