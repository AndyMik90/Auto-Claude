import { ipcMain } from 'electron';
import type { IPCResult } from '../../shared/types';

/**
 * Register all Slack-related IPC handlers
 */
export function registerSlackHandlers(): void {
  /**
   * Test Slack webhook by sending a test notification
   */
  ipcMain.handle(
    'slack:test-webhook',
    async (_event, webhookUrl: string): Promise<IPCResult<{ success: boolean }>> => {
      try {
        // Validate URL format
        if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
          return {
            success: false,
            error: 'Invalid Slack webhook URL'
          };
        }

        const payload = {
          attachments: [{
            color: '#2196F3',
            title: 'Auto Claude Test',
            text: 'This is a test notification from Auto Claude. If you see this, Slack notifications are working correctly!',
            mrkdwn_in: ['text']
          }]
        };

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          return {
            success: true,
            data: { success: true }
          };
        } else {
          const errorText = await response.text();
          return {
            success: false,
            error: `Slack API error: ${response.status} - ${errorText}`
          };
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send test notification'
        };
      }
    }
  );
}
