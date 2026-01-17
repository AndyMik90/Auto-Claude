import { IPC_CHANNELS } from '../../../shared/constants';
import { invokeIpc } from './ipc-utils';
import type { IPCResult } from '../../../shared/types';

/**
 * Shell Operations API
 */
export interface ShellAPI {
  openExternal: (url: string) => Promise<void>;
  openTerminal: (dirPath: string) => Promise<IPCResult<void>>;
  showItemInFolder: (filePath: string) => Promise<void>;
}

/**
 * Creates the Shell Operations API implementation
 */
export const createShellAPI = (): ShellAPI => ({
  openExternal: (url: string): Promise<void> =>
    invokeIpc(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, url),
  openTerminal: (dirPath: string): Promise<IPCResult<void>> =>
    invokeIpc(IPC_CHANNELS.SHELL_OPEN_TERMINAL, dirPath),
  showItemInFolder: (filePath: string): Promise<void> =>
    invokeIpc(IPC_CHANNELS.SHELL_SHOW_ITEM_IN_FOLDER, filePath)
});
