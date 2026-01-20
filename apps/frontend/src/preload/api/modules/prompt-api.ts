import { IPC_CHANNELS } from '../../../shared/constants';
import { invokeIpc } from './ipc-utils';
import type { IPCResult } from '../../../shared/types';

/**
 * Prompt information returned by the list handler
 */
export interface PromptInfo {
  name: string;
  filename: string;
  description: string;
}

/**
 * Prompt Operations API
 */
export interface PromptAPI {
  getPromptList: (context: string) => Promise<IPCResult<PromptInfo[]>>;
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
