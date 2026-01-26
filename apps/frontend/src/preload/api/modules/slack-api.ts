import type { IPCResult } from '../../../shared/types';
import { invokeIpc } from './ipc-utils';

/**
 * Slack Integration API operations
 */
export interface SlackAPI {
  testSlackWebhook: (webhookUrl: string) => Promise<IPCResult<{ success: boolean }>>;
}

/**
 * Creates the Slack Integration API implementation
 */
export const createSlackAPI = (): SlackAPI => ({
  testSlackWebhook: (webhookUrl: string): Promise<IPCResult<{ success: boolean }>> =>
    invokeIpc('slack:test-webhook', webhookUrl)
});
