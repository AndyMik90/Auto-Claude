import { IPC_CHANNELS } from '../../../shared/constants';
import type { IPCResult } from '../../../shared/types';
import { invokeIpc } from './ipc-utils';

/**
 * JIRA Integration API operations
 */
export interface JiraAPI {
  testJiraConnection: (host: string, email: string, token: string) => Promise<IPCResult<{ displayName: string }>>;
}

/**
 * Creates the JIRA Integration API implementation
 */
export const createJiraAPI = (): JiraAPI => ({
  testJiraConnection: (host: string, email: string, token: string): Promise<IPCResult<{ displayName: string }>> =>
    invokeIpc(IPC_CHANNELS.JIRA_TEST_CONNECTION, host, email, token),
});
