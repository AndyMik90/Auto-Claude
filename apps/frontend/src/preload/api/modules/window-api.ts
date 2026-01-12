/**
 * Window Management API
 *
 * Exposes window management functionality to the renderer for multi-window support.
 * Allows detaching projects to separate windows and reattaching them.
 */

import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../../shared/constants/ipc';

export interface WindowAPI {
  /** Detach a project to a new dedicated window */
  detachProject: (
    projectId: string,
    position?: { x: number; y: number }
  ) => Promise<{ windowId: string; bounds: Electron.Rectangle }>;

  /** Reattach a project back to the main window */
  reattachProject: (projectId: string) => Promise<{ success: boolean }>;

  /** Get current window context (main vs project window) */
  getContext: () => Promise<{
    type: 'main' | 'project';
    projectId?: string;
    windowId: string;
  }>;

  /** Get main window bounds (for cross-window drag detection) */
  getMainBounds: () => Promise<Electron.Rectangle | null>;

  /** Close a project window */
  closeProjectWindow: (projectId: string) => Promise<{ success: boolean }>;

  /** Listen for project detached events */
  onProjectDetached: (callback: (projectId: string, windowId: string) => void) => () => void;

  /** Listen for project reattached events */
  onProjectReattached: (callback: (projectId: string) => void) => () => void;
}

export function createWindowAPI(): WindowAPI {
  return {
    detachProject: (projectId: string, position?: { x: number; y: number }) =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_DETACH_PROJECT, projectId, position),

    reattachProject: (projectId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_REATTACH_PROJECT, projectId),

    getContext: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_GET_CONTEXT),

    getMainBounds: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_GET_MAIN_BOUNDS),

    closeProjectWindow: (projectId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE_PROJECT, projectId),

    onProjectDetached: (callback: (projectId: string, windowId: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, projectId: string, windowId: string) => {
        callback(projectId, windowId);
      };

      ipcRenderer.on(IPC_CHANNELS.WINDOW_PROJECT_DETACHED, listener);

      // Return cleanup function
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_PROJECT_DETACHED, listener);
      };
    },

    onProjectReattached: (callback: (projectId: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, projectId: string) => {
        callback(projectId);
      };

      ipcRenderer.on(IPC_CHANNELS.WINDOW_PROJECT_REATTACHED, listener);

      // Return cleanup function
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_PROJECT_REATTACHED, listener);
      };
    }
  };
}
