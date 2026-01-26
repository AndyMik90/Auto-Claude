/**
 * JIRA IPC handlers
 * Handles JIRA API operations via main process (to avoid CORS issues)
 */

import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { IPC_CHANNELS, DEFAULT_APP_SETTINGS } from '../../shared/constants';
import type { IPCResult, AppSettings } from '../../shared/types';
import { readSettingsFile } from '../settings-utils';

// Debug logging helper
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    if (data !== undefined) {
      console.debug(`[JIRA] ${message}`, data);
    } else {
      console.debug(`[JIRA] ${message}`);
    }
  }
}

/**
 * Test JIRA connection with host, email, and API token
 * Makes request from main process to bypass CORS restrictions
 */
export function registerTestJiraConnection(): void {
  ipcMain.handle(
    IPC_CHANNELS.JIRA_TEST_CONNECTION,
    async (
      _event,
      host: string,
      email: string,
      token: string
    ): Promise<IPCResult<{ displayName: string }>> => {
      debugLog('testJiraConnection handler called', { host });

      if (!host || !email || !token) {
        return { success: false, error: 'Host, email, and API token are required' };
      }

      try {
        // Normalize URL
        const baseUrl = host.replace(/\/$/, '');

        // Create Basic auth header
        const credentials = Buffer.from(`${email}:${token}`).toString('base64');

        // Test connection by fetching current user
        const response = await fetch(`${baseUrl}/rest/api/3/myself`, {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const user = await response.json();
          debugLog('JIRA connection successful:', { displayName: user.displayName });
          return {
            success: true,
            data: {
              displayName: user.displayName,
            },
          };
        } else if (response.status === 401) {
          return {
            success: false,
            error: 'Invalid credentials - check email and API token',
          };
        } else if (response.status === 403) {
          return {
            success: false,
            error: 'Access forbidden - check API token permissions',
          };
        } else {
          return {
            success: false,
            error: `Connection failed: ${response.statusText}`,
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to connect to JIRA';
        debugLog('JIRA connection test failed:', errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      }
    }
  );
}

/**
 * JIRA issue data structure
 */
interface JiraIssue {
  key: string;
  id: string;
  self: string;
}

interface JiraProjectState {
  initialized: boolean;
  project_key: string;
  project_name: string;
  meta_issue_key: string;
  total_issues: number;
  created_at: string;
  issue_mapping: Record<string, string>; // subtask_id -> issue_key
}

interface Subtask {
  id: string;
  description: string;
  service?: string;
  phase_num?: number;
  status?: string;
}

interface ImplementationPlan {
  phases: Array<{
    phase: number;
    name: string;
    subtasks: Subtask[];
  }>;
}

/**
 * Get creator label from email
 */
function getCreatorLabel(email: string): string {
  if (email && email.includes('@')) {
    const username = email.split('@')[0].toLowerCase().replace(/\./g, '-').replace(/_/g, '-');
    return `created-by-${username}`;
  }
  return '';
}

/**
 * Create a single JIRA issue
 */
async function createJiraIssue(
  baseUrl: string,
  credentials: string,
  projectKey: string,
  summary: string,
  description: string,
  labels: string[],
  issueType: string = 'Task',
  parentKey?: string  // For creating sub-tasks under a parent
): Promise<JiraIssue> {
  const fields: Record<string, unknown> = {
    project: { key: projectKey },
    summary,
    description: {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: description }]
        }
      ]
    },
    issuetype: { name: issueType },
    labels,
  };

  // Add parent reference for sub-tasks
  if (parentKey) {
    fields.parent = { key: parentKey };
  }

  // Security: credentials and baseUrl are sourced from user's local settings file
  // which is trusted input for this desktop application context
  // lgtm[js/request-forgery]
  const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create issue: ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

/**
 * Create JIRA issues from implementation plan
 */
export function registerCreateIssuesFromPlan(): void {
  ipcMain.handle(
    IPC_CHANNELS.JIRA_CREATE_ISSUES_FROM_PLAN,
    async (
      _event,
      specDir: string,
      projectKey?: string
    ): Promise<IPCResult<{ created: number; skipped: number; issues: Record<string, string> }>> => {
      debugLog('createIssuesFromPlan handler called', { specDir, projectKey });

      try {
        // Get JIRA settings
        const savedSettings = readSettingsFile();
        const settings: AppSettings = { ...DEFAULT_APP_SETTINGS, ...savedSettings };

        const host = settings.globalJiraHost;
        const email = settings.globalJiraEmail;
        const token = settings.globalJiraToken;
        const defaultProject = projectKey || settings.globalJiraDefaultProject;

        if (!host || !email || !token) {
          return { success: false, error: 'JIRA not configured. Please configure in Settings → Accounts → JIRA' };
        }

        if (!defaultProject) {
          return { success: false, error: 'No JIRA project key specified' };
        }

        // Read implementation plan
        const planFile = path.join(specDir, 'implementation_plan.json');
        if (!fs.existsSync(planFile)) {
          return { success: false, error: 'implementation_plan.json not found. Run planning phase first.' };
        }

        const plan: ImplementationPlan = JSON.parse(fs.readFileSync(planFile, 'utf-8'));

        // Load existing JIRA state if any
        const stateFile = path.join(specDir, '.jira_project.json');
        let state: JiraProjectState = {
          initialized: false,
          project_key: defaultProject,
          project_name: '',
          meta_issue_key: '',
          total_issues: 0,
          created_at: new Date().toISOString(),
          issue_mapping: {},
        };

        // Try to load existing state (avoids TOCTOU race condition)
        try {
          state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        } catch {
          // File doesn't exist or can't be parsed - use default state
        }

        const baseUrl = host.replace(/\/$/, '');
        const credentials = Buffer.from(`${email}:${token}`).toString('base64');
        const creatorLabel = getCreatorLabel(email);

        let created = 0;
        let skipped = 0;

        // Process each phase and subtask
        for (const phase of plan.phases) {
          for (const subtask of phase.subtasks) {
            const subtaskId = subtask.id;

            // Skip if already has issue
            if (state.issue_mapping[subtaskId]) {
              debugLog(`Skipping ${subtaskId} - already has issue ${state.issue_mapping[subtaskId]}`);
              skipped++;
              continue;
            }

            // Build labels
            const labels: string[] = [];
            if (creatorLabel) labels.push(creatorLabel);
            labels.push(`phase-${phase.phase}`);
            if (subtask.service) labels.push(`service-${subtask.service}`);

            // Build summary and description
            const summary = `[${subtaskId}] ${subtask.description.slice(0, 100)}`;
            const description = `**Subtask:** ${subtaskId}\n**Phase:** ${phase.name}\n**Service:** ${subtask.service || 'N/A'}\n\n${subtask.description}`;

            try {
              const issue = await createJiraIssue(
                baseUrl,
                credentials,
                defaultProject,
                summary,
                description,
                labels
              );

              state.issue_mapping[subtaskId] = issue.key;
              created++;
              debugLog(`Created issue ${issue.key} for ${subtaskId}`);
            } catch (error) {
              debugLog(`Failed to create issue for ${subtaskId}:`, error);
              // Continue with other subtasks
            }
          }
        }

        // Update state
        state.initialized = true;
        state.total_issues = Object.keys(state.issue_mapping).length;

        // Save state
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

        debugLog('Issue creation complete', { created, skipped });
        return {
          success: true,
          data: {
            created,
            skipped,
            issues: state.issue_mapping,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create JIRA issues';
        debugLog('createIssuesFromPlan failed:', errorMessage);
        return { success: false, error: errorMessage };
      }
    }
  );
}

/**
 * Get JIRA sync status for a spec
 */
export function registerGetSyncStatus(): void {
  ipcMain.handle(
    IPC_CHANNELS.JIRA_GET_SYNC_STATUS,
    async (
      _event,
      specDir: string
    ): Promise<IPCResult<JiraProjectState | null>> => {
      debugLog('getSyncStatus handler called', { specDir });

      try {
        const stateFile = path.join(specDir, '.jira_project.json');

        if (!fs.existsSync(stateFile)) {
          return { success: true, data: null };
        }

        const state: JiraProjectState = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        return { success: true, data: state };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to get sync status';
        debugLog('getSyncStatus failed:', errorMessage);
        return { success: false, error: errorMessage };
      }
    }
  );
}

/**
 * Task issue state stored in spec directory (hierarchical: parent + sub-tasks)
 */
interface TaskIssueState {
  parentIssueKey: string;
  parentIssueUrl: string;
  createdAt: string;
  projectKey: string;
  subtaskMapping: Record<string, string>;  // subtask_id -> issue_key
  totalSubtasks: number;
}

/**
 * Read project-specific JIRA key from project's .env file
 */
function getProjectJiraKey(specDir: string): string | null {
  try {
    // specDir can be:
    // 1. Normal: /path/to/project/.auto-claude/specs/task-name
    // 2. Worktree: /path/to/project/.auto-claude/worktrees/tasks/task-name/.auto-claude/specs/task-name
    //
    // We need to find the main project's .auto-claude/.env (not the worktree's)

    let searchPath = specDir;
    let envFile: string | null = null;

    // Walk up the path to find the main .auto-claude/.env
    // Stop when we find .auto-claude/.env that's NOT inside a worktree path
    while (searchPath && searchPath !== path.dirname(searchPath)) {
      const candidate = path.join(searchPath, '.auto-claude', '.env');

      // Check if this .auto-claude is the main one (not inside worktrees/)
      if (fs.existsSync(candidate) && !searchPath.includes('/worktrees/')) {
        envFile = candidate;
        debugLog('Found main project .env', { envFile });
        break;
      }

      // Also check if .env is directly in searchPath (for .auto-claude dir)
      const directEnv = path.join(searchPath, '.env');
      if (fs.existsSync(directEnv) && searchPath.endsWith('.auto-claude') && !searchPath.includes('/worktrees/')) {
        envFile = directEnv;
        debugLog('Found direct .env in .auto-claude', { envFile });
        break;
      }

      searchPath = path.dirname(searchPath);
    }

    if (!envFile || !fs.existsSync(envFile)) {
      debugLog('Project .env not found', { specDir });
      return null;
    }

    const envContent = fs.readFileSync(envFile, 'utf-8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('JIRA_PROJECT_KEY=')) {
        const value = trimmed.substring('JIRA_PROJECT_KEY='.length).trim();
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, '');
        if (cleanValue) {
          debugLog('Found project JIRA key', { key: cleanValue, envFile });
          return cleanValue;
        }
      }
    }

    return null;
  } catch (error) {
    debugLog('Error reading project JIRA key:', error);
    return null;
  }
}

/**
 * Create JIRA issue hierarchy for a task (parent Story + Sub-tasks)
 */
export function registerCreateTaskIssue(): void {
  ipcMain.handle(
    IPC_CHANNELS.JIRA_CREATE_TASK_ISSUE,
    async (
      _event,
      specDir: string,
      taskTitle: string,
      taskDescription: string,
      projectKey?: string
    ): Promise<IPCResult<TaskIssueState>> => {
      debugLog('createTaskIssue handler called', { specDir, taskTitle, projectKey });

      try {
        // Get JIRA settings
        const savedSettings = readSettingsFile();
        const settings: AppSettings = { ...DEFAULT_APP_SETTINGS, ...savedSettings };

        const host = settings.globalJiraHost;
        const email = settings.globalJiraEmail;
        const token = settings.globalJiraToken;

        // Priority: 1. Passed projectKey, 2. Project-specific key from .env, 3. Global default
        const projectJiraKey = getProjectJiraKey(specDir);
        const defaultProject = projectKey || projectJiraKey || settings.globalJiraDefaultProject;

        debugLog('Resolved JIRA project key', {
          passed: projectKey,
          projectSpecific: projectJiraKey,
          globalDefault: settings.globalJiraDefaultProject,
          resolved: defaultProject,
        });

        if (!host || !email || !token) {
          return { success: false, error: 'JIRA not configured. Please configure in Settings → Accounts → JIRA' };
        }

        if (!defaultProject) {
          return { success: false, error: 'No JIRA project key specified. Set in project settings or global settings.' };
        }

        const baseUrl = host.replace(/\/$/, '');
        const credentials = Buffer.from(`${email}:${token}`).toString('base64');
        const creatorLabel = getCreatorLabel(email);

        // Try to load existing state (avoids TOCTOU race condition)
        const stateFile = path.join(specDir, '.jira_task.json');
        let state: TaskIssueState | null = null;

        try {
          state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
          debugLog('Found existing JIRA task state', { parentKey: state?.parentIssueKey });
        } catch {
          // File doesn't exist - will create parent issue below
        }

        if (!state) {
          // Create parent Story issue
          const parentLabels: string[] = [];
          if (creatorLabel) parentLabels.push(creatorLabel);

          const parentIssue = await createJiraIssue(
            baseUrl,
            credentials,
            defaultProject,
            taskTitle,
            taskDescription,
            parentLabels,
            'Story'
          );

          state = {
            parentIssueKey: parentIssue.key,
            parentIssueUrl: `${baseUrl}/browse/${parentIssue.key}`,
            createdAt: new Date().toISOString(),
            projectKey: defaultProject,
            subtaskMapping: {},
            totalSubtasks: 0,
          };

          debugLog('Created parent issue', { issueKey: parentIssue.key });
        }

        // Try to read implementation plan to create sub-tasks (avoids TOCTOU)
        const planFile = path.join(specDir, 'implementation_plan.json');
        let plan: ImplementationPlan | null = null;
        try {
          plan = JSON.parse(fs.readFileSync(planFile, 'utf-8'));
        } catch {
          // Plan file doesn't exist - no subtasks to create
        }

        if (plan) {

          // Create sub-tasks for each subtask in the plan
          for (const phase of plan.phases) {
            for (const subtask of phase.subtasks) {
              const subtaskId = subtask.id;

              // Skip if already created
              if (state.subtaskMapping[subtaskId]) {
                debugLog(`Skipping subtask ${subtaskId} - already exists`);
                continue;
              }

              // Build labels for sub-task
              const subtaskLabels: string[] = [];
              if (creatorLabel) subtaskLabels.push(creatorLabel);
              subtaskLabels.push(`phase-${phase.phase}`);
              if (subtask.service) subtaskLabels.push(`service-${subtask.service}`);

              const subtaskSummary = `[${subtaskId}] ${subtask.description.slice(0, 100)}`;
              const subtaskDesc = `**Phase:** ${phase.name}\n**Service:** ${subtask.service || 'N/A'}\n\n${subtask.description}`;

              try {
                const jiraSubtask = await createJiraIssue(
                  baseUrl,
                  credentials,
                  defaultProject,
                  subtaskSummary,
                  subtaskDesc,
                  subtaskLabels,
                  'Sub-task',
                  state.parentIssueKey  // Link to parent
                );

                state.subtaskMapping[subtaskId] = jiraSubtask.key;
                debugLog(`Created sub-task ${jiraSubtask.key} for ${subtaskId}`);
              } catch (error) {
                debugLog(`Failed to create sub-task for ${subtaskId}:`, error);
                // Continue with other subtasks
              }
            }
          }

          state.totalSubtasks = Object.keys(state.subtaskMapping).length;
        }

        // Save state - stateFile path is derived from app's internal spec directory
        // State contains JIRA issue keys which are safe identifiers from the JIRA API
        // lgtm[js/path-injection]
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

        debugLog('Task issue creation complete', {
          parentKey: state.parentIssueKey,
          subtasks: state.totalSubtasks,
        });

        return { success: true, data: state };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create JIRA issue';
        debugLog('createTaskIssue failed:', errorMessage);
        return { success: false, error: errorMessage };
      }
    }
  );
}

/**
 * Get JIRA issue state for a task
 */
export function registerGetTaskIssue(): void {
  ipcMain.handle(
    IPC_CHANNELS.JIRA_GET_TASK_ISSUE,
    async (
      _event,
      specDir: string
    ): Promise<IPCResult<TaskIssueState | null>> => {
      debugLog('getTaskIssue handler called', { specDir });

      try {
        const stateFile = path.join(specDir, '.jira_task.json');

        if (!fs.existsSync(stateFile)) {
          return { success: true, data: null };
        }

        const state: TaskIssueState = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));

        // Get JIRA settings to construct URL if needed
        const savedSettings = readSettingsFile();
        const settings: AppSettings = { ...DEFAULT_APP_SETTINGS, ...savedSettings };
        const host = settings.globalJiraHost;

        // Ensure URL is populated (for backwards compatibility)
        if (!state.parentIssueUrl && host && state.parentIssueKey) {
          state.parentIssueUrl = `${host.replace(/\/$/, '')}/browse/${state.parentIssueKey}`;
        }

        return { success: true, data: state };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to get task issue';
        debugLog('getTaskIssue failed:', errorMessage);
        return { success: false, error: errorMessage };
      }
    }
  );
}

/**
 * Register all JIRA handlers
 */
export function registerJiraHandlers(): void {
  debugLog('Registering JIRA handlers');
  registerTestJiraConnection();
  registerCreateIssuesFromPlan();
  registerGetSyncStatus();
  registerCreateTaskIssue();
  registerGetTaskIssue();
  debugLog('JIRA handlers registered');
}
