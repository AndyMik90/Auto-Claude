import { IPC_CHANNELS } from '../../../shared/constants';
import { invokeIpc } from './ipc-utils';
import type { IPCResult, PromptInfo, PromptContext } from '../../../shared/types';

// Re-export for consumers of this module
export type { PromptInfo, PromptContext };

/**
 * Prompt Operations API
 */
export interface PromptAPI {
  getPromptList: (context: PromptContext) => Promise<IPCResult<PromptInfo[]>>;
  readPrompt: (filename: string) => Promise<IPCResult<string>>;
}

/**
 * Creates the Prompt Operations API implementation
 */
export const createPromptAPI = (): PromptAPI => ({
  getPromptList: (context: string): Promise<IPCResult<PromptInfo[]>> =>
    invokeIpc(IPC_CHANNELS.PROMPT_GET_LIST, context),
  readPrompt: (filename: string): Promise<IPCResult<string>> =>
    invokeIpc(IPC_CHANNELS.PROMPT_READ, filename)
});
