import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS, AUTO_BUILD_PATHS, getSpecsDir } from '../../shared/constants';
import type { IPCResult, GitHubRepository, GitHubIssue, GitHubSyncStatus, GitHubImportResult, GitHubInvestigationResult, Project, Task, TaskMetadata, GitHubInvestigationStatus } from '../../shared/types';
import path from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { execSync, spawn } from 'child_process';
import { projectStore } from '../project-store';
import { AgentManager } from '../agent';
import { parseEnvFile } from './utils';


/**
 * Register all github-related IPC handlers
 */
export function registerGithubHandlers(
  agentManager: AgentManager,
  getMainWindow: () => BrowserWindow | null
): void {
  // ============================================
  // GitHub Integration Operations
  // ============================================

  /**
   * Helper to get GitHub config from project env
   */
  const getGitHubConfig = (project: Project): { token: string; repo: string } | null => {
    if (!project.autoBuildPath) return null;
    const envPath = path.join(project.path, project.autoBuildPath, '.env');
    if (!existsSync(envPath)) return null;

    try {
      const content = readFileSync(envPath, 'utf-8');
      const vars = parseEnvFile(content);
      const token = vars['GITHUB_TOKEN'];
      const repo = vars['GITHUB_REPO'];

      if (!token || !repo) return null;
      return { token, repo };
    } catch {
      return null;
    }
  };

  /**
   * Make a request to the GitHub API
   */
  const githubFetch = async (
    token: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<unknown> => {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `https://api.github.com${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Auto-Claude-UI',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return response.json();
  };

  ipcMain.handle(
    IPC_CHANNELS.GITHUB_CHECK_CONNECTION,
    async (_, projectId: string): Promise<IPCResult<GitHubSyncStatus>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const config = getGitHubConfig(project);
      if (!config) {
        return {
          success: true,
          data: {
            connected: false,
            error: 'No GitHub token or repository configured'
          }
        };
      }

      try {
        // Fetch repo info
        const repoData = await githubFetch(
          config.token,
          `/repos/${config.repo}`
        ) as { full_name: string; description?: string };

        // Count open issues
        const issuesData = await githubFetch(
          config.token,
          `/repos/${config.repo}/issues?state=open&per_page=1`
        ) as unknown[];

        const openCount = Array.isArray(issuesData) ? issuesData.length : 0;

        return {
          success: true,
          data: {
            connected: true,
            repoFullName: repoData.full_name,
            repoDescription: repoData.description,
            issueCount: openCount,
            lastSyncedAt: new Date().toISOString()
          }
        };
      } catch (error) {
        return {
          success: true,
          data: {
            connected: false,
            error: error instanceof Error ? error.message : 'Failed to connect to GitHub'
          }
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GITHUB_GET_REPOSITORIES,
    async (_, projectId: string): Promise<IPCResult<GitHubRepository[]>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const config = getGitHubConfig(project);
      if (!config) {
        return { success: false, error: 'No GitHub token configured' };
      }

      try {
        const repos = await githubFetch(
          config.token,
          '/user/repos?per_page=100&sort=updated'
        ) as Array<{
          id: number;
          name: string;
          full_name: string;
          description?: string;
          html_url: string;
          default_branch: string;
          private: boolean;
          owner: { login: string; avatar_url?: string };
        }>;

        const result: GitHubRepository[] = repos.map(repo => ({
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description,
          url: repo.html_url,
          defaultBranch: repo.default_branch,
          private: repo.private,
          owner: {
            login: repo.owner.login,
            avatarUrl: repo.owner.avatar_url
          }
        }));

        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch repositories'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GITHUB_GET_ISSUES,
    async (_, projectId: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<IPCResult<GitHubIssue[]>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const config = getGitHubConfig(project);
      if (!config) {
        return { success: false, error: 'No GitHub token or repository configured' };
      }

      try {
        const issues = await githubFetch(
          config.token,
          `/repos/${config.repo}/issues?state=${state}&per_page=100&sort=updated`
        ) as Array<{
          id: number;
          number: number;
          title: string;
          body?: string;
          state: 'open' | 'closed';
          labels: Array<{ id: number; name: string; color: string; description?: string }>;
          assignees: Array<{ login: string; avatar_url?: string }>;
          user: { login: string; avatar_url?: string };
          milestone?: { id: number; title: string; state: 'open' | 'closed' };
          created_at: string;
          updated_at: string;
          closed_at?: string;
          comments: number;
          url: string;
          html_url: string;
          pull_request?: unknown;
        }>;

        // Filter out pull requests
        const issuesOnly = issues.filter(issue => !issue.pull_request);

        const result: GitHubIssue[] = issuesOnly.map(issue => ({
          id: issue.id,
          number: issue.number,
          title: issue.title,
          body: issue.body,
          state: issue.state,
          labels: issue.labels,
          assignees: issue.assignees.map(a => ({
            login: a.login,
            avatarUrl: a.avatar_url
          })),
          author: {
            login: issue.user.login,
            avatarUrl: issue.user.avatar_url
          },
          milestone: issue.milestone,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          closedAt: issue.closed_at,
          commentsCount: issue.comments,
          url: issue.url,
          htmlUrl: issue.html_url,
          repoFullName: config.repo
        }));

        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch issues'
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GITHUB_GET_ISSUE,
    async (_, projectId: string, issueNumber: number): Promise<IPCResult<GitHubIssue>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const config = getGitHubConfig(project);
      if (!config) {
        return { success: false, error: 'No GitHub token or repository configured' };
      }

      try {
        const issue = await githubFetch(
          config.token,
          `/repos/${config.repo}/issues/${issueNumber}`
        ) as {
          id: number;
          number: number;
          title: string;
          body?: string;
          state: 'open' | 'closed';
          labels: Array<{ id: number; name: string; color: string; description?: string }>;
          assignees: Array<{ login: string; avatar_url?: string }>;
          user: { login: string; avatar_url?: string };
          milestone?: { id: number; title: string; state: 'open' | 'closed' };
          created_at: string;
          updated_at: string;
          closed_at?: string;
          comments: number;
          url: string;
          html_url: string;
        };

        const result: GitHubIssue = {
          id: issue.id,
          number: issue.number,
          title: issue.title,
          body: issue.body,
          state: issue.state,
          labels: issue.labels,
          assignees: issue.assignees.map(a => ({
            login: a.login,
            avatarUrl: a.avatar_url
          })),
          author: {
            login: issue.user.login,
            avatarUrl: issue.user.avatar_url
          },
          milestone: issue.milestone,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          closedAt: issue.closed_at,
          commentsCount: issue.comments,
          url: issue.url,
          htmlUrl: issue.html_url,
          repoFullName: config.repo
        };

        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch issue'
        };
      }
    }
  );

  ipcMain.on(
    IPC_CHANNELS.GITHUB_INVESTIGATE_ISSUE,
    async (_, projectId: string, issueNumber: number) => {
      const mainWindow = getMainWindow();
      if (!mainWindow) return;

      const project = projectStore.getProject(projectId);
      if (!project) {
        mainWindow.webContents.send(
          IPC_CHANNELS.GITHUB_INVESTIGATION_ERROR,
          projectId,
          'Project not found'
        );
        return;
      }

      const config = getGitHubConfig(project);
      if (!config) {
        mainWindow.webContents.send(
          IPC_CHANNELS.GITHUB_INVESTIGATION_ERROR,
          projectId,
          'No GitHub token or repository configured'
        );
        return;
      }

      try {
        // Send progress update: fetching issue
        mainWindow.webContents.send(
          IPC_CHANNELS.GITHUB_INVESTIGATION_PROGRESS,
          projectId,
          {
            phase: 'fetching',
            issueNumber,
            progress: 10,
            message: 'Fetching issue details...'
          } as GitHubInvestigationStatus
        );

        // Fetch the issue
        const issue = await githubFetch(
          config.token,
          `/repos/${config.repo}/issues/${issueNumber}`
        ) as {
          number: number;
          title: string;
          body?: string;
          labels: Array<{ name: string }>;
          html_url: string;
        };

        // Fetch issue comments for more context
        const comments = await githubFetch(
          config.token,
          `/repos/${config.repo}/issues/${issueNumber}/comments`
        ) as Array<{ body: string; user: { login: string } }>;

        // Build context for the AI investigation
        const issueContext = `
# GitHub Issue #${issue.number}: ${issue.title}

${issue.body || 'No description provided.'}

${comments.length > 0 ? `## Comments (${comments.length}):
${comments.map(c => `**${c.user.login}:** ${c.body}`).join('\n\n')}` : ''}

**Labels:** ${issue.labels.map(l => l.name).join(', ') || 'None'}
**URL:** ${issue.html_url}
`;

        // Send progress update: analyzing
        mainWindow.webContents.send(
          IPC_CHANNELS.GITHUB_INVESTIGATION_PROGRESS,
          projectId,
          {
            phase: 'analyzing',
            issueNumber,
            progress: 30,
            message: 'AI is analyzing the issue...'
          } as GitHubInvestigationStatus
        );

        // Build task description
        const taskDescription = `Investigate GitHub Issue #${issue.number}: ${issue.title}

${issueContext}

Please analyze this issue and provide:
1. A brief summary of what the issue is about
2. A proposed solution approach
3. The files that would likely need to be modified
4. Estimated complexity (simple/standard/complex)
5. Acceptance criteria for resolving this issue`;

        // Create proper spec directory
                const specsBaseDir = getSpecsDir(project.autoBuildPath);
        const specsDir = path.join(project.path, specsBaseDir);
        if (!existsSync(specsDir)) {
          mkdirSync(specsDir, { recursive: true });
        }

        // Find next available spec number
        let specNumber = 1;
        const existingDirs = readdirSync(specsDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name);
        const existingNumbers = existingDirs
          .map(name => {
            const match = name.match(/^(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter(n => n > 0);
        if (existingNumbers.length > 0) {
          specNumber = Math.max(...existingNumbers) + 1;
        }

        // Create spec ID with zero-padded number and slugified title
        const slugifiedTitle = issue.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 50);
        const specId = `${String(specNumber).padStart(3, '0')}-${slugifiedTitle}`;

        // Create spec directory
        const specDir = path.join(specsDir, specId);
        mkdirSync(specDir, { recursive: true });

        // Create initial implementation_plan.json
        const now = new Date().toISOString();
        const implementationPlan = {
          feature: issue.title,
          description: taskDescription,
          created_at: now,
          updated_at: now,
          status: 'pending',
          phases: []
        };
        writeFileSync(path.join(specDir, AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN), JSON.stringify(implementationPlan, null, 2));

        // Create requirements.json
        const requirements = {
          task_description: taskDescription,
          workflow_type: 'feature'
        };
        writeFileSync(path.join(specDir, AUTO_BUILD_PATHS.REQUIREMENTS), JSON.stringify(requirements, null, 2));

        // Build metadata
        const metadata: TaskMetadata = {
          sourceType: 'github',
          githubIssueNumber: issue.number,
          githubUrl: issue.html_url,
          category: 'feature'
        };
        writeFileSync(path.join(specDir, 'task_metadata.json'), JSON.stringify(metadata, null, 2));

        // Start spec creation with the existing spec directory
        agentManager.startSpecCreation(specId, project.path, taskDescription, specDir, metadata);

        // Send progress update: creating task
        mainWindow.webContents.send(
          IPC_CHANNELS.GITHUB_INVESTIGATION_PROGRESS,
          projectId,
          {
            phase: 'creating_task',
            issueNumber,
            progress: 70,
            message: 'Creating task from investigation...'
          } as GitHubInvestigationStatus
        );

        const investigationResult: GitHubInvestigationResult = {
          success: true,
          issueNumber,
          analysis: {
            summary: `Investigation of issue #${issueNumber}: ${issue.title}`,
            proposedSolution: 'Task has been created for AI agent to implement the solution.',
            affectedFiles: [],
            estimatedComplexity: 'standard',
            acceptanceCriteria: [
              `Issue #${issueNumber} requirements are met`,
              'All existing tests pass',
              'New functionality is tested'
            ]
          },
          taskId: specId
        };

        // Send completion
        mainWindow.webContents.send(
          IPC_CHANNELS.GITHUB_INVESTIGATION_PROGRESS,
          projectId,
          {
            phase: 'complete',
            issueNumber,
            progress: 100,
            message: 'Investigation complete!'
          } as GitHubInvestigationStatus
        );

        mainWindow.webContents.send(
          IPC_CHANNELS.GITHUB_INVESTIGATION_COMPLETE,
          projectId,
          investigationResult
        );

      } catch (error) {
        mainWindow.webContents.send(
          IPC_CHANNELS.GITHUB_INVESTIGATION_ERROR,
          projectId,
          error instanceof Error ? error.message : 'Failed to investigate issue'
        );
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GITHUB_IMPORT_ISSUES,
    async (_, projectId: string, issueNumbers: number[]): Promise<IPCResult<GitHubImportResult>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const config = getGitHubConfig(project);
      if (!config) {
        return { success: false, error: 'No GitHub token or repository configured' };
      }

      let imported = 0;
      let failed = 0;
      const errors: string[] = [];
      const tasks: Task[] = [];

      // Set up specs directory
      const specsBaseDir = getSpecsDir(project.autoBuildPath);
      const specsDir = path.join(project.path, specsBaseDir);
      if (!existsSync(specsDir)) {
        mkdirSync(specsDir, { recursive: true });
      }

      for (const issueNumber of issueNumbers) {
        try {
          const issue = await githubFetch(
            config.token,
            `/repos/${config.repo}/issues/${issueNumber}`
          ) as {
            number: number;
            title: string;
            body?: string;
            labels: Array<{ name: string }>;
            html_url: string;
          };

          const labels = issue.labels.map(l => l.name).join(', ');
          const description = `# ${issue.title}

**GitHub Issue:** [#${issue.number}](${issue.html_url})
${labels ? `**Labels:** ${labels}` : ''}

## Description

${issue.body || 'No description provided.'}
`;

          // Find next available spec number
          let specNumber = 1;
          const existingDirs = readdirSync(specsDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);
          const existingNumbers = existingDirs
            .map(name => {
              const match = name.match(/^(\d+)/);
              return match ? parseInt(match[1], 10) : 0;
            })
            .filter(n => n > 0);
          if (existingNumbers.length > 0) {
            specNumber = Math.max(...existingNumbers) + 1;
          }

          // Create spec ID with zero-padded number and slugified title
          const slugifiedTitle = issue.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50);
          const specId = `${String(specNumber).padStart(3, '0')}-${slugifiedTitle}`;

          // Create spec directory
          const specDir = path.join(specsDir, specId);
          mkdirSync(specDir, { recursive: true });

          // Create initial implementation_plan.json
          const now = new Date().toISOString();
          const implementationPlan = {
            feature: issue.title,
            description: description,
            created_at: now,
            updated_at: now,
            status: 'pending',
            phases: []
          };
          writeFileSync(path.join(specDir, AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN), JSON.stringify(implementationPlan, null, 2));

          // Create requirements.json
          const requirements = {
            task_description: description,
            workflow_type: 'feature'
          };
          writeFileSync(path.join(specDir, AUTO_BUILD_PATHS.REQUIREMENTS), JSON.stringify(requirements, null, 2));

          // Build metadata
          const metadata: TaskMetadata = {
            sourceType: 'github',
            githubIssueNumber: issue.number,
            githubUrl: issue.html_url,
            category: 'feature'
          };
          writeFileSync(path.join(specDir, 'task_metadata.json'), JSON.stringify(metadata, null, 2));

          // Start spec creation with the existing spec directory
          agentManager.startSpecCreation(specId, project.path, description, specDir, metadata);
          imported++;
        } catch (err) {
          failed++;
          errors.push(`Failed to import #${issueNumber}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      return {
        success: true,
        data: {
          success: failed === 0,
          imported,
          failed,
          errors: errors.length > 0 ? errors : undefined,
          tasks
        }
      };
    }
  );

  /**
   * Create a GitHub release using the gh CLI
   */
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_CREATE_RELEASE,
    async (
      _,
      projectId: string,
      version: string,
      releaseNotes: string,
      options?: { draft?: boolean; prerelease?: boolean }
    ): Promise<IPCResult<{ url: string }>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      try {
        // Check if gh CLI is available
        // Use 'where' on Windows, 'which' on Unix
        try {
          const checkCmd = process.platform === 'win32' ? 'where gh' : 'which gh';
          execSync(checkCmd, { encoding: 'utf-8', stdio: 'pipe' });
        } catch {
          return {
            success: false,
            error: 'GitHub CLI (gh) not found. Please install it: https://cli.github.com/'
          };
        }

        // Check if user is authenticated
        try {
          execSync('gh auth status', { cwd: project.path, encoding: 'utf-8', stdio: 'pipe' });
        } catch {
          return {
            success: false,
            error: 'Not authenticated with GitHub. Run "gh auth login" in terminal first.'
          };
        }

        // Prepare tag name (ensure v prefix)
        const tag = version.startsWith('v') ? version : `v${version}`;

        // Build gh release command
        const args = ['release', 'create', tag, '--title', tag, '--notes', releaseNotes];
        if (options?.draft) args.push('--draft');
        if (options?.prerelease) args.push('--prerelease');

        // Create the release
        const output = execSync(`gh ${args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`, {
          cwd: project.path,
          encoding: 'utf-8',
          stdio: 'pipe'
        }).trim();

        // Output is typically the release URL
        const releaseUrl = output || `https://github.com/releases/tag/${tag}`;

        return {
          success: true,
          data: { url: releaseUrl }
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to create release';
        // Try to extract more useful error message from stderr
        if (error && typeof error === 'object' && 'stderr' in error) {
          return { success: false, error: String(error.stderr) || errorMsg };
        }
        return { success: false, error: errorMsg };
      }
    }
  );

}
