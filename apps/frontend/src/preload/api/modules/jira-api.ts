import { IPC_CHANNELS } from '../../../shared/constants';
import type { IPCResult } from '../../../shared/types';
import { invokeIpc } from './ipc-utils';

/**
 * JIRA project state for tracking issue synchronization (legacy)
 */
export interface JiraProjectState {
  initialized: boolean;
  project_key: string;
  project_name: string;
  meta_issue_key: string;
  total_issues: number;
  created_at: string;
  issue_mapping: Record<string, string>; // subtask_id -> issue_key
}

/**
 * Task issue state (hierarchical: parent Story + Sub-tasks)
 */
export interface TaskIssueState {
  parentIssueKey: string;
  parentIssueUrl: string;
  createdAt: string;
  projectKey: string;
  subtaskMapping: Record<string, string>;  // subtask_id -> issue_key
  totalSubtasks: number;
}

/**
 * Result of creating JIRA issues from implementation plan
 */
export interface CreateIssuesResult {
  created: number;
  skipped: number;
  issues: Record<string, string>;
}

/**
 * JIRA Integration API operations
 */
export interface JiraAPI {
  testJiraConnection: (host: string, email: string, token: string) => Promise<IPCResult<{ displayName: string }>>;
  createIssuesFromPlan: (specDir: string, projectKey?: string) => Promise<IPCResult<CreateIssuesResult>>;
  getSyncStatus: (specDir: string) => Promise<IPCResult<JiraProjectState | null>>;
  createTaskIssue: (specDir: string, taskTitle: string, taskDescription: string, projectKey?: string) => Promise<IPCResult<TaskIssueState>>;
  getTaskIssue: (specDir: string) => Promise<IPCResult<TaskIssueState | null>>;
}

/**
 * Creates the JIRA Integration API implementation
 */
export const createJiraAPI = (): JiraAPI => ({
  testJiraConnection: (host: string, email: string, token: string): Promise<IPCResult<{ displayName: string }>> =>
    invokeIpc(IPC_CHANNELS.JIRA_TEST_CONNECTION, host, email, token),

  createIssuesFromPlan: (specDir: string, projectKey?: string): Promise<IPCResult<CreateIssuesResult>> =>
    invokeIpc(IPC_CHANNELS.JIRA_CREATE_ISSUES_FROM_PLAN, specDir, projectKey),

  getSyncStatus: (specDir: string): Promise<IPCResult<JiraProjectState | null>> =>
    invokeIpc(IPC_CHANNELS.JIRA_GET_SYNC_STATUS, specDir),

  createTaskIssue: (specDir: string, taskTitle: string, taskDescription: string, projectKey?: string): Promise<IPCResult<TaskIssueState>> =>
    invokeIpc(IPC_CHANNELS.JIRA_CREATE_TASK_ISSUE, specDir, taskTitle, taskDescription, projectKey),

  getTaskIssue: (specDir: string): Promise<IPCResult<TaskIssueState | null>> =>
    invokeIpc(IPC_CHANNELS.JIRA_GET_TASK_ISSUE, specDir),
});
